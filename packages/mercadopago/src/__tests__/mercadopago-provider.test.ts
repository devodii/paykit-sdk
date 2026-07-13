import {
  ConfigurationError,
  InvalidTypeError,
  ProviderNotSupportedError,
  ValidationError,
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
import { MercadoPagoProvider } from '../mercadopago-provider';
import type {
  MercadoPagoCustomer,
  MercadoPagoPayment,
  MercadoPagoPreApproval,
  MercadoPagoPreference,
} from '../schema';
import {
  Checkout$inboundSchema,
  Customer$inboundSchema,
  Invoice$inboundSchema,
  Payment$inboundSchema,
  Refund$inboundSchema,
  Subscription$inboundSchema,
} from '../utils/mapper';

const ACCESS_TOKEN = 'TEST-abc123';
const WEBHOOK_SECRET = 'whsec_test_xyz';

const makeProvider = () =>
  new MercadoPagoProvider({
    accessToken: ACCESS_TOKEN,
    isSandbox: true,
    debug: false,
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const dto = (
  body: string,
  headers: Record<string, string> = {},
  dataId = '123456789',
) => ({
  body,
  headersAsObject: headers,
  fullUrl: `https://app.example.com/api/webhook?data.id=${dataId}&type=payment`,
});

const signHeader = (
  dataId: string,
  requestId: string,
  ts: string,
  secret = WEBHOOK_SECRET,
) => {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');
  return `ts=${ts},v1=${v1}`;
};

const paymentFixture = (
  extra: Partial<MercadoPagoPayment> = {},
): MercadoPagoPayment => ({
  id: 123456789,
  date_created: '2026-01-01T00:00:00.000Z',
  date_approved: '2026-01-01T00:05:00.000Z',
  status: 'approved',
  status_detail: 'accredited',
  currency_id: 'ARS',
  transaction_amount: 400,
  payer: { email: 'buyer@example.com' },
  metadata: {},
  payment_method_id: 'visa',
  payment_type_id: 'credit_card',
  installments: 1,
  refunds: [],
  ...extra,
});

const preferenceFixture = (
  extra: Partial<MercadoPagoPreference> = {},
): MercadoPagoPreference => ({
  id: 'pref_1',
  items: [
    {
      id: 'item_1',
      title: 'item_1',
      quantity: 1,
      unit_price: 400,
      currency_id: 'ARS',
    },
  ],
  payer: { email: 'buyer@example.com' },
  metadata: {},
  init_point: 'https://mercadopago.com/checkout/pref_1',
  sandbox_init_point:
    'https://sandbox.mercadopago.com/checkout/pref_1',
  ...extra,
});

const customerFixture = (
  extra: Partial<MercadoPagoCustomer> = {},
): MercadoPagoCustomer => ({
  id: 'cust_1',
  email: 'buyer@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  phone: { number: '5551234' },
  identification: { type: 'DNI', number: '12345678' },
  date_created: '2026-01-01T00:00:00.000Z',
  metadata: {},
  ...extra,
});

const preApprovalFixture = (
  extra: Partial<MercadoPagoPreApproval> = {},
): MercadoPagoPreApproval => ({
  id: 'sub_1',
  payer_email: 'buyer@example.com',
  status: 'authorized',
  auto_recurring: {
    frequency: 1,
    frequency_type: 'months',
    transaction_amount: 4990,
    currency_id: 'ARS',
  },
  init_point: 'https://mercadopago.com/subscribe/sub_1',
  preapproval_plan_id: 'plan_1',
  next_payment_date: '2026-02-01T00:00:00.000Z',
  ...extra,
});

describe('MercadoPagoProvider constructor', () => {
  it('throws ConfigurationError when credentials are missing', () => {
    expect(
      () => new MercadoPagoProvider({ isSandbox: true } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('mercadopago');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('Payment$inboundSchema', () => {
  it('maps an approved payment', () => {
    const payment = Payment$inboundSchema(
      paymentFixture({
        metadata: { __paykit: JSON.stringify({ item_id: 'item_9' }) },
      }),
    );

    expect(payment).toMatchObject({
      id: '123456789',
      amount: 400,
      currency: 'ARS',
      status: 'succeeded',
      item_id: 'item_9',
      customer: { email: 'buyer@example.com' },
      requires_action: false,
    });
  });

  it('maps a pending payment and marks it as requiring action', () => {
    const payment = Payment$inboundSchema(
      paymentFixture({ status: 'pending' }),
    );
    expect(payment.status).toBe('pending');
    expect(payment.requires_action).toBe(true);
  });

  it('maps rejected/authorized/refunded statuses', () => {
    expect(
      Payment$inboundSchema(paymentFixture({ status: 'rejected' }))
        .status,
    ).toBe('failed');
    expect(
      Payment$inboundSchema(paymentFixture({ status: 'authorized' }))
        .status,
    ).toBe('requires_capture');
    expect(
      Payment$inboundSchema(paymentFixture({ status: 'refunded' }))
        .status,
    ).toBe('succeeded');
  });
});

describe('Checkout$inboundSchema', () => {
  it('recovers products and session type from paykit metadata', () => {
    const checkout = Checkout$inboundSchema(
      preferenceFixture({
        metadata: {
          __paykit: JSON.stringify({
            item_id: 'item_9',
            quantity: 2,
            type: 'one_time',
          }),
        },
      }),
    );

    expect(checkout.products).toEqual([
      { id: 'item_9', quantity: 2 },
    ]);
    expect(checkout.session_type).toBe('one_time');
    expect(checkout.payment_url).toBe(
      'https://mercadopago.com/checkout/pref_1',
    );
    expect(checkout.customer).toEqual({ email: 'buyer@example.com' });
  });

  it('falls back to sandbox_init_point when init_point is absent', () => {
    const checkout = Checkout$inboundSchema(
      preferenceFixture({ init_point: undefined }),
    );
    expect(checkout.payment_url).toBe(
      'https://sandbox.mercadopago.com/checkout/pref_1',
    );
  });
});

describe('Customer$inboundSchema', () => {
  it('maps a Mercado Pago customer', () => {
    const customer = Customer$inboundSchema(customerFixture());

    expect(customer).toMatchObject({
      id: 'cust_1',
      email: 'buyer@example.com',
      name: 'Jane Doe',
      phone: '5551234',
    });
    expect(customer.custom_fields).toEqual({
      identification: { type: 'DNI', number: '12345678' },
    });
  });
});

describe('Subscription$inboundSchema', () => {
  it('maps amount/currency/interval directly from auto_recurring, no extra plan fetch needed', () => {
    const subscription = Subscription$inboundSchema(
      preApprovalFixture(),
    );

    expect(subscription).toMatchObject({
      id: 'sub_1',
      customer: { email: 'buyer@example.com' },
      amount: 4990,
      currency: 'ARS',
      status: 'active',
      item_id: 'plan_1',
      billing_interval: 'month',
      payment_url: 'https://mercadopago.com/subscribe/sub_1',
    });
  });

  it('recovers metadata JSON-encoded in external_reference', () => {
    const subscription = Subscription$inboundSchema(
      preApprovalFixture({
        external_reference: JSON.stringify({ order_id: '42' }),
      }),
    );
    expect(subscription.metadata).toEqual({ order_id: '42' });
  });

  it('maps pending subscriptions to pending and requires_action', () => {
    const subscription = Subscription$inboundSchema(
      preApprovalFixture({ status: 'pending' }),
    );
    expect(subscription.status).toBe('pending');
    expect(subscription.requires_action).toBe(true);
  });

  it('maps cancelled to canceled', () => {
    expect(
      Subscription$inboundSchema(
        preApprovalFixture({ status: 'cancelled' }),
      ).status,
    ).toBe('canceled');
  });
});

describe('Refund$inboundSchema', () => {
  it('backfills currency and reason from request-time context', () => {
    const refund = Refund$inboundSchema(
      {
        id: 1,
        payment_id: 123456789,
        amount: 400,
        status: 'approved',
        date_created: '2026-01-01T00:00:00.000Z',
      },
      { currency: 'ARS', reason: 'requested_by_customer' },
    );

    expect(refund).toEqual({
      id: '1',
      amount: 400,
      currency: 'ARS',
      reason: 'requested_by_customer',
      metadata: null,
    });
  });
});

describe('Invoice$inboundSchema', () => {
  it('builds an invoice from an approved payment, carrying native fields into custom_fields', () => {
    const invoice = Invoice$inboundSchema(paymentFixture());

    expect(invoice).toMatchObject({
      id: '123456789',
      customer: { email: 'buyer@example.com' },
      billing_mode: 'one_time',
      amount_paid: 400,
      currency: 'ARS',
      status: 'paid',
    });
    expect(invoice.custom_fields).toMatchObject({
      payment_method_id: 'visa',
      payment_type_id: 'credit_card',
      installments: 1,
    });
  });
});

describe('MercadoPagoProvider HTTP operations', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const expectBearerAuth = (options: RequestInit) => {
    expect(
      (options.headers as Record<string, string>)['Authorization'],
    ).toBe(`Bearer ${ACCESS_TOKEN}`);
  };

  it('createCheckout creates a preference with basic auth and back_urls', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(preferenceFixture()),
    );

    const checkout = await makeProvider().createCheckout({
      customer: { email: 'buyer@example.com' },
      item_id: 'plan_pro',
      quantity: 1,
      session_type: 'one_time',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: null,
      provider_metadata: { amount: '400', currency: 'ars' },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe(
      'https://api.mercadopago.com/checkout/preferences/',
    );
    expect(options.method).toBe('POST');
    expectBearerAuth(options);

    const body = JSON.parse(options.body as string);
    expect(body.items[0]).toMatchObject({
      id: 'plan_pro',
      unit_price: 400,
      currency_id: 'ARS',
    });
    expect(body.payer.email).toBe('buyer@example.com');
    expect(body.back_urls.success).toBe(
      'https://example.com/success',
    );
    expect(body.back_urls.failure).toBe('https://example.com/cancel');
    expect(body.auto_return).toBe('approved');
    expect(body.metadata.__paykit).toBeDefined();

    expect(checkout.payment_url).toBe(
      'https://mercadopago.com/checkout/pref_1',
    );
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
        provider_metadata: { amount: '400', currency: 'ARS' },
      } as never),
    ).rejects.toThrow(InvalidTypeError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retrieveCheckout fetches the preference', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(preferenceFixture()),
    );

    const checkout = await makeProvider().retrieveCheckout('pref_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.mercadopago.com/checkout/preferences/pref_1',
    );
    expect(checkout?.payment_url).toBe(
      'https://mercadopago.com/checkout/pref_1',
    );
  });

  it('retrieveCheckout returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { message: 'not found', error: 'not_found', status: 404 },
        404,
      ),
    );

    const checkout = await makeProvider().retrieveCheckout('missing');
    expect(checkout).toBeNull();
  });

  it('updateCheckout PUTs changed fields', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(preferenceFixture()),
    );

    await makeProvider().updateCheckout('pref_1', {
      metadata: { note: 'updated' },
    } as never);

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.mercadopago.com/checkout/preferences/pref_1',
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
  });

  it('updateCheckout throws ValidationError when no fields are provided', async () => {
    await expect(
      makeProvider().updateCheckout('pref_1', {} as never),
    ).rejects.toThrow(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deleteCheckout throws ProviderNotSupportedError', async () => {
    await expect(
      makeProvider().deleteCheckout('pref_1'),
    ).rejects.toThrow(ProviderNotSupportedError);
  });

  it('createCustomer posts first_name/last_name/phone', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(customerFixture()));

    const customer = await makeProvider().createCustomer({
      email: 'buyer@example.com',
      name: 'Jane Doe',
      phone: '5551234',
      billing: null,
    } as never);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/v1/customers');

    const body = JSON.parse(options.body as string);
    expect(body.email).toBe('buyer@example.com');
    expect(body.first_name).toBe('Jane');
    expect(body.last_name).toBe('Doe');
    expect(body.phone).toEqual({ number: '5551234' });

    expect(customer.id).toBe('cust_1');
  });

  it('retrieveCustomer fetches by id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(customerFixture()));

    const customer = await makeProvider().retrieveCustomer('cust_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.mercadopago.com/v1/customers/cust_1',
    );
    expect(customer?.email).toBe('buyer@example.com');
  });

  it('updateCustomer PUTs changed fields', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(customerFixture({ first_name: 'New' })),
    );

    const customer = await makeProvider().updateCustomer('cust_1', {
      name: 'New Name',
    } as never);

    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(customer.name).toContain('New');
  });

  it('deleteCustomer sends a DELETE request', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(customerFixture()));

    const result = await makeProvider().deleteCustomer('cust_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.mercadopago.com/v1/customers/cust_1',
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    expect(result).toBeNull();
  });

  it('createSubscription references a preapproval_plan_id and returns amount/currency from auto_recurring', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(preApprovalFixture()),
    );

    const subscription = await makeProvider().createSubscription({
      customer: { email: 'buyer@example.com' },
      item_id: 'plan_1',
      quantity: 1,
      billing_interval: 'month',
      amount: 4990,
      currency: 'ARS',
      metadata: null,
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/preapproval/');

    const body = JSON.parse(options.body as string);
    expect(body.preapproval_plan_id).toBe('plan_1');
    expect(body.payer_email).toBe('buyer@example.com');

    expect(subscription.item_id).toBe('plan_1');
    expect(subscription.amount).toBe(4990);
  });

  it('createSubscription throws InvalidTypeError for an id-based customer', async () => {
    await expect(
      makeProvider().createSubscription({
        customer: { id: 'cus_1' },
        item_id: 'plan_1',
        quantity: 1,
        billing_interval: 'month',
        amount: 4990,
        currency: 'ARS',
        metadata: null,
      } as never),
    ).rejects.toThrow(InvalidTypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retrieveSubscription fetches the preapproval only, no extra plan call', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(preApprovalFixture()),
    );

    const subscription =
      await makeProvider().retrieveSubscription('sub_1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.mercadopago.com/preapproval/sub_1',
    );
    expect(subscription?.amount).toBe(4990);
  });

  it('retrieveSubscription returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { message: 'not found', error: 'not_found', status: 404 },
        404,
      ),
    );

    const subscription =
      await makeProvider().retrieveSubscription('missing');
    expect(subscription).toBeNull();
  });

  it('updateSubscription PUTs external_reference-encoded metadata', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(preApprovalFixture()),
    );

    await makeProvider().updateSubscription('sub_1', {
      metadata: { order_id: '42' },
    } as never);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/preapproval/sub_1');
    const body = JSON.parse(options.body as string);
    expect(JSON.parse(body.external_reference)).toEqual({
      order_id: '42',
    });
  });

  it('updateSubscription throws ValidationError when no fields are provided', async () => {
    await expect(
      makeProvider().updateSubscription('sub_1', {} as never),
    ).rejects.toThrow(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cancelSubscription PUTs status cancelled', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(preApprovalFixture({ status: 'cancelled' })),
    );

    const subscription =
      await makeProvider().cancelSubscription('sub_1');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/preapproval/sub_1');
    expect(JSON.parse(options.body as string)).toEqual({
      status: 'cancelled',
    });
    expect(subscription.status).toBe('canceled');
  });

  it('deleteSubscription delegates to cancelSubscription and returns null', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(preApprovalFixture({ status: 'cancelled' })),
    );

    const result = await makeProvider().deleteSubscription('sub_1');
    expect(result).toBeNull();
  });

  it('createPayment creates a preference and returns a pending payment', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(preferenceFixture()),
    );

    const payment = await makeProvider().createPayment({
      customer: { email: 'buyer@example.com' },
      amount: 400,
      currency: 'ARS',
      item_id: 'item_1',
      capture_method: 'automatic',
      provider_metadata: {
        success_url: 'https://example.com/success',
      },
    } as never);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.back_urls.success).toBe(
      'https://example.com/success',
    );

    expect(payment.status).toBe('pending');
    expect(payment.payment_url).toBe(
      'https://mercadopago.com/checkout/pref_1',
    );
  });

  it('createPayment throws ValidationError when success_url is missing from provider_metadata', async () => {
    await expect(
      makeProvider().createPayment({
        customer: { email: 'buyer@example.com' },
        amount: 400,
        currency: 'ARS',
        item_id: 'item_1',
        capture_method: 'automatic',
      } as never),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retrievePayment fetches and maps the payment', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paymentFixture()));

    const payment = await makeProvider().retrievePayment('123456789');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.mercadopago.com/v1/payments/123456789',
    );
    expect(payment?.status).toBe('succeeded');
  });

  it('retrievePayment returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { message: 'not found', error: 'not_found', status: 404 },
        404,
      ),
    );

    const payment = await makeProvider().retrievePayment('missing');
    expect(payment).toBeNull();
  });

  it('capturePayment PUTs capture:true with the requested amount', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(paymentFixture({ captured: true })),
    );

    const payment = await makeProvider().capturePayment('123456789', {
      amount: 400,
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.mercadopago.com/v1/payments/123456789',
    );
    expect(JSON.parse(options.body as string)).toEqual({
      capture: true,
      transaction_amount: 400,
    });
    expect(payment.status).toBe('succeeded');
  });

  it('cancelPayment PUTs status cancelled', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(paymentFixture({ status: 'cancelled' })),
    );

    const payment = await makeProvider().cancelPayment('123456789');

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body as string)).toEqual({
      status: 'cancelled',
    });
    expect(payment.status).toBe('canceled');
  });

  it('updatePayment/deletePayment throw ProviderNotSupportedError', async () => {
    await expect(
      makeProvider().updatePayment('123456789', {} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(
      makeProvider().deletePayment('123456789'),
    ).rejects.toThrow(ProviderNotSupportedError);
  });

  it('createRefund fetches the payment for currency context, then creates the refund', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(paymentFixture()))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 1,
          payment_id: 123456789,
          amount: 400,
          status: 'approved',
          date_created: '2026-01-01T00:00:00.000Z',
        }),
      );

    const refund = await makeProvider().createRefund({
      payment_id: '123456789',
      amount: 400,
      reason: 'requested_by_customer',
      metadata: null,
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.mercadopago.com/v1/payments/123456789',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.mercadopago.com/v1/payments/123456789/refunds',
    );

    const body = JSON.parse(
      fetchMock.mock.calls[1][1].body as string,
    );
    expect(body.amount).toBe(400);

    expect(refund).toEqual({
      id: '1',
      amount: 400,
      currency: 'ARS',
      reason: 'requested_by_customer',
      metadata: null,
    });
  });
});

