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
