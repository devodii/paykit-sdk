import {
  ConfigurationError,
  InvalidTypeError,
  ProviderNotSupportedError,
  ValidationError,
  WebhookError,
} from '@paykit-sdk/core';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  XenditCustomer,
  XenditInvoice,
  XenditRecurringPlan,
} from '../schema';
import {
  Checkout$inboundSchema,
  Customer$inboundSchema,
  Invoice$inboundSchema,
  Payment$inboundSchema,
  Refund$inboundSchema,
  Subscription$inboundSchema,
} from '../utils/mapper';
import { XenditProvider } from '../xendit-provider';

const SECRET_KEY = 'xnd_development_abc123';
const CALLBACK_TOKEN = 'callback_token_xyz';

const makeProvider = () =>
  new XenditProvider({
    secretKey: SECRET_KEY,
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

const invoiceFixture = (
  extra: Partial<XenditInvoice> = {},
): XenditInvoice => ({
  id: 'inv_1',
  external_id: 'ext_1',
  user_id: 'user_1',
  status: 'PENDING',
  amount: 400,
  currency: 'IDR',
  payer_email: 'buyer@example.com',
  metadata: {},
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-01T00:00:00.000Z',
  expiry_date: '2026-01-02T00:00:00.000Z',
  invoice_url: 'https://checkout.xendit.co/web/inv_1',
  ...extra,
});

const customerFixture = (
  extra: Partial<XenditCustomer> = {},
): XenditCustomer => ({
  id: 'cust_1',
  reference_id: 'ref_1',
  type: 'INDIVIDUAL',
  individual_detail: { given_names: 'Jane', surname: 'Doe' },
  email: 'buyer@example.com',
  mobile_number: '5551234',
  metadata: {},
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const recurringPlanFixture = (
  extra: Partial<XenditRecurringPlan> = {},
): XenditRecurringPlan => ({
  id: 'repl_1',
  reference_id: 'ref_1',
  customer_id: 'cust_1',
  currency: 'IDR',
  amount: 50000,
  status: 'ACTIVE',
  schedule: {
    interval: 'MONTH',
    interval_count: 1,
    anchor_date: '2026-01-01T00:00:00.000Z',
  },
  payment_tokens: [{ payment_token_id: 'pt_1', rank: 1 }],
  description: 'plan_pro',
  metadata: {},
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-01T00:00:00.000Z',
  ...extra,
});

describe('XenditProvider constructor', () => {
  it('throws ConfigurationError when secretKey is missing', () => {
    expect(
      () => new XenditProvider({ isSandbox: true } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('xendit');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('Payment$inboundSchema', () => {
  it('maps a paid invoice', () => {
    const payment = Payment$inboundSchema(
      invoiceFixture({
        status: 'PAID',
        metadata: { __paykit: JSON.stringify({ item_id: 'item_9' }) },
      }),
    );

    expect(payment).toMatchObject({
      id: 'inv_1',
      amount: 400,
      currency: 'IDR',
      status: 'succeeded',
      item_id: 'item_9',
      customer: { email: 'buyer@example.com' },
      requires_action: false,
    });
  });

  it('maps a pending invoice and marks it as requiring action', () => {
    const payment = Payment$inboundSchema(invoiceFixture());
    expect(payment.status).toBe('pending');
    expect(payment.requires_action).toBe(true);
  });

  it('maps settled to succeeded and expired to canceled', () => {
    expect(
      Payment$inboundSchema(invoiceFixture({ status: 'SETTLED' }))
        .status,
    ).toBe('succeeded');
    expect(
      Payment$inboundSchema(invoiceFixture({ status: 'EXPIRED' }))
        .status,
    ).toBe('canceled');
  });
});

describe('Checkout$inboundSchema', () => {
  it('recovers products and session type from paykit metadata', () => {
    const checkout = Checkout$inboundSchema(
      invoiceFixture({
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
      'https://checkout.xendit.co/web/inv_1',
    );
    expect(checkout.customer).toEqual({ email: 'buyer@example.com' });
  });
});

describe('Customer$inboundSchema', () => {
  it('maps a Xendit customer', () => {
    const customer = Customer$inboundSchema(customerFixture());

    expect(customer).toMatchObject({
      id: 'cust_1',
      email: 'buyer@example.com',
      name: 'Jane Doe',
      phone: '5551234',
    });
    expect(customer.custom_fields).toEqual({ type: 'INDIVIDUAL' });
  });
});

describe('Subscription$inboundSchema', () => {
  it('maps amount/currency/interval directly from the plan resource', () => {
    const subscription = Subscription$inboundSchema(
      recurringPlanFixture(),
    );

    expect(subscription).toMatchObject({
      id: 'repl_1',
      customer: { id: 'cust_1' },
      amount: 50000,
      currency: 'IDR',
      status: 'active',
      item_id: 'plan_pro',
      billing_interval: 'month',
    });
  });

  it('maps INACTIVE to canceled and ACTIVE to active', () => {
    expect(
      Subscription$inboundSchema(
        recurringPlanFixture({ status: 'INACTIVE' }),
      ).status,
    ).toBe('canceled');
  });

  it('maps PENDING/REQUIRES_ACTION to pending and requires_action', () => {
    const subscription = Subscription$inboundSchema(
      recurringPlanFixture({ status: 'REQUIRES_ACTION' }),
    );
    expect(subscription.status).toBe('pending');
    expect(subscription.requires_action).toBe(true);
  });

  it('surfaces the AUTH action url as payment_url', () => {
    const subscription = Subscription$inboundSchema(
      recurringPlanFixture({
        status: 'REQUIRES_ACTION',
        actions: [
          {
            action: 'AUTH',
            url_type: 'WEB',
            url: 'https://xendit.co/auth/repl_1',
            method: 'GET',
          },
        ],
      }),
    );
    expect(subscription.payment_url).toBe(
      'https://xendit.co/auth/repl_1',
    );
  });
});

describe('Refund$inboundSchema', () => {
  it('maps a Xendit refund', () => {
    const refund = Refund$inboundSchema({
      id: 'rfd_1',
      invoice_id: 'inv_1',
      amount: 400,
      currency: 'IDR',
      status: 'PENDING',
      reason: 'REQUESTED_BY_CUSTOMER',
      metadata: {},
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
    });

    expect(refund).toEqual({
      id: 'rfd_1',
      amount: 400,
      currency: 'IDR',
      reason: 'REQUESTED_BY_CUSTOMER',
      metadata: null,
    });
  });
});

describe('Invoice$inboundSchema', () => {
  it('builds an invoice from a paid Xendit invoice', () => {
    const invoice = Invoice$inboundSchema(
      invoiceFixture({
        status: 'PAID',
        paid_amount: 400,
        paid_at: '2026-01-01T00:05:00.000Z',
        payment_method: 'BANK_TRANSFER',
        payment_channel: 'BCA',
      }),
    );

    expect(invoice).toMatchObject({
      id: 'inv_1',
      customer: { email: 'buyer@example.com' },
      billing_mode: 'one_time',
      amount_paid: 400,
      currency: 'IDR',
      status: 'paid',
      paid_at: '2026-01-01T00:05:00.000Z',
    });
    expect(invoice.custom_fields).toEqual({
      payment_method: 'BANK_TRANSFER',
      payment_channel: 'BCA',
    });
  });
});

describe('XenditProvider HTTP operations', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const expectBasicAuth = (options: RequestInit) => {
    const expected = `Basic ${Buffer.from(`${SECRET_KEY}:`).toString('base64')}`;
    expect(
      (options.headers as Record<string, string>)['Authorization'],
    ).toBe(expected);
  };

  it('createCheckout creates an invoice with basic auth', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(invoiceFixture()));

    const checkout = await makeProvider().createCheckout({
      customer: { email: 'buyer@example.com' },
      item_id: 'plan_pro',
      quantity: 1,
      session_type: 'one_time',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: null,
      provider_metadata: { amount: '400', currency: 'idr' },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe('https://api.xendit.co/v2/invoices/');
    expect(options.method).toBe('POST');
    expectBasicAuth(options);

    const body = JSON.parse(options.body as string);
    expect(body.amount).toBe(400);
    expect(body.currency).toBe('IDR');
    expect(body.payer_email).toBe('buyer@example.com');
    expect(body.success_redirect_url).toBe(
      'https://example.com/success',
    );
    expect(body.failure_redirect_url).toBe(
      'https://example.com/cancel',
    );
    expect(body.metadata.__paykit).toBeDefined();

    expect(checkout.payment_url).toBe(
      'https://checkout.xendit.co/web/inv_1',
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
        provider_metadata: { amount: '400', currency: 'IDR' },
      } as never),
    ).rejects.toThrow(InvalidTypeError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retrieveCheckout fetches the invoice', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(invoiceFixture()));

    const checkout = await makeProvider().retrieveCheckout('inv_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.xendit.co/v2/invoices/inv_1',
    );
    expect(checkout?.payment_url).toBe(
      'https://checkout.xendit.co/web/inv_1',
    );
  });

  it('retrieveCheckout returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error_code: 'INVOICE_NOT_FOUND_ERROR',
          message: 'not found',
        },
        404,
      ),
    );

    const checkout = await makeProvider().retrieveCheckout('missing');
    expect(checkout).toBeNull();
  });

  it('updateCheckout throws ProviderNotSupportedError', async () => {
    await expect(
      makeProvider().updateCheckout('inv_1', {} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
  });

  it('deleteCheckout expires the invoice', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(invoiceFixture({ status: 'EXPIRED' })),
    );

    const result = await makeProvider().deleteCheckout('inv_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.xendit.co/invoices/inv_1/expire!',
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(result).toBeNull();
  });

  it('createCustomer posts individual_detail/email/mobile_number', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(customerFixture()));

    const customer = await makeProvider().createCustomer({
      email: 'buyer@example.com',
      name: 'Jane Doe',
      phone: '5551234',
      billing: null,
    } as never);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.xendit.co/customers');

    const body = JSON.parse(options.body as string);
    expect(body.email).toBe('buyer@example.com');
    expect(body.individual_detail).toEqual({
      given_names: 'Jane',
      surname: 'Doe',
    });
    expect(body.mobile_number).toBe('5551234');

    expect(customer.id).toBe('cust_1');
  });

  it('retrieveCustomer fetches by id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(customerFixture()));

    const customer = await makeProvider().retrieveCustomer('cust_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.xendit.co/customers/cust_1',
    );
    expect(customer?.email).toBe('buyer@example.com');
  });

  it('updateCustomer PATCHes changed fields', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        customerFixture({
          individual_detail: { given_names: 'New', surname: 'Name' },
        }),
      ),
    );

    const customer = await makeProvider().updateCustomer('cust_1', {
      name: 'New Name',
    } as never);

    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    expect(customer.name).toBe('New Name');
  });

  it('deleteCustomer throws ProviderNotSupportedError (no delete API)', async () => {
    await expect(
      makeProvider().deleteCustomer('cust_1'),
    ).rejects.toThrow(ProviderNotSupportedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createSubscription requires an id-based customer', async () => {
    await expect(
      makeProvider().createSubscription({
        customer: { email: 'buyer@example.com' },
        item_id: 'plan_pro',
        quantity: 1,
        billing_interval: 'month',
        amount: 50000,
        currency: 'IDR',
        metadata: null,
        provider_metadata: {
          payment_tokens: [{ payment_token_id: 'pt_1', rank: 1 }],
        },
      } as never),
    ).rejects.toThrow(InvalidTypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createSubscription requires payment_tokens in provider_metadata', async () => {
    await expect(
      makeProvider().createSubscription({
        customer: { id: 'cust_1' },
        item_id: 'plan_pro',
        quantity: 1,
        billing_interval: 'month',
        amount: 50000,
        currency: 'IDR',
        metadata: null,
      } as never),
    ).rejects.toThrow(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createSubscription posts to /recurring/plans with the api-version header', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(recurringPlanFixture()),
    );

    const subscription = await makeProvider().createSubscription({
      customer: { id: 'cust_1' },
      item_id: 'plan_pro',
      quantity: 1,
      billing_interval: 'month',
      amount: 50000,
      currency: 'IDR',
      metadata: null,
      provider_metadata: {
        payment_tokens: [{ payment_token_id: 'pt_1', rank: 1 }],
      },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.xendit.co/recurring/plans');
    expect(
      (options.headers as Record<string, string>)['api-version'],
    ).toBe('2026-01-01');

    const body = JSON.parse(options.body as string);
    expect(body.customer_id).toBe('cust_1');
    expect(body.schedule).toMatchObject({
      interval: 'MONTH',
      interval_count: 1,
    });

    expect(subscription.item_id).toBe('plan_pro');
  });

  it('createSubscription maps yearly billing to MONTH x12', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(recurringPlanFixture()),
    );

    await makeProvider().createSubscription({
      customer: { id: 'cust_1' },
      item_id: 'plan_pro',
      quantity: 1,
      billing_interval: 'year',
      amount: 50000,
      currency: 'IDR',
      metadata: null,
      provider_metadata: {
        payment_tokens: [{ payment_token_id: 'pt_1', rank: 1 }],
      },
    } as never);

    const body = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    );
    expect(body.schedule).toMatchObject({
      interval: 'MONTH',
      interval_count: 12,
    });
  });

  it('retrieveSubscription fetches the plan with the api-version header', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(recurringPlanFixture()),
    );

    const subscription =
      await makeProvider().retrieveSubscription('repl_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.xendit.co/recurring/plans/repl_1',
    );
    expect(
      (fetchMock.mock.calls[0][1].headers as Record<string, string>)[
        'api-version'
      ],
    ).toBe('2026-01-01');
    expect(subscription?.amount).toBe(50000);
  });

  it('retrieveSubscription returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error_code: 'NOT_FOUND', message: 'not found' },
        404,
      ),
    );

    const subscription =
      await makeProvider().retrieveSubscription('missing');
    expect(subscription).toBeNull();
  });

  it('updateSubscription PATCHes metadata', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(recurringPlanFixture()),
    );

    await makeProvider().updateSubscription('repl_1', {
      metadata: { order_id: '42' },
    } as never);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.xendit.co/recurring/plans/repl_1');
    expect(options.method).toBe('PATCH');
    const body = JSON.parse(options.body as string);
    expect(body.metadata).toEqual({ order_id: '42' });
  });

  it('updateSubscription throws ValidationError when no fields are provided', async () => {
    await expect(
      makeProvider().updateSubscription('repl_1', {} as never),
    ).rejects.toThrow(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cancelSubscription deactivates the plan', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(recurringPlanFixture({ status: 'INACTIVE' })),
    );

    const subscription =
      await makeProvider().cancelSubscription('repl_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.xendit.co/recurring/plans/repl_1/deactivate',
    );
    expect(subscription.status).toBe('canceled');
  });

  it('deleteSubscription delegates to cancelSubscription and returns null', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(recurringPlanFixture({ status: 'INACTIVE' })),
    );

    const result = await makeProvider().deleteSubscription('repl_1');
    expect(result).toBeNull();
  });

  it('createPayment creates an invoice and returns a pending payment', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(invoiceFixture()));

    const payment = await makeProvider().createPayment({
      customer: { email: 'buyer@example.com' },
      amount: 400,
      currency: 'IDR',
      item_id: 'item_1',
      capture_method: 'automatic',
      provider_metadata: {
        success_url: 'https://example.com/success',
      },
    } as never);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.success_redirect_url).toBe(
      'https://example.com/success',
    );

    expect(payment.status).toBe('pending');
    expect(payment.payment_url).toBe(
      'https://checkout.xendit.co/web/inv_1',
    );
  });

  it('createPayment throws ValidationError when success_url is missing from provider_metadata', async () => {
    await expect(
      makeProvider().createPayment({
        customer: { email: 'buyer@example.com' },
        amount: 400,
        currency: 'IDR',
        item_id: 'item_1',
        capture_method: 'automatic',
      } as never),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retrievePayment fetches and maps the invoice', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(invoiceFixture({ status: 'PAID' })),
    );

    const payment = await makeProvider().retrievePayment('inv_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.xendit.co/v2/invoices/inv_1',
    );
    expect(payment?.status).toBe('succeeded');
  });

  it('retrievePayment returns null when not found', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error_code: 'NOT_FOUND', message: 'not found' },
        404,
      ),
    );

    const payment = await makeProvider().retrievePayment('missing');
    expect(payment).toBeNull();
  });

  it('capturePayment throws ProviderNotSupportedError', async () => {
    await expect(
      makeProvider().capturePayment('inv_1', { amount: 400 }),
    ).rejects.toThrow(ProviderNotSupportedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cancelPayment expires the invoice', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(invoiceFixture({ status: 'EXPIRED' })),
    );

    const payment = await makeProvider().cancelPayment('inv_1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.xendit.co/invoices/inv_1/expire!',
    );
    expect(payment.status).toBe('canceled');
  });

  it('updatePayment/deletePayment throw ProviderNotSupportedError', async () => {
    await expect(
      makeProvider().updatePayment('inv_1', {} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(
      makeProvider().deletePayment('inv_1'),
    ).rejects.toThrow(ProviderNotSupportedError);
  });

  it('createRefund posts amount and mapped reason', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'rfd_1',
        invoice_id: 'inv_1',
        amount: 400,
        currency: 'IDR',
        status: 'PENDING',
        reason: 'REQUESTED_BY_CUSTOMER',
        metadata: {},
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-01T00:00:00.000Z',
      }),
    );

    const refund = await makeProvider().createRefund({
      payment_id: 'inv_1',
      amount: 400,
      reason: 'requested_by_customer',
      metadata: { order_id: '123' },
    } as never);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.xendit.co/refunds');

    const body = JSON.parse(options.body as string);
    expect(body.invoice_id).toBe('inv_1');
    expect(body.amount).toBe(400);
    expect(body.reason).toBe('REQUESTED_BY_CUSTOMER');

    expect(refund).toEqual({
      id: 'rfd_1',
      amount: 400,
      currency: 'IDR',
      reason: 'REQUESTED_BY_CUSTOMER',
      metadata: null,
    });
  });
});

