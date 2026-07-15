import {
  ConfigurationError,
  InvalidTypeError,
  OperationFailedError,
  ProviderNotSupportedError,
  ResourceNotFoundError,
  ValidationError,
  WebhookError,
} from '@paykit-sdk/core';
import { createHash } from 'crypto';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { RemitaProvider } from '../remita-provider';

const SANDBOX_BASE_URL =
  'https://demo.remita.net/remita/exapp/api/v1/send/api';

const sha512 = (str: string) =>
  createHash('sha512').update(str).digest('hex');

const makeProvider = (overrides: Record<string, unknown> = {}) =>
  new RemitaProvider({
    merchantId: 'MERCHANT1',
    apiKey: 'API_KEY_1',
    serviceTypeId: 'SVC1',
    isSandbox: true,
    debug: false,
    ...overrides,
  } as never);

describe('RemitaProvider constructor', () => {
  it('throws ConfigurationError when credentials are missing', () => {
    expect(
      () => new RemitaProvider({ isSandbox: true } as never),
    ).toThrow(ConfigurationError);
  });

  it('throws ConfigurationError when isSandbox is false and no baseUrl is given', () => {
    expect(() =>
      makeProvider({ isSandbox: false, baseUrl: undefined }),
    ).toThrow(ConfigurationError);
  });

  it('accepts isSandbox: false when baseUrl is provided', () => {
    const provider = makeProvider({
      isSandbox: false,
      baseUrl:
        'https://login.remita.net/remita/exapp/api/v1/send/api',
    });
    expect(provider.isSandbox).toBe(false);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('remita');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('RemitaProvider.createPayment', () => {
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

  const baseParams = {
    customer: { email: 'buyer@example.com' },
    amount: 20000,
    currency: 'NGN',
    item_id: 'invoice-1',
    capture_method: 'automatic' as const,
    provider_metadata: {
      payerName: 'John Doe',
      payerPhone: '09062067384',
    },
  };

  it('generates an RRR and maps the response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        statuscode: '025',
        RRR: '140008260136',
        status: 'Payment Reference generated',
      }),
    );

    const payment = await makeProvider().createPayment(
      baseParams as never,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${SANDBOX_BASE_URL}/echannelsvc/merchant/api/paymentinit`,
    );

    const body = JSON.parse(options.body as string);
    expect(body.serviceTypeId).toBe('SVC1');
    expect(body.amount).toBe('20000');
    expect(body.payerName).toBe('John Doe');
    expect(body.payerPhone).toBe('09062067384');
    expect(body.payerEmail).toBe('buyer@example.com');
    expect(typeof body.orderId).toBe('string');

    const expectedHash = sha512(
      `MERCHANT1SVC1${body.orderId}20000API_KEY_1`,
    );
    expect(options.headers.Authorization).toBe(
      `remitaConsumerKey=MERCHANT1,remitaConsumerToken=${expectedHash}`,
    );

    expect(payment.id).toBe('140008260136');
    expect(payment.amount).toBe(20000);
    expect(payment.currency).toBe('NGN');
    expect(payment.status).toBe('pending');
    expect(payment.requires_action).toBe(true);
    expect(payment.payment_url).toBeNull();
    expect(payment.item_id).toBe('invoice-1');
    expect(payment.customer).toEqual({ email: 'buyer@example.com' });
  });

  it('lets a per-call serviceTypeId override the provider default', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ statuscode: '025', RRR: 'RRR1', status: 'ok' }),
    );

    await makeProvider().createPayment({
      ...baseParams,
      provider_metadata: {
        ...baseParams.provider_metadata,
        serviceTypeId: 'SVC_OVERRIDE',
      },
    } as never);

    const body = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    );
    expect(body.serviceTypeId).toBe('SVC_OVERRIDE');
  });

  it('throws InvalidTypeError for an id-based customer', async () => {
    await expect(
      makeProvider().createPayment({
        ...baseParams,
        customer: { id: 'cus_1' },
      } as never),
    ).rejects.toThrow(InvalidTypeError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires payerName and payerPhone in provider_metadata', async () => {
    await expect(
      makeProvider().createPayment({
        ...baseParams,
        provider_metadata: {},
      } as never),
    ).rejects.toThrow(/payerName/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws ConfigurationError when item_id is missing', async () => {
    await expect(
      makeProvider().createPayment({
        ...baseParams,
        item_id: null,
      } as never),
    ).rejects.toThrow(ConfigurationError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws ValidationError for malformed params', async () => {
    await expect(
      makeProvider().createPayment({} as never),
    ).rejects.toThrow(ValidationError);
  });

  it('throws OperationFailedError when Remita rejects the invoice', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        statuscode: '023',
        RRR: '',
        status: 'Service type or Merchant Does not Exist',
      }),
    );

    await expect(
      makeProvider().createPayment(baseParams as never),
    ).rejects.toThrow(OperationFailedError);
  });
});

describe('RemitaProvider.retrievePayment', () => {
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

  it('maps a paid transaction to succeeded', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        amount: 3500,
        RRR: '260007689516',
        orderId: '5b16ee7969080',
        message: 'Approved',
        paymentDate: '2018-06-08 06:02:06 PM',
        transactiontime: '2018-06-05 12:00:00 AM',
        status: '01',
      }),
    );

    const payment =
      await makeProvider().retrievePayment('260007689516');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${SANDBOX_BASE_URL}/echannelsvc/MERCHANT1/260007689516/${encodeURIComponent(
        sha512('260007689516API_KEY_1MERCHANT1'),
      )}/status.reg`,
    );

    expect(payment).toMatchObject({
      id: '260007689516',
      amount: 3500,
      currency: 'NGN',
      status: 'succeeded',
      requires_action: false,
    });
  });

  it('maps a pending transaction to pending', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        amount: 20000,
        RRR: '100007846253',
        orderId: '1595269373214',
        message: 'Transaction Pending',
        transactiontime: '2020-07-20 12:00:00 AM',
        status: '021',
      }),
    );

    const payment =
      await makeProvider().retrievePayment('100007846253');
    expect(payment?.status).toBe('pending');
    expect(payment?.requires_action).toBe(true);
  });

  it('maps a failed transaction to failed', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        amount: 1000,
        RRR: 'RRR_FAIL',
        orderId: 'o1',
        message: 'Transaction Failed',
        transactiontime: '2020-07-20 12:00:00 AM',
        status: '02',
      }),
    );

    const payment = await makeProvider().retrievePayment('RRR_FAIL');
    expect(payment?.status).toBe('failed');
  });

  it('returns null for an invalid RRR (status 022)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        amount: 0,
        RRR: '',
        orderId: '',
        message: 'Invalid RRR',
        transactiontime: '',
        status: '022',
      }),
    );

    const payment = await makeProvider().retrievePayment('bogus');
    expect(payment).toBeNull();
  });

  it('returns null when the HTTP call fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    );

    const payment = await makeProvider().retrievePayment('rrr');
    expect(payment).toBeNull();
  });

  it('does not recover customer/item_id/metadata (not returned by Remita)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        amount: 3500,
        RRR: 'RRR1',
        orderId: 'o1',
        message: 'Approved',
        transactiontime: '2018-06-05 12:00:00 AM',
        status: '00',
      }),
    );

    const payment = await makeProvider().retrievePayment('RRR1');
    expect(payment?.customer).toBeNull();
    expect(payment?.item_id).toBeNull();
    expect(payment?.metadata).toEqual({});
  });
});

