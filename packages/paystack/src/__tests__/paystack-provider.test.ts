import {
  ConfigurationError,
  InvalidTypeError,
  WebhookError,
} from '@paykit-sdk/core';
import { createHmac } from 'crypto';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { PaystackProvider } from '../paystack-provider';
import { Checkout$inboundSchema } from '../utils/mapper';

const SECRET = 'sk_test_paystack_secret';

const makeProvider = () =>
  new PaystackProvider({
    secretKey: SECRET,
    isSandbox: true,
    debug: false,
  });

const sign = (body: string, secret = SECRET) =>
  createHmac('sha512', secret).update(body).digest('hex');

const dto = (
  body: string,
  signature: string | undefined = undefined,
) => ({
  body,
  headersAsObject: (signature
    ? { 'x-paystack-signature': signature }
    : {}) as Record<string, string>,
  fullUrl: 'https://app.example.com/api/webhook',
});

describe('PaystackProvider constructor', () => {
  it('throws ConfigurationError when secretKey is missing', () => {
    expect(
      () => new PaystackProvider({ isSandbox: true } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('paystack');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('Checkout$inboundSchema', () => {
  it('recovers products and session type from paykit metadata', () => {
    // Regression: an unreachable typeof check used to leave products
    // as [{id: '', quantity: 1}] no matter what the metadata carried
    const checkout = Checkout$inboundSchema(
      {
        reference: 'ref_1',
        authorizationUrl: 'https://checkout.paystack.com/ref_1',
        accessCode: 'ac_1',
      } as never,
      {
        currency: 'NGN',
        amount: 10000,
        metadata: JSON.stringify({
          __paykit: JSON.stringify({
            item_id: 'item_9',
            quantity: 2,
            type: 'one_time',
          }),
        }) as never,
      },
    );

    expect(checkout.products).toEqual([
      { id: 'item_9', quantity: 2 },
    ]);
    expect(checkout.session_type).toBe('one_time');
    expect(checkout.payment_url).toBe(
      'https://checkout.paystack.com/ref_1',
    );
  });
});

describe('PaystackProvider HTTP operations', () => {
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

  const initResponse = () =>
    jsonResponse({
      status: true,
      message: 'ok',
      data: {
        authorization_url: 'https://checkout.paystack.com/xyz',
        access_code: 'ac_1',
        reference: 'ref_1',
      },
    });

  const customerResponse = () =>
    jsonResponse({
      status: true,
      message: 'ok',
      data: {
        customer_code: 'CUS_1',
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone: null,
        metadata: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    });

  it('createCheckout does not let provider_metadata override the normalized amount/currency', async () => {
    fetchMock
      .mockResolvedValueOnce(initResponse())
      .mockResolvedValueOnce(customerResponse());

    await makeProvider().createCheckout({
      customer: { email: 'buyer@example.com' },
      item_id: 'plan_pro',
      quantity: 1,
      session_type: 'one_time',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: null,
      provider_metadata: { amount: '10000', currency: 'ngn' },
    } as never);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.paystack.co/transaction/initialize',
    );

    const body = JSON.parse((options as { body: string }).body);
    // provider_metadata sent 'ngn' lowercase and a raw string amount;
    // the normalized, uppercased/parsed values must win.
    expect(body.currency).toBe('NGN');
    expect(body.amount).toBe(10000);
    expect(typeof body.amount).toBe('number');
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
        provider_metadata: { amount: '10000', currency: 'NGN' },
      } as never),
    ).rejects.toThrow(InvalidTypeError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createPayment sends amount/currency directly and returns a pending payment', async () => {
    fetchMock.mockResolvedValueOnce(initResponse());

    const payment = await makeProvider().createPayment({
      customer: { email: 'buyer@example.com' },
      amount: 10000,
      currency: 'NGN',
      item_id: 'item_1',
      capture_method: 'automatic',
    } as never);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.paystack.co/transaction/initialize',
    );

    const body = JSON.parse((options as { body: string }).body);
    expect(body.amount).toBe(10000);
    expect(body.currency).toBe('NGN');
    expect(body.email).toBe('buyer@example.com');

    expect(payment.status).toBe('pending');
    expect(payment.payment_url).toBe(
      'https://checkout.paystack.com/xyz',
    );
    expect(payment.requires_action).toBe(true);
  });

  it('createPayment does not let provider_metadata override amount/currency', async () => {
    fetchMock.mockResolvedValueOnce(initResponse());

    await makeProvider().createPayment({
      customer: { email: 'buyer@example.com' },
      amount: 10000,
      currency: 'NGN',
      item_id: 'item_1',
      capture_method: 'automatic',
      provider_metadata: { amount: 1, currency: 'usd' },
    } as never);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse((options as { body: string }).body);
    expect(body.amount).toBe(10000);
    expect(body.currency).toBe('NGN');
  });
});

describe('PaystackProvider.handleWebhook', () => {
  it('rejects when no webhook secret is configured', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), null),
    ).rejects.toThrow(WebhookError);
  });

  it('rejects when the signature header is missing', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), SECRET),
    ).rejects.toThrow('Missing x-paystack-signature header');
  });

  it('rejects an invalid signature', async () => {
    const body = JSON.stringify({
      event: 'charge.success',
      data: {},
    });

    await expect(
      makeProvider().handleWebhook(
        dto(body, sign(body, 'wrong_secret')),
        SECRET,
      ),
    ).rejects.toThrow('Invalid Paystack webhook signature');
  });

  it('rejects a correctly signed but non-JSON payload', async () => {
    const body = 'not-json';

    await expect(
      makeProvider().handleWebhook(dto(body, sign(body)), SECRET),
    ).rejects.toThrow('Invalid webhook payload: not valid JSON');
  });

  it('always emits the raw provider event', async () => {
    const body = JSON.stringify({
      event: 'transfer.success',
      data: { reference: 'ref_1' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'paystack.transfer.success',
      is_raw: true,
      data: { reference: 'ref_1' },
    });
  });

  it('maps subscription.disable to subscription.canceled', async () => {
    const body = JSON.stringify({
      event: 'subscription.disable',
      data: { subscription_code: 'SUB_1' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'paystack.subscription.disable',
      'subscription.canceled',
    ]);
    expect(events[1].data).toBeNull();
  });

  it('maps charge.failed to payment.failed', async () => {
    const body = JSON.stringify({
      event: 'charge.failed',
      data: {
        reference: 'ref_9',
        amount: 5000,
        currency: 'NGN',
        status: 'failed',
        metadata: '{}',
        customer: { email: 'buyer@example.com' },
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events).toHaveLength(2);
    expect(events[1].type).toBe('payment.failed');
    expect(events[1].data).toMatchObject({
      id: 'ref_9',
      amount: 5000,
      currency: 'NGN',
      status: 'failed',
      customer: { email: 'buyer@example.com' },
    });
  });

  it('maps charge.success to payment.updated + invoice.generated', async () => {
    const body = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 12345,
        reference: 'ref_10',
        amount: 10000,
        currency: 'NGN',
        status: 'success',
        metadata: '{}',
        paid_at: '2026-01-01T00:00:00.000Z',
        customer: { email: 'buyer@example.com' },
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'paystack.charge.success',
      'payment.updated',
      'invoice.generated',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'ref_10',
      status: 'succeeded',
    });
    expect(events[2].data).toMatchObject({
      amount_paid: 10000,
      currency: 'NGN',
      status: 'paid',
    });
  });

  it('maps customer.create to customer.created', async () => {
    const body = JSON.stringify({
      event: 'customer.create',
      data: {
        customer_code: 'CUS_1',
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone: null,
        metadata: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'paystack.customer.create',
      'customer.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'CUS_1',
      email: 'buyer@example.com',
    });
  });

  it('maps customeridentification.success to customer.updated', async () => {
    const body = JSON.stringify({
      event: 'customeridentification.success',
      data: {
        customer_code: 'CUS_1',
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone: null,
        metadata: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'paystack.customeridentification.success',
      'customer.updated',
    ]);
  });

  it('maps subscription.create to subscription.created', async () => {
    const body = JSON.stringify({
      event: 'subscription.create',
      data: {
        subscription_code: 'SUB_1',
        email_token: 'tok_1',
        status: 'active',
        amount: 5000,
        currency: 'NGN',
        customer: { email: 'buyer@example.com' },
        createdAt: '2026-01-01T00:00:00.000Z',
        next_payment_date: '2026-02-01T00:00:00.000Z',
        plan: {
          plan_code: 'PLN_1',
          interval: 'monthly',
          currency: 'NGN',
        },
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'paystack.subscription.create',
      'subscription.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'SUB_1',
      status: 'active',
    });
  });

  it('maps invoice.create to payment.created when a transaction is present', async () => {
    const body = JSON.stringify({
      event: 'invoice.create',
      data: {
        transaction: {
          reference: 'ref_20',
          amount: 7500,
          currency: 'NGN',
          status: 'success',
          metadata: '{}',
          customer: { email: 'buyer@example.com' },
        },
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'paystack.invoice.create',
      'payment.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'ref_20',
      amount: 7500,
    });
  });

  it('emits only the raw event for invoice.create with no transaction', async () => {
    const body = JSON.stringify({
      event: 'invoice.create',
      data: {},
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('paystack.invoice.create');
  });

  it('maps invoice.payment_failed to payment.failed', async () => {
    const body = JSON.stringify({
      event: 'invoice.payment_failed',
      data: {
        transaction: {
          reference: 'ref_21',
          amount: 7500,
          currency: 'NGN',
          status: 'success',
          metadata: '{}',
          customer: { email: 'buyer@example.com' },
        },
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'paystack.invoice.payment_failed',
      'payment.failed',
    ]);
    expect(events[1].data).toMatchObject({ status: 'failed' });
  });

  it('maps refund.processed to refund.created', async () => {
    const body = JSON.stringify({
      event: 'refund.processed',
      data: {
        id: 999,
        transaction: 12345,
        amount: 2500,
        currency: 'NGN',
        customer_note: 'Refund requested',
        merchant_note: '',
        status: 'processed',
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'paystack.refund.processed',
      'refund.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: '999',
      amount: 2500,
      reason: 'Refund requested',
    });
  });
});
