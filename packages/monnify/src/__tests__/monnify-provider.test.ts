import {
  ConfigurationError,
  InvalidTypeError,
  WebhookError,
} from '@paykit-sdk/core';
import { sha512 } from 'js-sha512';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { MonnifyProvider } from '../monnify-provider';

const SECRET = 'monnify_test_secret';

const makeProvider = () =>
  new MonnifyProvider({
    apiKey: 'MK_TEST_KEY_ID',
    secretKey: 'MK_TEST_KEY_SECRET',
    isSandbox: true,
    debug: false,
  });

/** Signature as Monnify sends it: HMAC-SHA512 over the raw body. */
const sign = (rawBody: string, secret = SECRET) =>
  sha512.hmac(secret, rawBody);

const dto = (body: string, signature?: string) => ({
  body,
  headersAsObject: (signature
    ? { 'monnify-signature': signature }
    : {}) as Record<string, string>,
  fullUrl: 'https://app.example.com/api/webhook',
});

describe('MonnifyProvider constructor', () => {
  it('throws ConfigurationError when credentials are missing', () => {
    expect(
      () => new MonnifyProvider({ isSandbox: true } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('monnify');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('MonnifyProvider.handleWebhook', () => {
  const successBody = JSON.stringify({
    eventType: 'SUCCESSFUL_TRANSACTION',
    eventData: {
      transactionReference: 'MNFY|1',
      amountPaid: 5000,
    },
  });

  it('rejects when no webhook secret is configured', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), null),
    ).rejects.toThrow(WebhookError);
  });

  it('rejects when the signature header is missing', async () => {
    await expect(
      makeProvider().handleWebhook(dto(successBody), SECRET),
    ).rejects.toThrow('Missing Monnify signature');
  });

  it('rejects an invalid signature', async () => {
    await expect(
      makeProvider().handleWebhook(
        dto(successBody, sign(successBody, 'wrong')),
        SECRET,
      ),
    ).rejects.toThrow('Invalid Monnify signature');
  });

  it('rejects a signature over a double-encoded payload', async () => {
    // Regression: the old implementation hashed JSON.stringify(body)
    // (the body double-encoded) and rejected all genuine webhooks
    await expect(
      makeProvider().handleWebhook(
        dto(successBody, sign(JSON.stringify(successBody))),
        SECRET,
      ),
    ).rejects.toThrow('Invalid Monnify signature');
  });

  it('accepts a genuine Monnify signature over the raw body', async () => {
    const events = await makeProvider().handleWebhook(
      dto(successBody, sign(successBody)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'monnify.SUCCESSFUL_TRANSACTION',
      'payment.created',
    ]);
    expect(events[0].is_raw).toBe(true);
    expect(events[0].data).toMatchObject({
      transactionReference: 'MNFY|1',
    });
  });

  it('maps REJECTED_PAYMENT to payment.failed', async () => {
    const body = JSON.stringify({
      eventType: 'REJECTED_PAYMENT',
      eventData: { transactionReference: 'MNFY|2' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'monnify.REJECTED_PAYMENT',
      'payment.failed',
    ]);
  });

  it('maps MANDATE_UPDATE by mandate status', async () => {
    const body = JSON.stringify({
      eventType: 'MANDATE_UPDATE',
      eventData: { mandateStatus: 'CANCELLED' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'monnify.MANDATE_UPDATE',
      'subscription.canceled',
    ]);
  });

  it.each(['ACTIVE', 'PENDING'])(
    'maps MANDATE_UPDATE with status %s to subscription.created',
    async mandateStatus => {
      const body = JSON.stringify({
        eventType: 'MANDATE_UPDATE',
        eventData: { mandateStatus },
      });

      const events = await makeProvider().handleWebhook(
        dto(body, sign(body)),
        SECRET,
      );

      expect(events.map(e => e.type)).toEqual([
        'monnify.MANDATE_UPDATE',
        'subscription.created',
      ]);
    },
  );

  it('maps MANDATE_UPDATE with an unrecognized status to subscription.updated', async () => {
    const body = JSON.stringify({
      eventType: 'MANDATE_UPDATE',
      eventData: { mandateStatus: 'SOMETHING_ELSE' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'monnify.MANDATE_UPDATE',
      'subscription.updated',
    ]);
  });

  it.each([
    ['SUCCESSFUL_TRANSACTION', 'payment.created'],
    ['SUCCESSFUL_TRANSACTION_OFFLINE', 'payment.created'],
    ['SETTLEMENT', 'payment.updated'],
    ['SUCCESSFUL_REFUND', 'refund.created'],
    ['FAILED_REFUND', 'refund.created'],
  ])('maps %s to %s', async (eventType, paykitType) => {
    const body = JSON.stringify({
      eventType,
      eventData: { transactionReference: 'MNFY|3' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      `monnify.${eventType}`,
      paykitType,
    ]);
  });

  it('emits only the raw event for ignored event types like CUSTOMER_CREATED', async () => {
    const body = JSON.stringify({
      eventType: 'CUSTOMER_CREATED',
      eventData: { customerEmail: 'buyer@example.com' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('monnify.CUSTOMER_CREATED');
  });

  it('emits only the raw event for unknown event types', async () => {
    const body = JSON.stringify({
      eventType: 'SOMETHING_NEW',
      eventData: { ref: 'x' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'monnify.SOMETHING_NEW',
      is_raw: true,
      data: { ref: 'x' },
    });
  });
});

describe('MonnifyProvider.createCheckout / createPayment', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const tokenResponse = () =>
    jsonResponse({
      responseBody: { accessToken: 'tok_1', expiresIn: 3600 },
    });

  const initResponse = () =>
    jsonResponse({
      responseBody: {
        transactionReference: 'MNFY|TX1',
        checkoutUrl: 'https://sandbox.monnify.com/checkout/abc',
      },
    });

  const queryResponse = (extra: Record<string, unknown> = {}) =>
    jsonResponse({
      responseBody: {
        transactionReference: 'MNFY|TX1',
        paymentReference: 'pay_ref_1',
        amountPaid: 5000,
        currencyCode: 'NGN',
        customerEmail: 'buyer@example.com',
        paymentStatus: 'PAID',
        metaData: {},
        ...extra,
      },
    });

  /** token -> init-transaction -> query-transaction, in that order. */
  const stubTransactionFlow = () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(initResponse())
      .mockResolvedValueOnce(queryResponse());
  };

  it('createCheckout initializes a hosted transaction and maps the response', async () => {
    stubTransactionFlow();

    const checkout = await makeProvider().createCheckout({
      customer: { email: 'buyer@example.com' },
      item_id: 'plan_pro',
      quantity: 1,
      session_type: 'one_time',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: null,
      provider_metadata: { amount: '5000', currency: 'NGN' },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const initCall = fetchMock.mock.calls[1];
    expect(initCall[0]).toBe(
      'https://sandbox.monnify.com/api/v1/merchant/transactions/init-transaction',
    );
    const initBody = JSON.parse(initCall[1].body as string);
    expect(initBody.amount).toBe('5000');
    expect(initBody.currencyCode).toBe('NGN');
    expect(initBody.redirectUrl).toBe('https://example.com/success');
    expect(initBody.customerEmail).toBe('buyer@example.com');

    expect(checkout.payment_url).toBe(
      'https://sandbox.monnify.com/checkout/abc',
    );
    expect(checkout.amount).toBe(5000);
    expect(checkout.currency).toBe('NGN');
  });

  it('createCheckout throws InvalidTypeError for an id-based customer', async () => {
    await expect(
      makeProvider().createCheckout({
        customer: { id: 'cus_1' },
        item_id: 'plan_pro',
        quantity: 1,
        session_type: 'one_time',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        metadata: null,
        provider_metadata: { amount: '5000', currency: 'NGN' },
      } as never),
    ).rejects.toThrow(InvalidTypeError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createPayment reuses the same hosted-transaction flow as createCheckout', async () => {
    stubTransactionFlow();

    const payment = await makeProvider().createPayment({
      customer: { email: 'buyer@example.com' },
      amount: 5000,
      currency: 'NGN',
      item_id: 'plan_pro',
      capture_method: 'automatic',
      provider_metadata: {
        success_url: 'https://example.com/success',
      },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const initCall = fetchMock.mock.calls[1];
    expect(initCall[0]).toBe(
      'https://sandbox.monnify.com/api/v1/merchant/transactions/init-transaction',
    );
    const initBody = JSON.parse(initCall[1].body as string);
    expect(initBody.amount).toBe('5000');
    expect(initBody.redirectUrl).toBe('https://example.com/success');

    expect(payment.status).toBe('succeeded');
    expect(payment.amount).toBe(5000);
  });

  it('createPayment requires success_url in provider_metadata', async () => {
    await expect(
      makeProvider().createPayment({
        customer: { email: 'buyer@example.com' },
        amount: 5000,
        currency: 'NGN',
        item_id: 'plan_pro',
        capture_method: 'automatic',
      } as never),
    ).rejects.toThrow(/success_url/);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
