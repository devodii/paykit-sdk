import {
  ConfigurationError,
  InvalidTypeError,
  OperationFailedError,
  ProviderNotSupportedError,
  ResourceNotFoundError,
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

// ---------------------------------------------------------------------------
// Missing coverage — all methods that had no test before
// Shapes match the real Paystack sandbox responses captured during Track A.
// ---------------------------------------------------------------------------

describe('PaystackProvider — missing coverage', () => {
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

  // ── Real shapes from sandbox ──────────────────────────────────────────────

  // POST /customer and PUT /customer — camelCase timestamps only (no created_at/updated_at)
  const makeCustomerData = (overrides?: Record<string, unknown>) => ({
    email: 'buyer@example.com',
    first_name: 'Ada',
    last_name: 'Lovelace',
    phone: null,
    metadata: {},
    domain: 'test',
    customer_code: 'CUS_abc123',
    risk_action: 'default',
    id: 385062803,
    integration: 185175,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    identified: false,
    identifications: null,
    ...overrides,
  });

  const createCustomerResponse = (
    overrides?: Record<string, unknown>,
  ) =>
    jsonResponse({
      status: true,
      message: 'Customer created',
      data: makeCustomerData(overrides),
    });

  // GET /customer — has both snake_case and camelCase timestamps
  const retrieveCustomerResponse = () =>
    jsonResponse({
      status: true,
      message: 'Customer retrieved',
      data: {
        ...makeCustomerData(),
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        total_transactions: 0,
        total_transaction_value: [],
        dedicated_account: null,
        dedicated_accounts: [],
      },
    });

  // GET /subscription/:code and POST /subscription
  const makeSubscriptionData = (statusVal = 'active') => ({
    id: 1245360,
    domain: 'test',
    status: statusVal,
    subscription_code: 'SUB_2vjq5801vp9xs5p',
    email_token: 'q9sgbgxn3iyd2of',
    amount: 500000,
    cron_expression: '14 8 24 * *',
    next_payment_date: '2026-08-24T08:14:00.000Z',
    open_invoice: null,
    createdAt: '2026-07-24T08:14:08.000Z',
    cancelledAt: null,
    plan: {
      id: 3909211,
      name: 'Test Monthly Plan',
      plan_code: 'PLN_gi1quck1wlv5zk1',
      description: null,
      amount: 500000,
      interval: 'monthly',
      send_invoices: true,
      send_sms: true,
      currency: 'NGN',
    },
    authorization: {
      authorization_code: 'AUTH_60byyq9o8k',
      bin: '408408',
      last4: '4081',
      exp_month: '12',
      exp_year: '2030',
      channel: 'card',
      card_type: 'visa',
      bank: 'TEST BANK',
      country_code: 'NG',
      brand: 'visa',
      reusable: true,
      signature: 'SIG_hDR26oiVi45QIoUmt3Jz',
      account_name: null,
    },
    customer: {
      id: 385062803,
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'test.customer@example.com',
      customer_code: 'CUS_pr2g96inu6rt0uv',
      phone: '+2348099999999',
      metadata: {},
      risk_action: 'default',
      international_format_phone: '+2348099999999',
    },
    invoice_limit: 0,
    split_code: null,
    metadata: null,
    payments_count: 1,
    most_recent_invoice: null,
  });

  const subscriptionResponse = (statusVal = 'active') =>
    jsonResponse({
      status: true,
      message: 'Subscription retrieved successfully',
      data: makeSubscriptionData(statusVal),
    });

  // POST /subscription/disable — returns { status: true, data: { status: 'non-renewing' } }
  const disableSubscriptionResponse = () =>
    jsonResponse({
      status: true,
      message: 'Subscription disabled successfully',
      data: { status: 'non-renewing' },
    });

  // GET /transaction/verify/:ref — real shape from sandbox
  const verifyTransactionResponse = (txStatus = 'abandoned') =>
    jsonResponse({
      status: true,
      message: 'Verification successful',
      data: {
        id: 6386453067,
        domain: 'test',
        status: txStatus,
        reference: 'paykit-test-ref-001',
        receipt_number: null,
        amount: 10000,
        message: null,
        gateway_response: 'Successful',
        paid_at:
          txStatus === 'success' ? '2026-07-24T08:14:08.000Z' : null,
        created_at: '2026-07-24T07:54:17.000Z',
        channel: 'card',
        currency: 'NGN',
        ip_address: '102.90.82.154',
        metadata: '',
        fees: null,
        authorization: {},
        customer: {
          id: 385062117,
          first_name: null,
          last_name: null,
          email: 'buyer@example.com',
          customer_code: 'CUS_9p1hcx5rj2i0qz6',
          phone: null,
          metadata: null,
          risk_action: 'default',
          international_format_phone: null,
        },
        plan: null,
        subaccount: {},
      },
    });

  // POST /refund — shape based on PaystackRefund interface
  // (real curl returned "Cannot refund less than NGN50" due to amount constraint,
  //  not a schema issue — existing webhook refund.processed test confirms field names)
  const refundApiResponse = (
    currency = 'NGN',
    merchantNote = 'Test refund from paykit-sdk audit',
  ) =>
    jsonResponse({
      status: true,
      message: 'Refund created successfully',
      data: {
        id: 1,
        transaction: 6386511268,
        amount: 5000,
        currency,
        deducted_amount: null,
        channel: 'mco',
        fully_deducted: null,
        refunded_at: null,
        expected_at: '2026-08-07T00:00:00.000Z',
        customer_note: '',
        merchant_note: merchantNote,
        created_at: '2026-07-24T08:00:00.000Z',
        updated_at: '2026-07-24T08:00:00.000Z',
        status: 'pending',
      },
    });

  // ── Checkout ──────────────────────────────────────────────────────────────

  describe('checkout', () => {
    it('retrieveCheckout maps a verified transaction to a Checkout', async () => {
      fetchMock.mockResolvedValueOnce(
        verifyTransactionResponse('abandoned'),
      );

      const result = await makeProvider().retrieveCheckout(
        'paykit-test-ref-001',
      );

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://api.paystack.co/transaction/verify/paykit-test-ref-001',
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe('paykit-test-ref-001');
      expect(result!.currency).toBe('NGN');
      expect(result!.amount).toBe(10000);
    });

    it('retrieveCheckout returns null when the API returns no data', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ status: true, message: 'ok', data: null }),
      );

      const result =
        await makeProvider().retrieveCheckout('nonexistent');
      expect(result).toBeNull();
    });

    it('updateCheckout throws ProviderNotSupportedError and never calls fetch', async () => {
      await expect(
        makeProvider().updateCheckout('id', {} as never),
      ).rejects.toThrow(ProviderNotSupportedError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('deleteCheckout throws ProviderNotSupportedError and never calls fetch', async () => {
      await expect(
        makeProvider().deleteCheckout('id'),
      ).rejects.toThrow(ProviderNotSupportedError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ── Customer ──────────────────────────────────────────────────────────────

  describe('customer', () => {
    it('createCustomer sends first/last name split and returns correct id and timestamps', async () => {
      fetchMock.mockResolvedValueOnce(createCustomerResponse());

      const result = await makeProvider().createCustomer({
        email: 'buyer@example.com',
        name: 'Ada Lovelace',
        billing: null,
        metadata: undefined,
      } as never);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.paystack.co/customer');

      const body = JSON.parse((options as { body: string }).body);
      expect(body.first_name).toBe('Ada');
      expect(body.last_name).toBe('Lovelace');
      expect(body.email).toBe('buyer@example.com');

      // Bug 4 regression: id was undefined before _throwIfFailed fix
      expect(result.id).toBe('CUS_abc123');
      expect(result.name).toBe('Ada Lovelace');
      expect(result.email).toBe('buyer@example.com');
      // Bug 4 regression: was Invalid Date before mapper timestamp fix
      expect(result.created_at).toBeInstanceOf(Date);
      expect(isNaN(result.created_at.getTime())).toBe(false);
    });

    it('createCustomer handles a single-token name (no last name)', async () => {
      fetchMock.mockResolvedValueOnce(
        createCustomerResponse({
          first_name: 'Chizihn',
          last_name: null,
          customer_code: 'CUS_single',
        }),
      );

      await makeProvider().createCustomer({
        email: 'buyer@example.com',
        name: 'Chizihn',
        billing: null,
        metadata: undefined,
      } as never);

      const [, options] = fetchMock.mock.calls[0];
      const body = JSON.parse((options as { body: string }).body);
      expect(body.first_name).toBe('Chizihn');
      expect(body.last_name).toBeUndefined();
    });

    it('retrieveCustomer maps a Paystack customer object', async () => {
      fetchMock.mockResolvedValueOnce(retrieveCustomerResponse());

      const result = await makeProvider().retrieveCustomer(
        'test.customer@example.com',
      );

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://api.paystack.co/customer/test.customer%40example.com',
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe('CUS_abc123');
      expect(result!.name).toBe('Ada Lovelace');
      expect(result!.email).toBe('buyer@example.com');
      expect(result!.created_at).toBeInstanceOf(Date);
    });

    it('retrieveCustomer returns null when customer is not found', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ status: true, message: 'ok', data: null }),
      );

      const result =
        await makeProvider().retrieveCustomer('CUS_missing');
      expect(result).toBeNull();
    });

    it('updateCustomer sends only changed fields (partial update)', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          status: true,
          message: 'Customer updated',
          data: makeCustomerData({ phone: '+2348099999999' }),
        }),
      );

      const result = await makeProvider().updateCustomer(
        'CUS_abc123',
        {
          phone: '+2348099999999',
        },
      );

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.paystack.co/customer/CUS_abc123');

      const body = JSON.parse((options as { body: string }).body);
      expect(body.phone).toBe('+2348099999999');
      // Partial update — name/email not sent
      expect(body.first_name).toBeUndefined();
      expect(body.email).toBeUndefined();

      // Bug 4 regression: id was undefined before fix
      expect(result.id).toBe('CUS_abc123');
    });

    it('deleteCustomer throws ProviderNotSupportedError and never calls fetch', async () => {
      await expect(
        makeProvider().deleteCustomer('CUS_abc123'),
      ).rejects.toThrow(ProviderNotSupportedError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ── Subscription ─────────────────────────────────────────────────────────

  describe('subscription', () => {
    it('createSubscription sends customer and plan and returns correct id', async () => {
      fetchMock.mockResolvedValueOnce(subscriptionResponse());

      const result = await makeProvider().createSubscription({
        customer: { email: 'test.customer@example.com' },
        item_id: 'PLN_gi1quck1wlv5zk1',
        amount: 500000,
        currency: 'NGN',
        billing_interval: 'month',
        metadata: null,
        quantity: 1,
      } as never);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.paystack.co/subscription');

      const body = JSON.parse((options as { body: string }).body);
      expect(body.customer).toBe('test.customer@example.com');
      expect(body.plan).toBe('PLN_gi1quck1wlv5zk1');

      // Bug 4 regression: id was undefined before _throwIfFailed fix
      expect(result.id).toBe('SUB_2vjq5801vp9xs5p');
      expect(result.status).toBe('active');
      // Bug 4 regression: item_id was '' before fix (plan.plan_code unreadable)
      expect(result.item_id).toBe('PLN_gi1quck1wlv5zk1');
      expect(result.billing_interval).toBe('month');
      expect(result.customer).toEqual({
        email: 'test.customer@example.com',
      });
    });

    it('retrieveSubscription maps a Paystack subscription', async () => {
      fetchMock.mockResolvedValueOnce(subscriptionResponse());

      const result = await makeProvider().retrieveSubscription(
        'SUB_2vjq5801vp9xs5p',
      );

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://api.paystack.co/subscription/SUB_2vjq5801vp9xs5p',
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe('SUB_2vjq5801vp9xs5p');
      expect(result!.status).toBe('active');
      expect(result!.billing_interval).toBe('month');
      expect(result!.currency).toBe('NGN');
      expect(result!.customer).toEqual({
        email: 'test.customer@example.com',
      });
    });

    it('retrieveSubscription returns null when subscription is not found', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ status: true, message: 'ok', data: null }),
      );

      const result =
        await makeProvider().retrieveSubscription('SUB_missing');
      expect(result).toBeNull();
    });

    it('cancelSubscription retrieves, re-fetches raw, calls disable, returns canceled', async () => {
      // 1st call: retrieveSubscription (mapped)
      fetchMock.mockResolvedValueOnce(subscriptionResponse());
      // 2nd call: raw re-fetch to get subscription_code + email_token
      fetchMock.mockResolvedValueOnce(subscriptionResponse());
      // 3rd call: POST /subscription/disable
      fetchMock.mockResolvedValueOnce(disableSubscriptionResponse());

      const result = await makeProvider().cancelSubscription(
        'SUB_2vjq5801vp9xs5p',
      );

      expect(fetchMock).toHaveBeenCalledTimes(3);

      const [disableUrl, disableOpts] = fetchMock.mock.calls[2];
      expect(disableUrl).toBe(
        'https://api.paystack.co/subscription/disable',
      );

      const disableBody = JSON.parse(
        (disableOpts as { body: string }).body,
      );
      // Bug 4 regression: code and token were undefined before _throwIfFailed fix
      expect(disableBody.code).toBe('SUB_2vjq5801vp9xs5p');
      expect(disableBody.token).toBe('q9sgbgxn3iyd2of');

      expect(result.status).toBe('canceled');
    });

    it('cancelSubscription throws ResourceNotFoundError when subscription is not found', async () => {
      // retrieveSubscription returns null when data is null
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ status: true, message: 'ok', data: null }),
      );

      await expect(
        makeProvider().cancelSubscription('SUB_missing'),
      ).rejects.toThrow(ResourceNotFoundError);

      // Only the first GET should have been called
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('cancelSubscription throws OperationFailedError when disable call fails', async () => {
      fetchMock
        .mockResolvedValueOnce(subscriptionResponse())
        .mockResolvedValueOnce(subscriptionResponse())
        .mockResolvedValueOnce(
          jsonResponse({
            status: false,
            message:
              'Subscription with code not found or already inactive',
          }),
        );

      await expect(
        makeProvider().cancelSubscription('SUB_2vjq5801vp9xs5p'),
      ).rejects.toThrow(OperationFailedError);
    });

    it('updateSubscription throws ProviderNotSupportedError and never calls fetch', async () => {
      await expect(
        makeProvider().updateSubscription('SUB_1', {} as never),
      ).rejects.toThrow(ProviderNotSupportedError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('deleteSubscription throws ProviderNotSupportedError and never calls fetch', async () => {
      await expect(
        makeProvider().deleteSubscription('SUB_1'),
      ).rejects.toThrow(ProviderNotSupportedError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ── Payment ───────────────────────────────────────────────────────────────

  describe('payment', () => {
    it('retrievePayment maps a verified successful transaction to a Payment', async () => {
      fetchMock.mockResolvedValueOnce(
        verifyTransactionResponse('success'),
      );

      const result = await makeProvider().retrievePayment(
        'paykit-test-ref-001',
      );

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://api.paystack.co/transaction/verify/paykit-test-ref-001',
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe('paykit-test-ref-001');
      expect(result!.status).toBe('succeeded');
      expect(result!.amount).toBe(10000);
      expect(result!.currency).toBe('NGN');
      expect(result!.requires_action).toBe(false);
    });

    it('retrievePayment returns null when transaction is not found', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ status: true, message: 'ok', data: null }),
      );

      const result =
        await makeProvider().retrievePayment('nonexistent');
      expect(result).toBeNull();
    });

    it('updatePayment throws ProviderNotSupportedError and never calls fetch', async () => {
      await expect(
        makeProvider().updatePayment('id', {} as never),
      ).rejects.toThrow(ProviderNotSupportedError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('deletePayment throws ProviderNotSupportedError and never calls fetch', async () => {
      await expect(
        makeProvider().deletePayment('id'),
      ).rejects.toThrow(ProviderNotSupportedError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('capturePayment throws ProviderNotSupportedError and never calls fetch', async () => {
      await expect(
        makeProvider().capturePayment('id', {} as never),
      ).rejects.toThrow(ProviderNotSupportedError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('cancelPayment throws ProviderNotSupportedError and never calls fetch', async () => {
      await expect(
        makeProvider().cancelPayment('id'),
      ).rejects.toThrow(ProviderNotSupportedError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ── Refund ────────────────────────────────────────────────────────────────

  describe('refund', () => {
    it('createRefund sends transaction reference, amount and merchant_note', async () => {
      fetchMock.mockResolvedValueOnce(refundApiResponse());

      const result = await makeProvider().createRefund({
        payment_id: 'paykit-sub-test-001',
        reason: 'Test refund from paykit-sdk audit',
        amount: 5000,
        metadata: null,
      } as never);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.paystack.co/refund');

      const body = JSON.parse((options as { body: string }).body);
      expect(body.transaction).toBe('paykit-sub-test-001');
      expect(body.amount).toBe(5000);
      expect(body.merchant_note).toBe(
        'Test refund from paykit-sdk audit',
      );

      expect(result.id).toBe('1');
      expect(result.amount).toBe(5000);
      expect(result.currency).toBe('NGN');
    });

    it('createRefund uses the currency from the refund response (Bug 1 regression)', async () => {
      fetchMock.mockResolvedValueOnce(refundApiResponse('GHS'));

      const result = await makeProvider().createRefund({
        payment_id: 'txn_ghs',
        reason: 'GHS refund test',
        amount: 5000,
        metadata: null,
      } as never);

      // Before the fix, 'NGN' was hardcoded — this would have been 'NGN' for a GHS refund.
      expect(result.currency).toBe('GHS');
    });

    it('createRefund falls back to "Duplicate charge" if no reason or merchant_note is provided', async () => {
      fetchMock.mockResolvedValueOnce(refundApiResponse());

      await makeProvider().createRefund({
        payment_id: 'txn_test',
        amount: 5000,
        reason: '',
        metadata: null,
      } as never);

      const [url, options] = fetchMock.mock.calls[0];
      const body = JSON.parse((options as { body: string }).body);
      expect(body.merchant_note).toBe('Duplicate charge');
    });

    it('createRefund prioritizes provider_metadata.merchant_note over reason', async () => {
      fetchMock.mockResolvedValueOnce(refundApiResponse());

      await makeProvider().createRefund({
        payment_id: 'txn_test',
        reason: 'Universal SDK Reason',
        amount: 5000,
        metadata: null,
        provider_metadata: {
          merchant_note: 'Provider Metadata Reason',
          other_field: 'keep me',
        },
      } as never);

      const [url, options] = fetchMock.mock.calls[0];
      const body = JSON.parse((options as { body: string }).body);
      expect(body.merchant_note).toBe('Provider Metadata Reason');
      expect(body.other_field).toBe('keep me');
    });

    it('createRefund uses the reason from merchant_note (Bug 4 regression)', async () => {
      fetchMock.mockResolvedValueOnce(
        refundApiResponse('NGN', 'Bad stuff'),
      );

      const result = await makeProvider().createRefund({
        payment_id: 'txn_test',
        reason: 'GHS refund test',
        amount: 5000,
        metadata: null,
      } as never);

      expect(result.reason).toBe('Bad stuff');
    });

    it('createRefund returns the reason from merchant_note (Bug 4 regression)', async () => {
      fetchMock.mockResolvedValueOnce(refundApiResponse());

      const result = await makeProvider().createRefund({
        payment_id: 'paykit-sub-test-001',
        reason: 'Test refund from paykit-sdk audit',
        amount: 5000,
        metadata: null,
      } as never);

      // Before the _toCamel fix, merchant_note was renamed to merchantNote by
      // unwrap(), so Refund$inboundSchema couldn't read it and reason was null.
      expect(result.reason).toBe('Test refund from paykit-sdk audit');
    });
  });
});
