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
import { ChapaProvider } from '../chapa-provider';
import type { ChapaTransaction } from '../schema';
import {
  Checkout$inboundSchema,
  Payment$inboundSchema,
} from '../utils/mapper';

const SECRET = 'CHASECK_TEST-abc123';

const makeProvider = () =>
  new ChapaProvider({
    secretKey: SECRET,
    isSandbox: true,
    debug: false,
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const dto = (body: string, headers: Record<string, string> = {}) => ({
  body,
  headersAsObject: headers,
  fullUrl: 'https://app.example.com/api/webhook',
});

const signPayload = (payload: unknown, secret = SECRET) =>
  createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

const signSecret = (secret = SECRET) =>
  createHmac('sha256', secret).update(secret).digest('hex');

const transactionFixture = (
  status: string,
  extra: Record<string, unknown> = {},
): ChapaTransaction => ({
  first_name: '',
  last_name: '',
  email: 'buyer@example.com',
  mobile: null,
  currency: 'ETB',
  amount: '400.00',
  charge: '12.00',
  status,
  mode: 'test',
  reference: 'chapa_ref_1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:05:00.000Z',
  type: 'API',
  tx_ref: 'tx_1',
  payment_method: 'telebirr',
  customization: null,
  meta: null,
  ...extra,
});

describe('ChapaProvider constructor', () => {
  it('throws ConfigurationError when secretKey is missing', () => {
    expect(
      () => new ChapaProvider({ isSandbox: true } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('chapa');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('Checkout$inboundSchema', () => {
  it('recovers products and session type from paykit metadata', () => {
    const checkout = Checkout$inboundSchema(
      {
        checkout_url: 'https://checkout.chapa.co/abc',
        tx_ref: 'tx_1',
      },
      {
        currency: 'ETB',
        amount: '400.00',
        email: 'buyer@example.com',
        meta: {
          __paykit: JSON.stringify({
            item_id: 'item_9',
            quantity: 2,
            type: 'one_time',
          }),
        },
      },
    );

    expect(checkout.products).toEqual([
      { id: 'item_9', quantity: 2 },
    ]);
    expect(checkout.session_type).toBe('one_time');
    expect(checkout.payment_url).toBe(
      'https://checkout.chapa.co/abc',
    );
    expect(checkout.amount).toBe(400);
    expect(checkout.customer).toEqual({ email: 'buyer@example.com' });
  });

  it('falls back to an empty products list when no paykit metadata is present', () => {
    const checkout = Checkout$inboundSchema(
      { checkout_url: null, tx_ref: 'tx_2' },
      { currency: 'ETB', amount: 0, email: null, meta: null },
    );

    expect(checkout.products).toEqual([{ id: '', quantity: 1 }]);
    expect(checkout.customer).toBeNull();
    expect(checkout.payment_url).toBe('');
  });
});

describe('Payment$inboundSchema', () => {
  it('maps a successful Chapa transaction', () => {
    const payment = Payment$inboundSchema(
      transactionFixture('success', {
        meta: { __paykit: JSON.stringify({ item_id: 'item_9' }) },
      }),
    );

    expect(payment).toMatchObject({
      id: 'tx_1',
      amount: 400,
      currency: 'ETB',
      status: 'succeeded',
      item_id: 'item_9',
      customer: { email: 'buyer@example.com' },
      requires_action: false,
    });
  });

  it('maps a pending Chapa transaction and marks it as requiring action', () => {
    const payment = Payment$inboundSchema(
      transactionFixture('pending'),
    );
    expect(payment.status).toBe('pending');
    expect(payment.requires_action).toBe(true);
  });

  it('maps an unknown status to pending', () => {
    const payment = Payment$inboundSchema(
      transactionFixture('some_new_status'),
    );
    expect(payment.status).toBe('pending');
  });
});

describe('ChapaProvider HTTP operations', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createCheckout sends a JSON initialize request and returns the checkout url', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        message: 'ok',
        status: 'success',
        data: { checkout_url: 'https://checkout.chapa.co/xyz' },
      }),
    );

    const checkout = await makeProvider().createCheckout({
      customer: { email: 'buyer@example.com' },
      item_id: 'plan_pro',
      quantity: 1,
      session_type: 'one_time',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: null,
      provider_metadata: { amount: '400', currency: 'etb' },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe(
      'https://api.chapa.co/v1/transaction/initialize',
    );
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['Authorization']).toBe(`Bearer ${SECRET}`);

    const body = JSON.parse(options.body as string);
    expect(body.amount).toBe('400');
    expect(body.currency).toBe('ETB');
    expect(body.email).toBe('buyer@example.com');
    expect(typeof body.tx_ref).toBe('string');
    expect(body.return_url).toBe('https://example.com/success');
    expect(body.meta.__paykit).toBeDefined();

    expect(checkout.payment_url).toBe(
      'https://checkout.chapa.co/xyz',
    );
    expect(checkout.currency).toBe('ETB');
    expect(checkout.amount).toBe(400);
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
        provider_metadata: { amount: '400', currency: 'ETB' },
      } as never),
    ).rejects.toThrow(InvalidTypeError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createPayment sends amount/currency directly and returns a pending payment', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        message: 'ok',
        status: 'success',
        data: { checkout_url: 'https://checkout.chapa.co/pay' },
      }),
    );

    const payment = await makeProvider().createPayment({
      customer: { email: 'buyer@example.com' },
      amount: 400,
      currency: 'ETB',
      item_id: 'item_1',
      capture_method: 'automatic',
    } as never);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);

    expect(body.amount).toBe('400');
    expect(body.currency).toBe('ETB');
    expect(payment.status).toBe('pending');
    expect(payment.payment_url).toBe('https://checkout.chapa.co/pay');
    expect(payment.requires_action).toBe(true);
  });

  it('retrievePayment verifies the transaction and maps the status', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        message: 'ok',
        status: 'success',
        data: transactionFixture('success'),
      }),
    );

    const payment = await makeProvider().retrievePayment('tx_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.chapa.co/v1/transaction/verify/tx_1',
    );
    expect(payment?.status).toBe('succeeded');
    expect(payment?.amount).toBe(400);
  });

  it('retrievePayment returns null when the transaction is not found', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'not found' }, 404),
    );

    const payment = await makeProvider().retrievePayment('missing');
    expect(payment).toBeNull();
  });

  it('cancelPayment verifies then cancels the transaction', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          message: 'ok',
          status: 'success',
          data: transactionFixture('pending'),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          message: 'cancelled',
          status: 'success',
          data: null,
        }),
      );

    const payment = await makeProvider().cancelPayment('tx_1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.chapa.co/v1/transaction/cancel/tx_1',
    );
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    expect(payment.status).toBe('canceled');
  });

  it('cancelPayment throws ResourceNotFoundError when the transaction does not exist', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'not found' }, 404),
    );

    await expect(
      makeProvider().cancelPayment('missing'),
    ).rejects.toThrow('not found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('deleteCheckout cancels the transaction and returns null', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        message: 'cancelled',
        status: 'success',
        data: null,
      }),
    );

    const result = await makeProvider().deleteCheckout('tx_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.chapa.co/v1/transaction/cancel/tx_1',
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(result).toBeNull();
  });

  it('createRefund sends a form-urlencoded request with bracketed meta keys', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        message: 'ok',
        status: 'success',
        data: {
          amount: 400,
          currency: 'ETB',
          ref_id: 'ref_1',
          payment_reference: 'tx_1',
          merchant_reference: null,
          status: 'initiated',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      }),
    );

    const refund = await makeProvider().createRefund({
      payment_id: 'tx_1',
      amount: 400,
      reason: 'requested_by_customer',
      metadata: { order_id: '123' },
    } as never);

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe('https://api.chapa.co/v1/refund/tx_1');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );

    const params = new URLSearchParams(options.body as string);
    expect(params.get('amount')).toBe('400');
    expect(params.get('reason')).toBe('requested_by_customer');
    expect(params.get('meta[order_id]')).toBe('123');

    expect(refund).toEqual({
      id: 'ref_1',
      amount: 400,
      currency: 'ETB',
      reason: 'requested_by_customer',
      metadata: null,
    });
  });

  it('createRefund falls back to request-time context when the response omits fields', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'ok', status: 'success', data: {} }),
    );

    const refund = await makeProvider().createRefund({
      payment_id: 'tx_1',
      amount: 400,
      reason: null,
      metadata: null,
    } as never);

    expect(refund).toEqual({
      id: 'tx_1',
      amount: 400,
      currency: 'ETB',
      reason: null,
      metadata: null,
    });
  });
});