describe('RemitaProvider.cancelPayment', () => {
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

  const statusResponse = () =>
    jsonResponse({
      amount: 5000,
      RRR: 'RRR1',
      orderId: 'o1',
      message: 'Transaction Pending',
      transactiontime: '2020-07-20 12:00:00 AM',
      status: '021',
    });

  it('cancels an unpaid RRR', async () => {
    fetchMock
      .mockResolvedValueOnce(statusResponse())
      .mockResolvedValueOnce(
        jsonResponse({ statuscode: '00', status: 'Successful' }),
      );

    const payment = await makeProvider().cancelPayment('RRR1');

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [cancelUrl, cancelOptions] = fetchMock.mock.calls[1];
    expect(cancelUrl).toBe(
      `${SANDBOX_BASE_URL}/echannelsvc/v2/api/deactivate.json`,
    );

    const cancelBody = JSON.parse(cancelOptions.body as string);
    expect(cancelBody).toEqual({
      rrr: 'RRR1',
      merchantId: 'MERCHANT1',
      hash: sha512('RRR1API_KEY_1MERCHANT1'),
    });

    expect(payment.status).toBe('canceled');
    expect(payment.requires_action).toBe(false);
  });

  it('throws ResourceNotFoundError when the RRR does not exist', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        amount: 0,
        RRR: '',
        orderId: '',
        message: 'Invalid RRR',
        transactiontime: '',
        status: '022',
      }),
    );

    await expect(
      makeProvider().cancelPayment('bogus'),
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it('throws OperationFailedError when Remita rejects the cancellation', async () => {
    fetchMock
      .mockResolvedValueOnce(statusResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          statuscode: '027',
          status: 'Transaction Already Processed',
        }),
      );

    await expect(
      makeProvider().cancelPayment('RRR1'),
    ).rejects.toThrow(OperationFailedError);
  });
});