describe('XenditProvider.handleWebhook', () => {
  it('rejects when no webhook secret is configured', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), null),
    ).rejects.toThrow(WebhookError);
  });

  it('rejects when the x-callback-token header is missing', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), CALLBACK_TOKEN),
    ).rejects.toThrow('Missing x-callback-token header');
  });

  it('rejects an invalid callback token', async () => {
    await expect(
      makeProvider().handleWebhook(
        dto('{}', { 'x-callback-token': 'wrong-token' }),
        CALLBACK_TOKEN,
      ),
    ).rejects.toThrow('Invalid Xendit webhook callback token');
  });

  it('rejects a payload that is not valid JSON', async () => {
    await expect(
      makeProvider().handleWebhook(
        dto('not-json', { 'x-callback-token': CALLBACK_TOKEN }),
        CALLBACK_TOKEN,
      ),
    ).rejects.toThrow('Invalid webhook payload: not valid JSON');
  });

  it('maps a PENDING invoice callback to payment.created', async () => {
    const body = JSON.stringify(invoiceFixture());

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-callback-token': CALLBACK_TOKEN }),
      CALLBACK_TOKEN,
    );

    expect(events.map(e => e.type)).toEqual([
      'xendit.invoice.pending',
      'payment.created',
    ]);
  });

  it('maps a PAID invoice callback to payment.succeeded + invoice.generated', async () => {
    const body = JSON.stringify(invoiceFixture({ status: 'PAID' }));

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-callback-token': CALLBACK_TOKEN }),
      CALLBACK_TOKEN,
    );

    expect(events.map(e => e.type)).toEqual([
      'xendit.invoice.paid',
      'payment.succeeded',
      'invoice.generated',
    ]);
  });

  it('maps a SETTLED invoice callback to payment.succeeded + invoice.generated', async () => {
    const body = JSON.stringify(
      invoiceFixture({ status: 'SETTLED' }),
    );

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-callback-token': CALLBACK_TOKEN }),
      CALLBACK_TOKEN,
    );

    expect(events.map(e => e.type)).toEqual([
      'xendit.invoice.settled',
      'payment.succeeded',
      'invoice.generated',
    ]);
  });

  it('maps an EXPIRED invoice callback to payment.failed', async () => {
    const body = JSON.stringify(
      invoiceFixture({ status: 'EXPIRED' }),
    );

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-callback-token': CALLBACK_TOKEN }),
      CALLBACK_TOKEN,
    );

    expect(events.map(e => e.type)).toEqual([
      'xendit.invoice.expired',
      'payment.failed',
    ]);
  });

  const recurringEventBody = (event: string, data: object) =>
    JSON.stringify({
      event,
      business_id: 'biz_1',
      created: '2026-01-01T00:00:00.000Z',
      data,
    });

  it('maps recurring.plan.activated to subscription.updated', async () => {
    const body = recurringEventBody(
      'recurring.plan.activated',
      recurringPlanFixture(),
    );

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-callback-token': CALLBACK_TOKEN }),
      CALLBACK_TOKEN,
    );

    expect(events.map(e => e.type)).toEqual([
      'xendit.recurring.plan.activated',
      'subscription.updated',
    ]);
  });

  it('maps recurring.plan.inactivated to subscription.canceled', async () => {
    const body = recurringEventBody(
      'recurring.plan.inactivated',
      recurringPlanFixture({ status: 'INACTIVE' }),
    );

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-callback-token': CALLBACK_TOKEN }),
      CALLBACK_TOKEN,
    );

    expect(events.map(e => e.type)).toEqual([
      'xendit.recurring.plan.inactivated',
      'subscription.canceled',
    ]);
  });

  it('maps recurring.cycle.succeeded to payment.succeeded + invoice.generated', async () => {
    const body = recurringEventBody('recurring.cycle.succeeded', {
      id: 'cyc_1',
      plan_id: 'repl_1',
      customer_id: 'cust_1',
      currency: 'IDR',
      amount: 50000,
      status: 'SUCCEEDED',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-callback-token': CALLBACK_TOKEN }),
      CALLBACK_TOKEN,
    );

    expect(events.map(e => e.type)).toEqual([
      'xendit.recurring.cycle.succeeded',
      'payment.succeeded',
      'invoice.generated',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'cyc_1',
      amount: 50000,
      status: 'succeeded',
    });
  });

  it('maps recurring.cycle.failed to payment.failed', async () => {
    const body = recurringEventBody('recurring.cycle.failed', {
      id: 'cyc_2',
      plan_id: 'repl_1',
      customer_id: 'cust_1',
      currency: 'IDR',
      amount: 50000,
      status: 'FAILED',
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-callback-token': CALLBACK_TOKEN }),
      CALLBACK_TOKEN,
    );

    expect(events.map(e => e.type)).toEqual([
      'xendit.recurring.cycle.failed',
      'payment.failed',
    ]);
  });

  it('emits only the raw event for recurring.cycle.created', async () => {
    const body = recurringEventBody('recurring.cycle.created', {
      id: 'cyc_3',
      status: 'SCHEDULED',
      currency: 'IDR',
      amount: 50000,
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-callback-token': CALLBACK_TOKEN }),
      CALLBACK_TOKEN,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('xendit.recurring.cycle.created');
  });

  it('emits only the raw event for recurring.cycle.retrying', async () => {
    const body = recurringEventBody('recurring.cycle.retrying', {
      id: 'cyc_4',
      status: 'RETRYING',
      currency: 'IDR',
      amount: 50000,
    });

    const events = await makeProvider().handleWebhook(
      dto(body, { 'x-callback-token': CALLBACK_TOKEN }),
      CALLBACK_TOKEN,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('xendit.recurring.cycle.retrying');
  });
});