describe('ChapaProvider.handleWebhook', () => {
  it('rejects when no webhook secret is configured', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), null),
    ).rejects.toThrow(WebhookError);
  });

  it('rejects when both signature headers are missing', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), SECRET),
    ).rejects.toThrow(
      'Missing chapa-signature or x-chapa-signature header',
    );
  });

  it('rejects an invalid x-chapa-signature', async () => {
    const payload = { event: 'charge.success', status: 'success' };
    const body = JSON.stringify(payload);

    await expect(
      makeProvider().handleWebhook(
        dto(body, {
          'x-chapa-signature': signPayload(payload, 'wrong_secret'),
        }),
        SECRET,
      ),
    ).rejects.toThrow('Invalid Chapa webhook signature');
  });

  it('rejects a payload that is not valid JSON', async () => {
    await expect(
      makeProvider().handleWebhook(
        dto('not-json', { 'x-chapa-signature': 'whatever' }),
        SECRET,
      ),
    ).rejects.toThrow('Invalid webhook payload: not valid JSON');
  });

  it('accepts a valid chapa-signature (HMAC of the secret itself)', async () => {
    const payload = {
      event: 'payout.success',
      status: 'success',
      reference: 'ref_1',
    };
    const body = JSON.stringify(payload);

    const events = await makeProvider().handleWebhook(
      dto(body, { 'chapa-signature': signSecret() }),
      SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'chapa.payout.success',
      is_raw: true,
    });
  });

  it('accepts a valid x-chapa-signature (HMAC of the payload)', async () => {
    const payload = {
      event: 'charge.success',
      status: 'success',
      tx_ref: 'tx_1',
    };
    const body = JSON.stringify(payload);

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-chapa-signature': signPayload(payload) }),
      SECRET,
    );

    expect(events.length).toBeGreaterThan(0);
  });

  it('maps charge.success to payment.updated + invoice.generated', async () => {
    const payload = {
      event: 'charge.success',
      ...transactionFixture('success'),
    };
    const body = JSON.stringify(payload);

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-chapa-signature': signPayload(payload) }),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'chapa.charge.success',
      'payment.updated',
      'invoice.generated',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'tx_1',
      status: 'succeeded',
      amount: 400,
    });
    expect(events[2].data).toMatchObject({
      amount_paid: 400,
      currency: 'ETB',
      status: 'paid',
    });
  });

  it('maps a failed charge to payment.failed regardless of the exact event string', async () => {
    const payload = {
      event: 'charge.failed/cancelled',
      ...transactionFixture('failed', { tx_ref: 'tx_2' }),
    };
    const body = JSON.stringify(payload);

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-chapa-signature': signPayload(payload) }),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'chapa.charge.failed/cancelled',
      'payment.failed',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'tx_2',
      status: 'failed',
    });
  });

  it('maps charge.refunded to refund.created', async () => {
    const payload = {
      event: 'charge.refunded',
      ...transactionFixture('refunded', {
        tx_ref: 'tx_4',
        amount: '150.00',
      }),
    };
    const body = JSON.stringify(payload);

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-chapa-signature': signPayload(payload) }),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'chapa.charge.refunded',
      'refund.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'tx_4',
      amount: 150,
      currency: 'ETB',
    });
  });

  it('maps charge.reversed to refund.created', async () => {
    const payload = {
      event: 'charge.reversed',
      ...transactionFixture('reversed', { tx_ref: 'tx_5' }),
    };
    const body = JSON.stringify(payload);

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-chapa-signature': signPayload(payload) }),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'chapa.charge.reversed',
      'refund.created',
    ]);
    expect(events[1].data).toMatchObject({ id: 'tx_5' });
  });

  it('emits only the raw event for an unrecognized, non-failed charge event', async () => {
    const payload = {
      event: 'charge.pending',
      ...transactionFixture('pending', { tx_ref: 'tx_3' }),
    };
    const body = JSON.stringify(payload);

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-chapa-signature': signPayload(payload) }),
      SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('chapa.charge.pending');
  });

  it('emits only the raw event for payout notifications', async () => {
    const payload = {
      event: 'payout.success',
      type: 'Payout',
      account_name: 'Test Recipient',
      account_number: '251900000000',
      bank_id: 1,
      bank_name: 'telebirr',
      amount: '2000.00',
      charge: '60.00',
      currency: 'ETB',
      status: 'success',
      reference: 'MYREF1',
      chapa_reference: 'chapa_ref_3',
      bank_reference: 'bank_ref_1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const body = JSON.stringify(payload);

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-chapa-signature': signPayload(payload) }),
      SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('chapa.payout.success');
  });
});
