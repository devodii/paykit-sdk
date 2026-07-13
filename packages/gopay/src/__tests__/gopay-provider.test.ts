import { ConfigurationError, WebhookError } from '@paykit-sdk/core';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { GoPayProvider } from '../gopay-provider';
import { Subscription$inboundSchema } from '../utils/mapper';

const makeProvider = () =>
  new GoPayProvider({
    clientId: 'client_1',
    clientSecret: 'gopay_test_secret',
    goId: '8123456789',
    isSandbox: true,
    webhookUrl: 'https://app.example.com/api/webhook',
    debug: false,
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const tokenResponse = () =>
  jsonResponse({ access_token: 'tok_1', expires_in: 1800 });

const paymentFixture = (
  state: string,
  extra: Record<string, unknown> = {},
) => ({
  id: 3000006529,
  order_number: 'order_1',
  state,
  amount: 1000,
  currency: 'CZK',
  payer: { contact: { email: 'buyer@example.com' } },
  additional_params: [],
  ...extra,
});

const webhookDto = (query = 'id=3000006529') => ({
  body: '',
  headersAsObject: {},
  fullUrl: `https://app.example.com/api/webhook?${query}`,
});

describe('GoPayProvider constructor', () => {
  it('throws ConfigurationError when credentials are missing', () => {
    expect(
      () =>
        new GoPayProvider({
          clientId: 'client_1',
          isSandbox: true,
        } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('gopay');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('GoPayProvider.createCheckout / createPayment', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubTokenThenPayment = (payment: unknown) => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(payment));
  };

  it('createCheckout stores item metadata under the "item" key', async () => {
    stubTokenThenPayment(
      paymentFixture('CREATED', { gw_url: 'https://gw.gopay.com/1' }),
    );

    await makeProvider().createCheckout({
      customer: { email: 'buyer@example.com' },
      item_id: 'my-product',
      quantity: 2,
      session_type: 'one_time',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: null,
      provider_metadata: { amount: '1000', currency: 'CZK' },
    } as never);

    const [, options] = fetchMock.mock.calls[1];
    const body = JSON.parse((options as { body: string }).body);
    const paykitParam = body.additional_params.find(
      (p: { name: string }) => p.name === '__paykit',
    );
    const stored = JSON.parse(paykitParam.value);
    expect(stored).toMatchObject({ item: 'my-product', qty: 2 });
  });

  it('createPayment stores item metadata under the same "item" key as createCheckout, and round-trips item_id', async () => {
    // Response echoes back exactly what createPayment would have sent,
    // so this also verifies Payment$inboundSchema recovers item_id.
    stubTokenThenPayment(
      paymentFixture('CREATED', {
        additional_params: [
          {
            name: '__paykit',
            value: JSON.stringify({ item: 'my-product', qty: 1 }),
          },
        ],
      }),
    );

    const payment = await makeProvider().createPayment({
      customer: { email: 'buyer@example.com' },
      amount: 1000,
      currency: 'CZK',
      item_id: 'my-product',
      capture_method: 'automatic',
      provider_metadata: {
        success_url: 'https://example.com/success',
      },
    } as never);

    const [, options] = fetchMock.mock.calls[1];
    const body = JSON.parse((options as { body: string }).body);
    const paykitParam = body.additional_params.find(
      (p: { name: string }) => p.name === '__paykit',
    );
    const stored = JSON.parse(paykitParam.value);
    expect(stored).toMatchObject({ item: 'my-product' });

    expect(payment.item_id).toBe('my-product');
  });
});

describe('GoPayProvider.createSubscription', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const subscriptionFixture = (
    extra: Record<string, unknown> = {},
  ) => ({
    id: 3000006542,
    order_number: 'order_1',
    state: 'CREATED',
    amount: 1000,
    currency: 'CZK',
    payer: { contact: { email: 'buyer@example.com' } },
    additional_params: [],
    recurrence: {
      recurrence_cycle: 'MONTH',
      recurrence_period: 1,
      recurrence_date_to: '2027-01-01',
      recurrence_state: 'REQUESTED',
    },
    ...extra,
  });

  const stubTokenThenSubscription = (subscription: unknown) => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(subscription));
  };

  const baseParams = {
    customer: { email: 'buyer@example.com' },
    item_id: 'plan_pro',
    quantity: 1,
    amount: 1000,
    currency: 'CZK',
    metadata: null,
    provider_metadata: {
      success_url: 'https://example.com/success',
    },
  };

  it('sends an AUTO recurrence (MONTH) with recurrence_period for a monthly interval', async () => {
    stubTokenThenSubscription(subscriptionFixture());

    await makeProvider().createSubscription({
      ...baseParams,
      billing_interval: 'month',
    } as never);

    const [, options] = fetchMock.mock.calls[1];
    const body = JSON.parse((options as { body: string }).body);

    expect(body.recurrence).toMatchObject({
      recurrence_cycle: 'MONTH',
      recurrence_period: 1,
    });
    expect(body.recurrence.recurrence_date_to).toBeDefined();
  });

  it('falls back to ON_DEMAND with no recurrence_period for a yearly interval', async () => {
    stubTokenThenSubscription(
      subscriptionFixture({
        recurrence: {
          recurrence_cycle: 'ON_DEMAND',
          recurrence_date_to: '2032-01-01',
          recurrence_state: 'REQUESTED',
        },
      }),
    );

    await makeProvider().createSubscription({
      ...baseParams,
      billing_interval: 'year',
    } as never);

    const [, options] = fetchMock.mock.calls[1];
    const body = JSON.parse((options as { body: string }).body);

    expect(body.recurrence.recurrence_cycle).toBe('ON_DEMAND');
    expect(body.recurrence).not.toHaveProperty('recurrence_period');

    const paykitParam = body.additional_params.find(
      (p: { name: string }) => p.name === '__paykit',
    );
    expect(JSON.parse(paykitParam.value)).toMatchObject({
      billing_interval: 'year',
    });
  });

  it('falls back to ON_DEMAND for a custom interval and stores it for round-tripping', async () => {
    stubTokenThenSubscription(
      subscriptionFixture({
        recurrence: {
          recurrence_cycle: 'ON_DEMAND',
          recurrence_date_to: '2028-01-01',
          recurrence_state: 'REQUESTED',
        },
      }),
    );

    await makeProvider().createSubscription({
      ...baseParams,
      billing_interval: { type: 'custom', durationMs: 604800000 },
    } as never);

    const [, options] = fetchMock.mock.calls[1];
    const body = JSON.parse((options as { body: string }).body);

    expect(body.recurrence.recurrence_cycle).toBe('ON_DEMAND');
    expect(body.recurrence).not.toHaveProperty('recurrence_period');

    const paykitParam = body.additional_params.find(
      (p: { name: string }) => p.name === '__paykit',
    );
    expect(JSON.parse(paykitParam.value)).toMatchObject({
      billing_interval: 'custom:604800000ms',
    });
  });
});

describe('GoPayProvider.updateSubscription', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const subscriptionFixture = (
    extra: Record<string, unknown> = {},
  ) => ({
    id: 3000006542,
    order_number: 'order_1',
    state: 'AUTHORIZED',
    amount: 1000,
    currency: 'CZK',
    payer: { contact: { email: 'buyer@example.com' } },
    additional_params: [],
    recurrence: {
      recurrence_cycle: 'ON_DEMAND',
      recurrence_date_to: '2032-01-01',
      recurrence_state: 'REQUESTED',
    },
    ...extra,
  });

  it('provider_metadata.amount posts to /payments/payment/{id}/create-recurrence, then re-fetches the parent subscription', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse()) // fetched once, then cached
      .mockResolvedValueOnce(
        jsonResponse({
          id: 3000006621,
          parent_id: 3000006542,
          order_number: 'order_2',
          state: 'CREATED',
          amount: 500,
          currency: 'CZK',
          additional_params: [],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(subscriptionFixture()));

    const subscription = await makeProvider().updateSubscription(
      '3000006542',
      {
        metadata: { note: 'monthly' },
        provider_metadata: {
          amount: 500,
          currency: 'czk',
          order_description: 'Monthly charge',
        },
      } as never,
    );

    // Only 3 HTTP calls: the token is fetched once and cached, then reused
    // for both the create-recurrence POST and the retrieveSubscription GET.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://gw.sandbox.gopay.com/api/payments/payment/3000006542/create-recurrence',
    );

    const body = JSON.parse(
      (fetchMock.mock.calls[1][1] as { body: string }).body,
    );
    expect(body.amount).toBe(500);
    expect(body.currency).toBe('CZK');
    expect(body.order_description).toBe('Monthly charge');
    const paykitParam = body.additional_params.find(
      (p: { name: string }) => p.name === 'note',
    );
    expect(paykitParam.value).toBe('monthly');

    // Returns the parent subscription (3000006542), not the child charge
    // (3000006621) that create-recurrence just created.
    expect(subscription.id).toBe('3000006542');
  });

  it('without provider_metadata.amount, just re-fetches the current subscription', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(subscriptionFixture()));

    const subscription = await makeProvider().updateSubscription(
      '3000006542',
      { metadata: {} } as never,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://gw.sandbox.gopay.com/api/payments/payment/3000006542',
    );
    expect(subscription.id).toBe('3000006542');
  });
});