describe('RemitaProvider.handleWebhook', () => {
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

  const notification = (overrides: Record<string, unknown> = {}) => ({
    rrr: 'RRR1',
    channel: 'CARDPAYMENT',
    billerName: 'Test Biller',
    amount: 3500,
    transactiondate: '2021-01-20 00:00:00',
    debitdate: '2021-01-20 11:17:03',
    bank: '232',
    branch: '',
    serviceTypeId: 'SVC1',
    orderRef: 'ref1',
    orderId: 'ref1',
    payerName: 'John Doe',
    payerPhoneNumber: '07043049875',
    payerEmail: 'test@test.com',
    type: 'PY',
    ...overrides,
  });

  const dto = (body: string) => ({
    body,
    headersAsObject: {} as Record<string, string>,
    fullUrl: 'https://app.example.com/api/webhook',
  });

  const statusResponse = (status: string) =>
    jsonResponse({
      amount: 3500,
      RRR: 'RRR1',
      orderId: 'ref1',
      message: 'status',
      transactiontime: '2021-01-20 11:17:03',
      status,
    });

  it('re-verifies against the status API and emits payment.succeeded', async () => {
    fetchMock.mockResolvedValueOnce(statusResponse('01'));

    const events = await makeProvider().handleWebhook(
      dto(JSON.stringify([notification()])),
      null,
    );

    expect(events.map(e => e.type)).toEqual([
      'remita.notification',
      'payment.succeeded',
    ]);
    expect(events[0].is_raw).toBe(true);
    expect(events[0].data).toMatchObject({ rrr: 'RRR1' });
  });

  it('emits payment.failed when the status check reports failure', async () => {
    fetchMock.mockResolvedValueOnce(statusResponse('02'));

    const events = await makeProvider().handleWebhook(
      dto(JSON.stringify([notification()])),
      null,
    );

    expect(events.map(e => e.type)).toEqual([
      'remita.notification',
      'payment.failed',
    ]);
  });

  it('emits payment.updated when the status check reports pending', async () => {
    fetchMock.mockResolvedValueOnce(statusResponse('021'));

    const events = await makeProvider().handleWebhook(
      dto(JSON.stringify([notification()])),
      null,
    );

    expect(events.map(e => e.type)).toEqual([
      'remita.notification',
      'payment.updated',
    ]);
  });

  it('ignores the webhookSecret argument - Remita has no signature to verify', async () => {
    fetchMock.mockResolvedValueOnce(statusResponse('01'));

    const events = await makeProvider().handleWebhook(
      dto(JSON.stringify([notification()])),
      'totally-invalid-secret',
    );

    expect(events.map(e => e.type)).toEqual([
      'remita.notification',
      'payment.succeeded',
    ]);
  });

  it('handles a single (non-array) notification object', async () => {
    fetchMock.mockResolvedValueOnce(statusResponse('01'));

    const events = await makeProvider().handleWebhook(
      dto(JSON.stringify(notification())),
      null,
    );

    expect(events.map(e => e.type)).toEqual([
      'remita.notification',
      'payment.succeeded',
    ]);
  });

  it('throws WebhookError on malformed JSON', async () => {
    await expect(
      makeProvider().handleWebhook(dto('not json'), null),
    ).rejects.toThrow(WebhookError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emits only the raw event when the RRR cannot be re-verified', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        amount: 0,
        RRR: '',
        orderId: '',
        message: 'Invalid RRR',
        transactiontime: '',
        status: '022',
      }),
    );

    const events = await makeProvider().handleWebhook(
      dto(JSON.stringify([notification()])),
      null,
    );

    expect(events.map(e => e.type)).toEqual(['remita.notification']);
  });
});

describe('RemitaProvider unsupported operations', () => {
  it('throws ProviderNotSupportedError for checkout operations', async () => {
    const provider = makeProvider();

    await expect(
      provider.createCheckout({} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(provider.retrieveCheckout('id')).rejects.toThrow(
      ProviderNotSupportedError,
    );
    await expect(
      provider.updateCheckout('id', {} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(provider.deleteCheckout('id')).rejects.toThrow(
      ProviderNotSupportedError,
    );
  });

  it('throws ProviderNotSupportedError for customer operations', async () => {
    const provider = makeProvider();

    await expect(
      provider.createCustomer({} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(provider.retrieveCustomer('id')).rejects.toThrow(
      ProviderNotSupportedError,
    );
    await expect(
      provider.updateCustomer('id', {} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(provider.deleteCustomer('id')).rejects.toThrow(
      ProviderNotSupportedError,
    );
  });

  it('throws ProviderNotSupportedError for subscription operations', async () => {
    const provider = makeProvider();

    await expect(
      provider.createSubscription({} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(
      provider.updateSubscription('id', {} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(provider.cancelSubscription('id')).rejects.toThrow(
      ProviderNotSupportedError,
    );
    await expect(provider.deleteSubscription('id')).rejects.toThrow(
      ProviderNotSupportedError,
    );
    await expect(provider.retrieveSubscription('id')).rejects.toThrow(
      ProviderNotSupportedError,
    );
  });

  it('throws ProviderNotSupportedError for updatePayment / deletePayment / capturePayment / createRefund', async () => {
    const provider = makeProvider();

    await expect(
      provider.updatePayment('id', {} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(provider.deletePayment('id')).rejects.toThrow(
      ProviderNotSupportedError,
    );
    await expect(
      provider.capturePayment('id', { amount: 100 }),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(provider.createRefund({} as never)).rejects.toThrow(
      ProviderNotSupportedError,
    );
  });
});
