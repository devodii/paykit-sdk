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
import { RazorpayProvider } from '../razorpay-provider';
import type {
  RazorpayCustomer,
  RazorpayPayment,
  RazorpayPaymentLink,
  RazorpayPlan,
  RazorpaySubscription,
} from '../schema';
import {
  Checkout$inboundSchema,
  Customer$inboundSchema,
  Invoice$inboundSchema,
  Payment$inboundSchema,
  Refund$inboundSchema,
  Subscription$inboundSchema,
} from '../utils/mapper';

const KEY_ID = 'rzp_test_abc123';
const KEY_SECRET = 'test_secret_xyz';
const WEBHOOK_SECRET = 'whsec_test_xyz';

const makeProvider = () =>
  new RazorpayProvider({
    keyId: KEY_ID,
    keySecret: KEY_SECRET,
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

const signBody = (body: string, secret = WEBHOOK_SECRET) =>
  createHmac('sha256', secret).update(body).digest('hex');

const paymentFixture = (
  extra: Partial<RazorpayPayment> = {},
): RazorpayPayment => ({
  id: 'pay_1',
  entity: 'payment',
  amount: 40000,
  currency: 'INR',
  status: 'captured',
  order_id: null,
  invoice_id: null,
  international: false,
  method: 'card',
  amount_refunded: 0,
  refund_status: null,
  captured: true,
  description: null,
  card_id: null,
  bank: null,
  wallet: null,
  vpa: null,
  email: 'buyer@example.com',
  contact: '+919876543210',
  notes: {},
  fee: null,
  tax: null,
  error_code: null,
  error_description: null,
  error_source: null,
  error_step: null,
  error_reason: null,
  acquirer_data: null,
  created_at: 1700000000,
  ...extra,
});

const paymentLinkFixture = (
  extra: Partial<RazorpayPaymentLink> = {},
): RazorpayPaymentLink => ({
  id: 'plink_1',
  entity: 'payment_link',
  amount: 40000,
  currency: 'INR',
  accept_partial: false,
  description: null,
  reference_id: null,
  customer: { email: 'buyer@example.com' },
  notify: {},
  reminder_enable: false,
  notes: {},
  status: 'created',
  short_url: 'https://rzp.io/i/abc123',
  order_id: null,
  expire_by: null,
  callback_url: null,
  callback_method: null,
  payments: null,
  created_at: 1700000000,
  ...extra,
});

const customerFixture = (
  extra: Partial<RazorpayCustomer> = {},
): RazorpayCustomer => ({
  id: 'cust_1',
  entity: 'customer',
  name: 'Buyer',
  email: 'buyer@example.com',
  contact: '+919876543210',
  gstin: null,
  notes: {},
  created_at: 1700000000,
  ...extra,
});

const planFixture = (
  extra: Partial<RazorpayPlan> = {},
): RazorpayPlan => ({
  id: 'plan_1',
  entity: 'plan',
  interval: 1,
  period: 'monthly',
  item: {
    id: 'item_1',
    active: true,
    name: 'Pro plan',
    description: null,
    amount: 49900,
    unit_amount: 49900,
    currency: 'INR',
    type: 'plan',
    unit: null,
    tax_inclusive: false,
    created_at: 1700000000,
    updated_at: 1700000000,
  },
  notes: {},
  created_at: 1700000000,
  ...extra,
});

const subscriptionFixture = (
  extra: Partial<RazorpaySubscription> = {},
): RazorpaySubscription => ({
  id: 'sub_1',
  entity: 'subscription',
  plan_id: 'plan_1',
  customer_id: null,
  status: 'created',
  current_start: null,
  current_end: null,
  ended_at: null,
  quantity: 1,
  notes: {},
  charge_at: null,
  start_at: null,
  end_at: null,
  auth_attempts: 0,
  total_count: 12,
  paid_count: 0,
  customer_notify: true,
  created_at: 1700000000,
  expire_by: null,
  short_url: 'https://rzp.io/i/sub123',
  has_scheduled_changes: false,
  change_scheduled_at: null,
  source: 'api',
  remaining_count: 12,
  ...extra,
});

describe('RazorpayProvider constructor', () => {
  it('throws ConfigurationError when credentials are missing', () => {
    expect(
      () => new RazorpayProvider({ isSandbox: true } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('razorpay');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('Payment$inboundSchema', () => {
  it('maps a captured payment', () => {
    const payment = Payment$inboundSchema(
      paymentFixture({
        notes: { __paykit: JSON.stringify({ item_id: 'item_9' }) },
      }),
    );

    expect(payment).toMatchObject({
      id: 'pay_1',
      amount: 40000,
      currency: 'INR',
      status: 'succeeded',
      item_id: 'item_9',
      customer: { email: 'buyer@example.com' },
      requires_action: false,
    });
  });

  it('maps a created payment to pending and requires_action', () => {
    const payment = Payment$inboundSchema(
      paymentFixture({ status: 'created' }),
    );
    expect(payment.status).toBe('pending');
    expect(payment.requires_action).toBe(true);
  });

  it('maps an authorized payment to requires_capture', () => {
    const payment = Payment$inboundSchema(
      paymentFixture({ status: 'authorized' }),
    );
    expect(payment.status).toBe('requires_capture');
  });

  it('maps a failed payment', () => {
    const payment = Payment$inboundSchema(
      paymentFixture({ status: 'failed' }),
    );
    expect(payment.status).toBe('failed');
  });

  it('uses the override payment url when provided', () => {
    const payment = Payment$inboundSchema(
      paymentFixture(),
      'https://rzp.io/i/xyz',
    );
    expect(payment.payment_url).toBe('https://rzp.io/i/xyz');
  });
});

describe('Checkout$inboundSchema', () => {
  it('recovers products and session type from paykit metadata', () => {
    const checkout = Checkout$inboundSchema(
      paymentLinkFixture({
        notes: {
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
    expect(checkout.payment_url).toBe('https://rzp.io/i/abc123');
    expect(checkout.customer).toEqual({ email: 'buyer@example.com' });
  });

  it('falls back to an empty products list when no paykit metadata is present', () => {
    const checkout = Checkout$inboundSchema(
      paymentLinkFixture({ customer: null, notes: {} }),
    );

    expect(checkout.products).toEqual([{ id: '', quantity: 1 }]);
    expect(checkout.customer).toBeNull();
  });
});

describe('Customer$inboundSchema', () => {
  it('maps a Razorpay customer', () => {
    const customer = Customer$inboundSchema(customerFixture());

    expect(customer).toMatchObject({
      id: 'cust_1',
      email: 'buyer@example.com',
      name: 'Buyer',
      phone: '+919876543210',
    });
    expect(customer.created_at).toBeInstanceOf(Date);
  });

  it('maps gstin into custom_fields, since it has no core equivalent', () => {
    const customer = Customer$inboundSchema(
      customerFixture({ gstin: '29AAAAA0000A1Z5' }),
    );

    expect(customer.custom_fields).toEqual({
      gstin: '29AAAAA0000A1Z5',
    });
  });
});

describe('Subscription$inboundSchema', () => {
  it('combines subscription and plan data', () => {
    const subscription = Subscription$inboundSchema(
      subscriptionFixture({
        customer_id: 'cust_1',
        status: 'active',
        current_start: 1700000000,
        current_end: 1702592000,
      }),
      planFixture(),
    );

    expect(subscription).toMatchObject({
      id: 'sub_1',
      customer: { id: 'cust_1' },
      amount: 49900,
      currency: 'INR',
      status: 'active',
      item_id: 'item_1',
      billing_interval: 'month',
      payment_url: 'https://rzp.io/i/sub123',
    });
  });

  it('maps quarterly plans to a monthly interval unit', () => {
    const subscription = Subscription$inboundSchema(
      subscriptionFixture(),
      planFixture({ period: 'quarterly' }),
    );
    expect(subscription.billing_interval).toBe('month');
  });

  it('maps unauthorized subscriptions to pending and requires_action', () => {
    const subscription = Subscription$inboundSchema(
      subscriptionFixture({ status: 'created' }),
      planFixture(),
    );
    expect(subscription.status).toBe('pending');
    expect(subscription.requires_action).toBe(true);
  });

  it('carries Razorpay-native counters into custom_fields', () => {
    const subscription = Subscription$inboundSchema(
      subscriptionFixture({
        total_count: 12,
        paid_count: 3,
        remaining_count: 9,
        source: 'api',
        has_scheduled_changes: true,
      }),
      planFixture(),
    );

    expect(subscription.custom_fields).toEqual({
      source: 'api',
      total_count: 12,
      paid_count: 3,
      remaining_count: 9,
      has_scheduled_changes: true,
    });
  });
});

describe('Refund$inboundSchema', () => {
  it('maps a Razorpay refund', () => {
    const refund = Refund$inboundSchema({
      id: 'rfnd_1',
      entity: 'refund',
      amount: 40000,
      receipt: null,
      currency: 'INR',
      payment_id: 'pay_1',
      notes: {},
      acquirer_data: { arn: null },
      created_at: 1700000000,
      batch_id: null,
      status: 'processed',
      speed_processed: 'normal',
      speed_requested: 'normal',
    });

    expect(refund).toEqual({
      id: 'rfnd_1',
      amount: 40000,
      currency: 'INR',
      reason: null,
      metadata: null,
    });
  });
});

describe('Invoice$inboundSchema', () => {
  it('builds an invoice from a captured payment, carrying native fields into custom_fields', () => {
    const invoice = Invoice$inboundSchema(
      paymentFixture({
        method: 'upi',
        vpa: 'buyer@upi',
        fee: 100,
        tax: 18,
      }),
    );

    expect(invoice).toMatchObject({
      id: 'pay_1',
      customer: { email: 'buyer@example.com' },
      billing_mode: 'one_time',
      amount_paid: 40000,
      currency: 'INR',
      status: 'paid',
    });
    expect(invoice.custom_fields).toMatchObject({
      method: 'upi',
      vpa: 'buyer@upi',
      fee: 100,
      tax: 18,
    });
  });
});

describe('RazorpayProvider HTTP operations', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const expectBasicAuth = (options: RequestInit) => {
    const expected = `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`;
    expect(
      (options.headers as Record<string, string>)['Authorization'],
    ).toBe(expected);
  };

  it('createCheckout sends a payment link request with basic auth', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(paymentLinkFixture()),
    );

    const checkout = await makeProvider().createCheckout({
      customer: { email: 'buyer@example.com' },
      item_id: 'plan_pro',
      quantity: 1,
      session_type: 'one_time',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: null,
      provider_metadata: { amount: '40000', currency: 'inr' },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe('https://api.razorpay.com/v1/payment_links/');
    expect(options.method).toBe('POST');
    expectBasicAuth(options);

    const body = JSON.parse(options.body as string);
    expect(body.amount).toBe(40000);
    expect(body.currency).toBe('INR');
    expect(body.customer.email).toBe('buyer@example.com');
    expect(body.callback_url).toBe('https://example.com/success');
    expect(body.callback_method).toBe('get');
    expect(body.notes.__paykit).toBeDefined();

    expect(checkout.payment_url).toBe('https://rzp.io/i/abc123');
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
        provider_metadata: { amount: '40000', currency: 'INR' },
      } as never),
    ).rejects.toThrow(InvalidTypeError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retrieveCheckout fetches the payment link', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(paymentLinkFixture()),
    );

    const checkout = await makeProvider().retrieveCheckout('plink_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.razorpay.com/v1/payment_links/plink_1',
    );
    expect(checkout?.payment_url).toBe('https://rzp.io/i/abc123');
  });

  it('retrieveCheckout returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'BAD_REQUEST_ERROR',
            description: 'not found',
          },
        },
        400,
      ),
    );

    const checkout = await makeProvider().retrieveCheckout('missing');
    expect(checkout).toBeNull();
  });

  it('deleteCheckout cancels the payment link', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(paymentLinkFixture({ status: 'cancelled' })),
    );

    const result = await makeProvider().deleteCheckout('plink_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.razorpay.com/v1/payment_links/plink_1/cancel',
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(result).toBeNull();
  });

  it('updateCheckout throws ProviderNotSupportedError', async () => {
    await expect(
      makeProvider().updateCheckout('plink_1', {} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
  });

  it('createCustomer posts name/email/contact', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(customerFixture()));

    const customer = await makeProvider().createCustomer({
      email: 'buyer@example.com',
      name: 'Buyer',
      phone: '+919876543210',
      billing: null,
    } as never);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.razorpay.com/v1/customers');

    const body = JSON.parse(options.body as string);
    expect(body.email).toBe('buyer@example.com');
    expect(body.contact).toBe('+919876543210');

    expect(customer.id).toBe('cust_1');
  });

  it('retrieveCustomer fetches by id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(customerFixture()));

    const customer = await makeProvider().retrieveCustomer('cust_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.razorpay.com/v1/customers/cust_1',
    );
    expect(customer?.email).toBe('buyer@example.com');
  });

  it('updateCustomer PUTs changed fields', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(customerFixture({ name: 'New Name' })),
    );

    const customer = await makeProvider().updateCustomer('cust_1', {
      name: 'New Name',
    } as never);

    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(customer.name).toBe('New Name');
  });

  it('deleteCustomer throws ProviderNotSupportedError (no delete API)', async () => {
    await expect(
      makeProvider().deleteCustomer('cust_1'),
    ).rejects.toThrow(ProviderNotSupportedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createSubscription fetches the plan then creates the subscription', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(planFixture()))
      .mockResolvedValueOnce(jsonResponse(subscriptionFixture()));

    const subscription = await makeProvider().createSubscription({
      customer: { email: 'buyer@example.com' },
      item_id: 'plan_1',
      quantity: 1,
      billing_interval: 'month',
      amount: 49900,
      currency: 'INR',
      metadata: null,
      provider_metadata: { total_count: 12 },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.razorpay.com/v1/plans/plan_1',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.razorpay.com/v1/subscriptions',
    );

    const body = JSON.parse(
      fetchMock.mock.calls[1][1].body as string,
    );
    expect(body.plan_id).toBe('plan_1');
    expect(body.total_count).toBe(12);

    expect(subscription.item_id).toBe('item_1');
    expect(subscription.customer).toBeNull();
  });

  it('createSubscription throws ValidationError when total_count/end_at are missing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(planFixture()));

    await expect(
      makeProvider().createSubscription({
        customer: { email: 'buyer@example.com' },
        item_id: 'plan_1',
        quantity: 1,
        billing_interval: 'month',
        amount: 49900,
        currency: 'INR',
        metadata: null,
      } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('retrieveSubscription fetches the subscription then its plan', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(subscriptionFixture()))
      .mockResolvedValueOnce(jsonResponse(planFixture()));

    const subscription =
      await makeProvider().retrieveSubscription('sub_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.razorpay.com/v1/subscriptions/sub_1',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.razorpay.com/v1/plans/plan_1',
    );
    expect(subscription?.amount).toBe(49900);
  });

  it('retrieveSubscription returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { description: 'not found' } }, 400),
    );

    const subscription =
      await makeProvider().retrieveSubscription('missing');
    expect(subscription).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cancelSubscription cancels then re-fetches the plan', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(subscriptionFixture({ status: 'cancelled' })),
      )
      .mockResolvedValueOnce(jsonResponse(planFixture()));

    const subscription =
      await makeProvider().cancelSubscription('sub_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.razorpay.com/v1/subscriptions/sub_1/cancel',
    );
    expect(subscription.status).toBe('canceled');
  });

  it('deleteSubscription delegates to cancelSubscription and returns null', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(subscriptionFixture({ status: 'cancelled' })),
      )
      .mockResolvedValueOnce(jsonResponse(planFixture()));

    const result = await makeProvider().deleteSubscription('sub_1');
    expect(result).toBeNull();
  });

  it('createPayment creates a payment link and returns a pending payment', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(paymentLinkFixture()),
    );

    const payment = await makeProvider().createPayment({
      customer: { email: 'buyer@example.com' },
      amount: 40000,
      currency: 'INR',
      item_id: 'item_1',
      capture_method: 'automatic',
      provider_metadata: {
        success_url: 'https://example.com/success',
      },
    } as never);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.callback_url).toBe('https://example.com/success');

    expect(payment.status).toBe('pending');
    expect(payment.payment_url).toBe('https://rzp.io/i/abc123');
  });

  it('createPayment throws ValidationError when success_url is missing from provider_metadata', async () => {
    await expect(
      makeProvider().createPayment({
        customer: { email: 'buyer@example.com' },
        amount: 40000,
        currency: 'INR',
        item_id: 'item_1',
        capture_method: 'automatic',
      } as never),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retrievePayment fetches and maps the payment', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(paymentFixture()));

    const payment = await makeProvider().retrievePayment('pay_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.razorpay.com/v1/payments/pay_1',
    );
    expect(payment?.status).toBe('succeeded');
  });

  it('retrievePayment returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { description: 'not found' } }, 404),
    );

    const payment = await makeProvider().retrievePayment('missing');
    expect(payment).toBeNull();
  });

  it('capturePayment retrieves the payment then captures with its currency', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(paymentFixture({ status: 'authorized' })),
      )
      .mockResolvedValueOnce(jsonResponse(paymentFixture()));

    const payment = await makeProvider().capturePayment('pay_1', {
      amount: 40000,
    });

    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.razorpay.com/v1/payments/pay_1/capture',
    );
    const body = JSON.parse(
      fetchMock.mock.calls[1][1].body as string,
    );
    expect(body).toEqual({ amount: 40000, currency: 'INR' });
    expect(payment.status).toBe('succeeded');
  });

  it('capturePayment throws ResourceNotFoundError when the payment does not exist', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { description: 'not found' } }, 404),
    );

    await expect(
      makeProvider().capturePayment('missing', { amount: 1 }),
    ).rejects.toThrow('not found');
  });

  it('cancelPayment throws ProviderNotSupportedError', async () => {
    await expect(
      makeProvider().cancelPayment('pay_1'),
    ).rejects.toThrow(ProviderNotSupportedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('updatePayment/deletePayment throw ProviderNotSupportedError', async () => {
    await expect(
      makeProvider().updatePayment('pay_1', {} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(
      makeProvider().deletePayment('pay_1'),
    ).rejects.toThrow(ProviderNotSupportedError);
  });

  it('createRefund posts amount and notes', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'rfnd_1',
        entity: 'refund',
        amount: 40000,
        receipt: null,
        currency: 'INR',
        payment_id: 'pay_1',
        notes: {},
        acquirer_data: { arn: null },
        created_at: 1700000000,
        batch_id: null,
        status: 'processed',
        speed_processed: 'normal',
        speed_requested: 'normal',
      }),
    );

    const refund = await makeProvider().createRefund({
      payment_id: 'pay_1',
      amount: 40000,
      reason: 'requested_by_customer',
      metadata: { order_id: '123' },
    } as never);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.razorpay.com/v1/payments/pay_1/refund',
    );

    const body = JSON.parse(options.body as string);
    expect(body.amount).toBe(40000);
    expect(body.notes.reason).toBe('requested_by_customer');
    expect(body.notes.order_id).toBe('123');

    expect(refund).toEqual({
      id: 'rfnd_1',
      amount: 40000,
      currency: 'INR',
      reason: null,
      metadata: null,
    });
  });
});

