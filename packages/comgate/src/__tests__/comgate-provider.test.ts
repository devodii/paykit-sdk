import { ConfigurationError, WebhookError } from '@paykit-sdk/core';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { ComgateProvider } from '../comgate-provider';

const makeProvider = () =>
  new ComgateProvider({
    merchant: 'merchant_1',
    secret: 'comgate_test_secret',
    isSandbox: true,
    debug: false,
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const urlencodedWebhookDto = (
  overrides: Record<string, string> = {},
) => {
  const params = new URLSearchParams({
    merchant: 'merchant_1',
    secret: 'comgate_test_secret',
    transId: 'TX-1',
    status: 'PAID',
    ...overrides,
  });
  return {
    body: params.toString(),
    headersAsObject: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    fullUrl: 'https://app.example.com/api/webhook',
  };
};

const verifiedStatusResponse = (status = 'PAID') => ({
  code: 0,
  message: 'OK',
  merchant: 'merchant_1',
  transId: 'TX-1',
  status,
  price: 10000,
  curr: 'CZK',
  refId: '{}',
  email: 'buyer@example.com',
  name: 'item_1',
});

describe('ComgateProvider constructor', () => {
  it('throws ConfigurationError when secret is missing', () => {
    expect(
      () =>
        new ComgateProvider({
          merchant: 'm',
          isSandbox: true,
        } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('comgate');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('ComgateProvider.handleWebhook', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects when the webhook secret does not match', async () => {
    await expect(
      makeProvider().handleWebhook(
        urlencodedWebhookDto({ secret: 'attacker_value' }),
        null,
      ),
    ).rejects.toThrow('Webhook secret mismatch');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when the merchant does not match', async () => {
    await expect(
      makeProvider().handleWebhook(
        urlencodedWebhookDto({ merchant: 'other' }),
        null,
      ),
    ).rejects.toThrow('Webhook merchant mismatch');
  });

  it('rejects when required parameters are missing', async () => {
    const params = new URLSearchParams({
      merchant: 'merchant_1',
      secret: 'comgate_test_secret',
    });

    await expect(
      makeProvider().handleWebhook(
        {
          body: params.toString(),
          headersAsObject: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          fullUrl: 'https://app.example.com/api/webhook',
        },
        null,
      ),
    ).rejects.toThrow(/transId|status/);
  });

  it('verifies the transaction server-side before emitting events', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(verifiedStatusResponse('PAID')),
    );

    await makeProvider().handleWebhook(urlencodedWebhookDto(), null);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.comgate.cz/v1.0/status');
    expect(options.method).toBe('POST');
    expect(String(options.body)).toContain('transId=TX-1');
  });

  it('rejects when the server-side status disagrees with the webhook', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(verifiedStatusResponse('CANCELLED')),
    );

    await expect(
      makeProvider().handleWebhook(urlencodedWebhookDto(), null),
    ).rejects.toThrow(/status mismatch/i);
  });

  it('emits payment.succeeded + invoice.generated for PAID', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(verifiedStatusResponse('PAID')),
    );

    const events = await makeProvider().handleWebhook(
      urlencodedWebhookDto(),
      null,
    );

    expect(events.map(e => e.type)).toEqual([
      'payment.succeeded',
      'invoice.generated',
    ]);
    expect(events[0].data).toMatchObject({
      id: 'TX-1',
      amount: 10000,
      currency: 'CZK',
      status: 'succeeded',
      customer: { email: 'buyer@example.com' },
    });
    expect(events[1].data).toMatchObject({
      id: 'TX-1',
      status: 'paid',
      amount_paid: 10000,
    });
  });

  it('emits payment.failed for CANCELLED', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(verifiedStatusResponse('CANCELLED')),
    );

    const events = await makeProvider().handleWebhook(
      urlencodedWebhookDto({ status: 'CANCELLED' }),
      null,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('payment.failed');
    expect(events[0].data).toMatchObject({
      id: 'TX-1',
      status: 'canceled',
    });
  });

  it('throws WebhookError for unmapped Comgate statuses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(verifiedStatusResponse('AUTHORIZED')),
    );

    // AUTHORIZED maps to requires_capture which has a handler; use an
    // unknown status instead to hit the unmapped branch.
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(verifiedStatusResponse('SOMETHING_ELSE')),
    );

    await expect(
      makeProvider().handleWebhook(
        urlencodedWebhookDto({ status: 'SOMETHING_ELSE' }),
        null,
      ),
    ).rejects.toThrow(WebhookError);
  });
});