describe('Subscription$inboundSchema', () => {
  const recurringFixture = (
    billingInterval: unknown,
    extra: Record<string, unknown> = {},
  ) => ({
    id: 3000006542,
    order_number: 'order_1',
    state: 'CREATED' as const,
    amount: 1000,
    currency: 'CZK',
    payer: { contact: { email: 'buyer@example.com' } },
    additional_params: [
      {
        name: '__paykit',
        value: JSON.stringify({
          item: 'plan_pro',
          billing_interval: billingInterval,
        }),
      },
    ],
    recurrence: {
      recurrence_cycle: 'ON_DEMAND',
      recurrence_date_to: '2032-01-01',
      recurrence_state: 'REQUESTED' as const,
    },
    ...extra,
  });

  it('recovers a yearly interval instead of collapsing ON_DEMAND to month', () => {
    const subscription = Subscription$inboundSchema(
      recurringFixture('year') as never,
    );
    expect(subscription.billing_interval).toBe('year');
  });

  it('recovers a custom interval instead of collapsing ON_DEMAND to month', () => {
    const subscription = Subscription$inboundSchema(
      recurringFixture('custom:604800000ms') as never,
    );
    expect(subscription.billing_interval).toEqual({
      type: 'custom',
      durationMs: 604800000,
    });
  });

  it('falls back to the recurrence_cycle-derived interval when nothing was stored', () => {
    const subscription = Subscription$inboundSchema({
      id: 3000006542,
      order_number: 'order_1',
      state: 'CREATED',
      amount: 1000,
      currency: 'CZK',
      payer: { contact: { email: 'buyer@example.com' } },
      additional_params: [],
      recurrence: {
        recurrence_cycle: 'WEEK',
        recurrence_period: 1,
        recurrence_date_to: '2027-01-01',
        recurrence_state: 'REQUESTED',
      },
    } as never);
    expect(subscription.billing_interval).toBe('week');
  });
});