describe('RazorpayProvider.handleWebhook', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const eventBody = (
    event: string,
    payload: Record<string, unknown>,
  ) =>
    JSON.stringify({
      entity: 'event',
      account_id: 'acc_1',
      event,
      contains: Object.keys(payload),
      payload,
      created_at: 1700000000,
    });

  it('rejects when no webhook secret is configured', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), null),
    ).rejects.toThrow(WebhookError);
  });

  it('rejects when the signature header is missing', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), WEBHOOK_SECRET),
    ).rejects.toThrow('Missing x-razorpay-signature header');
  });

  it('rejects an invalid signature', async () => {
    const body = eventBody('payment.captured', {
      payment: { entity: paymentFixture() },
    });

    await expect(
      makeProvider().handleWebhook(
        dto(body, {
          'x-razorpay-signature': signBody(body, 'wrong_secret'),
        }),
        WEBHOOK_SECRET,
      ),
    ).rejects.toThrow('Invalid Razorpay webhook signature');
  });

  it('rejects a payload that is not valid JSON', async () => {
    await expect(
      makeProvider().handleWebhook(
        dto('not-json', {
          'x-razorpay-signature': signBody('not-json'),
        }),
        WEBHOOK_SECRET,
      ),
    ).rejects.toThrow('Invalid webhook payload: not valid JSON');
  });

  it('maps payment.authorized to payment.updated', async () => {
    const body = eventBody('payment.authorized', {
      payment: { entity: paymentFixture({ status: 'authorized' }) },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'razorpay.payment.authorized',
      'payment.updated',
    ]);
    expect(events[1].data).toMatchObject({
      status: 'requires_capture',
    });
  });

  it('maps payment.captured to payment.succeeded + invoice.generated', async () => {
    const body = eventBody('payment.captured', {
      payment: { entity: paymentFixture() },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'razorpay.payment.captured',
      'payment.succeeded',
      'invoice.generated',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'pay_1',
      status: 'succeeded',
      amount: 40000,
    });
    expect(events[2].data).toMatchObject({
      amount_paid: 40000,
      currency: 'INR',
      status: 'paid',
    });
  });

  it('maps payment.failed to payment.failed', async () => {
    const body = eventBody('payment.failed', {
      payment: { entity: paymentFixture({ status: 'failed' }) },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'razorpay.payment.failed',
      'payment.failed',
    ]);
  });

  it('maps order.paid to payment.succeeded + invoice.generated', async () => {
    const body = eventBody('order.paid', {
      payment: { entity: paymentFixture() },
      order: {
        entity: {
          id: 'order_1',
          entity: 'order',
          amount: 40000,
          amount_paid: 40000,
          amount_due: 0,
          currency: 'INR',
          receipt: null,
          offer_id: null,
          status: 'paid',
          attempts: 1,
          notes: {},
          created_at: 1700000000,
        },
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'razorpay.order.paid',
      'payment.succeeded',
      'invoice.generated',
    ]);
  });

  it('maps refund.created to refund.created', async () => {
    const body = eventBody('refund.created', {
      refund: {
        entity: {
          id: 'rfnd_1',
          entity: 'refund',
          amount: 40000,
          receipt: null,
          currency: 'INR',
          payment_id: 'pay_1',
          notes: {},
          acquirer_data: { arn: null },
          created_at: 1700000000,
          batch_id: null,
          status: 'pending',
          speed_processed: null,
          speed_requested: 'normal',
        },
      },
      payment: { entity: paymentFixture() },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'razorpay.refund.created',
      'refund.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'rfnd_1',
      amount: 40000,
    });
  });

  it('maps refund.processed to refund.created', async () => {
    const body = eventBody('refund.processed', {
      refund: {
        entity: {
          id: 'rfnd_1',
          entity: 'refund',
          amount: 40000,
          receipt: null,
          currency: 'INR',
          payment_id: 'pay_1',
          notes: {},
          acquirer_data: { arn: 'arn123' },
          created_at: 1700000000,
          batch_id: null,
          status: 'processed',
          speed_processed: 'normal',
          speed_requested: 'normal',
        },
      },
      payment: { entity: paymentFixture() },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'razorpay.refund.processed',
      'refund.created',
    ]);
  });

  it('maps payment_link.paid to payment.succeeded', async () => {
    const body = eventBody('payment_link.paid', {
      payment_link: {
        entity: paymentLinkFixture({ status: 'paid' }),
      },
      payment: { entity: paymentFixture() },
      order: {
        entity: {
          id: 'order_1',
          entity: 'order',
          amount: 40000,
          amount_paid: 40000,
          amount_due: 0,
          currency: 'INR',
          receipt: null,
          offer_id: null,
          status: 'paid',
          attempts: 1,
          notes: {},
          created_at: 1700000000,
        },
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'razorpay.payment_link.paid',
      'payment.succeeded',
    ]);
    expect(events[1].data).toMatchObject({
      payment_url: 'https://rzp.io/i/abc123',
    });
  });

  it('emits only the raw event for payment_link.cancelled', async () => {
    const body = eventBody('payment_link.cancelled', {
      payment_link: {
        entity: paymentLinkFixture({ status: 'cancelled' }),
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('razorpay.payment_link.cancelled');
  });

  it('maps subscription.charged to payment.succeeded + invoice.generated', async () => {
    const body = eventBody('subscription.charged', {
      payment: { entity: paymentFixture() },
      subscription: {
        entity: subscriptionFixture({ status: 'active' }),
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'razorpay.subscription.charged',
      'payment.succeeded',
      'invoice.generated',
    ]);
  });

  it('maps subscription.activated to subscription.updated, fetching the plan', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(planFixture()));

    const body = eventBody('subscription.activated', {
      subscription: {
        entity: subscriptionFixture({ status: 'active' }),
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.razorpay.com/v1/plans/plan_1',
    );
    expect(events.map(e => e.type)).toEqual([
      'razorpay.subscription.activated',
      'subscription.updated',
    ]);
    expect(events[1].data).toMatchObject({
      status: 'active',
      item_id: 'item_1',
    });
  });

  it('maps subscription.cancelled to subscription.canceled, fetching the plan', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(planFixture()));

    const body = eventBody('subscription.cancelled', {
      subscription: {
        entity: subscriptionFixture({ status: 'cancelled' }),
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'razorpay.subscription.cancelled',
      'subscription.canceled',
    ]);
  });

  it('emits only the raw event for subscription.pending', async () => {
    const body = eventBody('subscription.pending', {
      subscription: {
        entity: subscriptionFixture({ status: 'pending' }),
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('razorpay.subscription.pending');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emits only the raw event for an unrecognized event type', async () => {
    const body = eventBody('some.unknown.event', { foo: 'bar' });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-razorpay-signature': signBody(body) }),
      WEBHOOK_SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('razorpay.some.unknown.event');
  });
});