describe('MercadoPagoProvider.handleWebhook', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const eventBody = (type: string, action: string, dataId: string) =>
    JSON.stringify({
      id: 555,
      live_mode: false,
      type,
      date_created: '2026-01-01T00:00:00.000Z',
      user_id: 999,
      api_version: 'v1',
      action,
      data: { id: dataId },
    });

  it('rejects when no webhook secret is configured', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), null),
    ).rejects.toThrow(WebhookError);
  });

  it('rejects when the signature header is missing', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), WEBHOOK_SECRET),
    ).rejects.toThrow('Missing x-signature header');
  });

  it('rejects a malformed signature header', async () => {
    await expect(
      makeProvider().handleWebhook(
        dto('{}', { 'x-signature': 'not-a-valid-header' }),
        WEBHOOK_SECRET,
      ),
    ).rejects.toThrow('Malformed x-signature header');
  });

  it('rejects an invalid signature', async () => {
    const body = eventBody('payment', 'payment.created', '123456789');

    await expect(
      makeProvider().handleWebhook(
        dto(body, {
          'x-signature': signHeader(
            '123456789',
            'req_1',
            '1700000000000',
            'wrong_secret',
          ),
          'x-request-id': 'req_1',
        }),
        WEBHOOK_SECRET,
      ),
    ).rejects.toThrow('Invalid Mercado Pago webhook signature');
  });

  it('rejects a payload that is not valid JSON', async () => {
    const signature = signHeader(
      '123456789',
      'req_1',
      '1700000000000',
    );

    await expect(
      makeProvider().handleWebhook(
        dto('not-json', {
          'x-signature': signature,
          'x-request-id': 'req_1',
        }),
        WEBHOOK_SECRET,
      ),
    ).rejects.toThrow('Invalid webhook payload: not valid JSON');
  });

  it('accepts a valid signature and emits the raw event', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paymentFixture()));

    const body = eventBody('payment', 'payment.created', '123456789');
    const signature = signHeader(
      '123456789',
      'req_1',
      '1700000000000',
    );

    const events = await makeProvider().handleWebhook(
      dto(body, {
        'x-signature': signature,
        'x-request-id': 'req_1',
      }),
      WEBHOOK_SECRET,
    );

    expect(events[0]).toMatchObject({
      type: 'mercadopago.payment.created',
      is_raw: true,
    });
  });

  it('maps payment.created to payment.created', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(paymentFixture({ status: 'pending' })),
    );

    const body = eventBody('payment', 'payment.created', '123456789');
    const signature = signHeader(
      '123456789',
      'req_1',
      '1700000000000',
    );

    const events = await makeProvider().handleWebhook(
      dto(body, {
        'x-signature': signature,
        'x-request-id': 'req_1',
      }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'mercadopago.payment.created',
      'payment.created',
    ]);
  });

  it('maps payment.updated (approved) to payment.succeeded + invoice.generated', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paymentFixture()));

    const body = eventBody('payment', 'payment.updated', '123456789');
    const signature = signHeader(
      '123456789',
      'req_1',
      '1700000000000',
    );

    const events = await makeProvider().handleWebhook(
      dto(body, {
        'x-signature': signature,
        'x-request-id': 'req_1',
      }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'mercadopago.payment.updated',
      'payment.succeeded',
      'invoice.generated',
    ]);
  });

  it('maps payment.updated (rejected) to payment.failed', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(paymentFixture({ status: 'rejected' })),
    );

    const body = eventBody('payment', 'payment.updated', '123456789');
    const signature = signHeader(
      '123456789',
      'req_1',
      '1700000000000',
    );

    const events = await makeProvider().handleWebhook(
      dto(body, {
        'x-signature': signature,
        'x-request-id': 'req_1',
      }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'mercadopago.payment.updated',
      'payment.failed',
    ]);
  });

  it('maps payment.updated (refunded) to refund.created using the latest refund', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        paymentFixture({
          status: 'refunded',
          refunds: [
            {
              id: 1,
              payment_id: 123456789,
              amount: 400,
              status: 'approved',
              date_created: '2026-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
    );

    const body = eventBody('payment', 'payment.updated', '123456789');
    const signature = signHeader(
      '123456789',
      'req_1',
      '1700000000000',
    );

    const events = await makeProvider().handleWebhook(
      dto(body, {
        'x-signature': signature,
        'x-request-id': 'req_1',
      }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'mercadopago.payment.updated',
      'refund.created',
    ]);
    expect(events[1].data).toMatchObject({ id: '1', amount: 400 });
  });

  it('maps subscription_preapproval.created to subscription.created', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(preApprovalFixture({ status: 'pending' })),
    );

    const body = eventBody(
      'subscription_preapproval',
      'subscription_preapproval.created',
      'sub_1',
    );
    const signature = signHeader('sub_1', 'req_1', '1700000000000');

    const events = await makeProvider().handleWebhook(
      dto(
        body,
        {
          'x-signature': signature,
          'x-request-id': 'req_1',
        },
        'sub_1',
      ),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'mercadopago.subscription_preapproval.created',
      'subscription.created',
    ]);
  });

  it('maps subscription_preapproval.updated (cancelled) to subscription.canceled', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(preApprovalFixture({ status: 'cancelled' })),
    );

    const body = eventBody(
      'subscription_preapproval',
      'subscription_preapproval.updated',
      'sub_1',
    );
    const signature = signHeader('sub_1', 'req_1', '1700000000000');

    const events = await makeProvider().handleWebhook(
      dto(
        body,
        {
          'x-signature': signature,
          'x-request-id': 'req_1',
        },
        'sub_1',
      ),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'mercadopago.subscription_preapproval.updated',
      'subscription.canceled',
    ]);
  });

  it('maps subscription_preapproval.updated (still authorized) to subscription.updated', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(preApprovalFixture()),
    );

    const body = eventBody(
      'subscription_preapproval',
      'subscription_preapproval.updated',
      'sub_1',
    );
    const signature = signHeader('sub_1', 'req_1', '1700000000000');

    const events = await makeProvider().handleWebhook(
      dto(
        body,
        {
          'x-signature': signature,
          'x-request-id': 'req_1',
        },
        'sub_1',
      ),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'mercadopago.subscription_preapproval.updated',
      'subscription.updated',
    ]);
  });

  it('maps subscription_authorized_payment (approved) to payment.succeeded + invoice.generated', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: 9001,
          type: 'scheduled',
          preapproval_id: 'sub_1',
          currency_id: 'ARS',
          transaction_amount: '49.90',
          status: 'processed',
          payment: {
            id: 123456789,
            status: 'approved',
            status_detail: 'accredited',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(paymentFixture()));

    const body = eventBody(
      'subscription_authorized_payment',
      'subscription_authorized_payment.created',
      '9001',
    );
    const signature = signHeader('9001', 'req_1', '1700000000000');

    const events = await makeProvider().handleWebhook(
      dto(
        body,
        {
          'x-signature': signature,
          'x-request-id': 'req_1',
        },
        '9001',
      ),
      WEBHOOK_SECRET,
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.mercadopago.com/authorized_payments/9001',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.mercadopago.com/v1/payments/123456789',
    );
    expect(events.map(e => e.type)).toEqual([
      'mercadopago.subscription_authorized_payment.created',
      'payment.succeeded',
      'invoice.generated',
    ]);
  });

  it('maps subscription_authorized_payment (rejected) to payment.failed', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: 9001,
          type: 'scheduled',
          preapproval_id: 'sub_1',
          currency_id: 'ARS',
          transaction_amount: '49.90',
          status: 'error',
          payment: {
            id: 123456789,
            status: 'rejected',
            status_detail: 'cc_rejected_insufficient_amount',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(paymentFixture({ status: 'rejected' })),
      );

    const body = eventBody(
      'subscription_authorized_payment',
      'subscription_authorized_payment.updated',
      '9001',
    );
    const signature = signHeader('9001', 'req_1', '1700000000000');

    const events = await makeProvider().handleWebhook(
      dto(
        body,
        {
          'x-signature': signature,
          'x-request-id': 'req_1',
        },
        '9001',
      ),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'mercadopago.subscription_authorized_payment.updated',
      'payment.failed',
    ]);
  });

  it('emits only the raw event for a still-scheduled authorized payment', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 9001,
        type: 'scheduled',
        preapproval_id: 'sub_1',
        currency_id: 'ARS',
        transaction_amount: '49.90',
        status: 'scheduled',
        payment: {
          id: 123456789,
          status: 'pending',
        },
      }),
    );

    const body = eventBody(
      'subscription_authorized_payment',
      'subscription_authorized_payment.created',
      '9001',
    );
    const signature = signHeader('9001', 'req_1', '1700000000000');

    const events = await makeProvider().handleWebhook(
      dto(
        body,
        {
          'x-signature': signature,
          'x-request-id': 'req_1',
        },
        '9001',
      ),
      WEBHOOK_SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(
      'mercadopago.subscription_authorized_payment.created',
    );
  });

  it('emits only the raw event for subscription_preapproval_plan notifications', async () => {
    const body = eventBody(
      'subscription_preapproval_plan',
      'subscription_preapproval_plan.created',
      'plan_1',
    );
    const signature = signHeader('plan_1', 'req_1', '1700000000000');

    const events = await makeProvider().handleWebhook(
      dto(
        body,
        {
          'x-signature': signature,
          'x-request-id': 'req_1',
        },
        'plan_1',
      ),
      WEBHOOK_SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(
      'mercadopago.subscription_preapproval_plan.created',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emits only the raw event for an unrecognized notification type', async () => {
    const body = eventBody('point_integration_wh', 'created', 'abc');
    const signature = signHeader('abc', 'req_1', '1700000000000');

    const events = await makeProvider().handleWebhook(
      dto(
        body,
        {
          'x-signature': signature,
          'x-request-id': 'req_1',
        },
        'abc',
      ),
      WEBHOOK_SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('mercadopago.created');
  });
});