describe('GoPayProvider.handleWebhook', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** First call fetches the OAuth token, second returns the payment. */
  const stubTokenThenPayment = (payment: unknown) => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(payment));
  };

  it('rejects when the notification has no payment id', async () => {
    await expect(
      makeProvider().handleWebhook(webhookDto('other=1'), null),
    ).rejects.toThrow(WebhookError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('verifies by re-fetching the payment from the GoPay API', async () => {
    stubTokenThenPayment(paymentFixture('PAID'));

    await makeProvider().handleWebhook(webhookDto(), null);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://gw.sandbox.gopay.com/api/oauth2/token',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://gw.sandbox.gopay.com/api/payments/payment/3000006529',
    );
  });

  it('emits invoice.generated + payment.succeeded for PAID', async () => {
    stubTokenThenPayment(paymentFixture('PAID'));

    const events = await makeProvider().handleWebhook(
      webhookDto(),
      null,
    );

    expect(events.map(e => e.type)).toEqual([
      'invoice.generated',
      'payment.succeeded',
    ]);
    expect(events[1].data).toMatchObject({
      amount: 1000,
      currency: 'CZK',
      status: 'succeeded',
    });
  });

  it('also emits subscription.created for PAID recurring payments', async () => {
    stubTokenThenPayment(
      paymentFixture('PAID', {
        recurrence: {
          recurrence_cycle: 'MONTH',
          recurrence_period: 1,
          recurrence_date_to: '2027-01-01',
          recurrence_state: 'REQUESTED',
        },
      }),
    );

    const events = await makeProvider().handleWebhook(
      webhookDto('id=3000006529&parent_id=3000006000'),
      null,
    );

    expect(events.map(e => e.type)).toEqual([
      'subscription.created',
      'invoice.generated',
      'payment.succeeded',
    ]);
  });

  it('emits payment.created for CREATED', async () => {
    stubTokenThenPayment(paymentFixture('CREATED'));

    const events = await makeProvider().handleWebhook(
      webhookDto(),
      null,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('payment.created');
    expect(events[0].data).toMatchObject({ status: 'pending' });
  });

  it('emits payment.failed for TIMEOUTED', async () => {
    stubTokenThenPayment(paymentFixture('TIMEOUTED'));

    const events = await makeProvider().handleWebhook(
      webhookDto(),
      null,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('payment.failed');
  });

  it('emits refund.created for REFUNDED', async () => {
    stubTokenThenPayment(paymentFixture('REFUNDED'));

    const events = await makeProvider().handleWebhook(
      webhookDto(),
      null,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('refund.created');
  });

  it('emits refund.created for PARTIALLY_REFUNDED', async () => {
    stubTokenThenPayment(paymentFixture('PARTIALLY_REFUNDED'));

    const events = await makeProvider().handleWebhook(
      webhookDto(),
      null,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('refund.created');
  });

  it('emits payment.updated for PAYMENT_METHOD_CHOSEN', async () => {
    stubTokenThenPayment(paymentFixture('PAYMENT_METHOD_CHOSEN'));

    const events = await makeProvider().handleWebhook(
      webhookDto(),
      null,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('payment.updated');
  });

  it('emits payment.updated for AUTHORIZED', async () => {
    stubTokenThenPayment(paymentFixture('AUTHORIZED'));

    const events = await makeProvider().handleWebhook(
      webhookDto(),
      null,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('payment.updated');
    expect(events[0].data).toMatchObject({
      status: 'requires_capture',
    });
  });

  it('emits payment.failed for CANCELED', async () => {
    stubTokenThenPayment(paymentFixture('CANCELED'));

    const events = await makeProvider().handleWebhook(
      webhookDto(),
      null,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('payment.failed');
  });

  it('also emits subscription.canceled for CANCELED recurring payments with a stopped recurrence', async () => {
    stubTokenThenPayment(
      paymentFixture('CANCELED', {
        recurrence: {
          recurrence_cycle: 'MONTH',
          recurrence_period: 1,
          recurrence_date_to: '2027-01-01',
          recurrence_state: 'STOPPED',
        },
      }),
    );

    const events = await makeProvider().handleWebhook(
      webhookDto('id=3000006529&parent_id=3000006000'),
      null,
    );

    expect(events.map(e => e.type)).toEqual([
      'subscription.canceled',
      'payment.failed',
    ]);
  });

  it('throws WebhookError when the payment fetch fails', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        jsonResponse({ errors: [{ message: 'not found' }] }, 404),
      );

    await expect(
      makeProvider().handleWebhook(webhookDto(), null),
    ).rejects.toThrow(WebhookError);
  });
});
