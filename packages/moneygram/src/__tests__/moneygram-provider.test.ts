import {
  ConfigurationError,
  ProviderNotSupportedError,
  WebhookError,
} from '@paykit-sdk/core';
import * as crypto from 'crypto';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { MoneyGramProvider } from '../moneygram-provider';

const makeProvider = () =>
  new MoneyGramProvider({
    clientId: 'client_1',
    clientSecret: 'moneygram_test_secret',
    agentPartnerId: '30150519',
    operatorId: 'paykit-web',
    isSandbox: true,
    debug: false,
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const tokenResponse = () =>
  jsonResponse({
    access_token: 'tok_1',
    expires_in: 3599,
    token_type: 'BearerToken',
  });

const senderFixture = {
  name: { firstName: 'John', lastName: 'Doe' },
  address: {
    line1: '123 Main St',
    city: 'Dallas',
    countryCode: 'USA',
  },
  mobilePhone: { number: '5551234567', countryDialCode: '1' },
  personalDetails: { dateOfBirth: '1990-01-01' },
  primaryIdentification: {
    typeCode: 'PPT',
    id: 'X1234567',
    issueCountryCode: 'USA',
  },
};

const receiverFixture = {
  name: { firstName: 'Jane', lastName: 'Smith' },
};

const basePaymentParams = {
  customer: { email: 'sender@example.com' },
  amount: 100,
  currency: 'usd',
  item_id: 'transfer-to-jane',
  capture_method: 'automatic' as const,
  metadata: {},
  provider_metadata: {
    destinationCountryCode: 'PHL',
    serviceOptionCode: 'WILL_CALL',
    sender: senderFixture,
    receiver: receiverFixture,
  },
};

const quoteFixture = () => ({
  transactions: [
    {
      transactionId: 'txn_1',
      serviceOptionCode: 'WILL_CALL',
      serviceOptionName: 'Cash Pickup',
      estimatedDelivery: 'Within minutes',
      sendAmount: {
        amount: { value: 100, currencyCode: 'USD' },
        fees: { value: 5, currencyCode: 'USD' },
        total: { value: 105, currencyCode: 'USD' },
      },
      receiveAmount: {
        amount: { value: 5600, currencyCode: 'PHP' },
        total: { value: 5600, currencyCode: 'PHP' },
        fxRate: 56,
      },
    },
  ],
});

const updateFixture = (extra: Record<string, unknown> = {}) => ({
  readyForCommit: true,
  transactionId: 'txn_1',
  serviceOptionName: 'Cash Pickup',
  sendAmount: {
    amount: { value: 100, currencyCode: 'USD' },
    fees: { value: 5, currencyCode: 'USD' },
    total: { value: 105, currencyCode: 'USD' },
  },
  receiveAmount: {
    amount: { value: 5600, currencyCode: 'PHP' },
    total: { value: 5600, currencyCode: 'PHP' },
    fxRate: 56,
  },
  additionalDetails: {
    __paykit: JSON.stringify({ item: 'transfer-to-jane' }),
  },
  ...extra,
});

const commitFixture = () => ({
  referenceNumber: '12345678',
  expectedPayoutDate: '2026-08-01',
});

describe('MoneyGramProvider constructor', () => {
  it('throws ConfigurationError when credentials are missing', () => {
    expect(
      () =>
        new MoneyGramProvider({
          clientId: 'client_1',
          isSandbox: true,
        } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('moneygram');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('MoneyGramProvider.createPayment', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs the quote -> update -> commit flow and returns a succeeded Payment', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(quoteFixture()))
      .mockResolvedValueOnce(jsonResponse(updateFixture()))
      .mockResolvedValueOnce(jsonResponse(commitFixture()));

    const payment = await makeProvider().createPayment(
      basePaymentParams as never,
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://sandboxapi.moneygram.com/oauth/accesstoken?grant_type=client_credentials',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://sandboxapi.moneygram.com/transfer/v1/transactions/quote',
    );
    expect(fetchMock.mock.calls[2][0]).toBe(
      'https://sandboxapi.moneygram.com/transfer/v1/transactions/txn_1',
    );
    expect(fetchMock.mock.calls[3][0]).toBe(
      'https://sandboxapi.moneygram.com/transfer/v1/transactions/txn_1/commit',
    );

    const quoteBody = JSON.parse(
      (fetchMock.mock.calls[1][1] as { body: string }).body,
    );
    expect(quoteBody.sendAmount).toEqual({
      value: 100,
      currencyCode: 'USD',
    });
    expect(quoteBody.destinationCountryCode).toBe('PHL');

    const updateBody = JSON.parse(
      (fetchMock.mock.calls[2][1] as { body: string }).body,
    );
    expect(updateBody.sender).toMatchObject(senderFixture);
    expect(updateBody.receiver).toMatchObject(receiverFixture);
    const stored = JSON.parse(updateBody.additionalDetails.__paykit);
    expect(stored).toMatchObject({ item: 'transfer-to-jane' });

    expect(payment.id).toBe('txn_1');
    expect(payment.amount).toBe(100);
    expect(payment.currency).toBe('USD');
    expect(payment.status).toBe('succeeded');
    expect(payment.item_id).toBe('transfer-to-jane');
  });

  it('rejects capture_method: manual since MoneyGram commits immediately', async () => {
    await expect(
      makeProvider().createPayment({
        ...basePaymentParams,
        capture_method: 'manual',
      } as never),
    ).rejects.toThrow(ProviderNotSupportedError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when provider_metadata.destinationCountryCode is missing', async () => {
    const { destinationCountryCode, ...rest } =
      basePaymentParams.provider_metadata;

    await expect(
      makeProvider().createPayment({
        ...basePaymentParams,
        provider_metadata: rest,
      } as never),
    ).rejects.toThrow(/destinationCountryCode/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws ConfigurationError when provider_metadata.sender is missing', async () => {
    const { sender, ...rest } = basePaymentParams.provider_metadata;

    await expect(
      makeProvider().createPayment({
        ...basePaymentParams,
        provider_metadata: rest,
      } as never),
    ).rejects.toThrow(ConfigurationError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws ConfigurationError when provider_metadata.receiver is missing', async () => {
    const { receiver, ...rest } = basePaymentParams.provider_metadata;

    await expect(
      makeProvider().createPayment({
        ...basePaymentParams,
        provider_metadata: rest,
      } as never),
    ).rejects.toThrow(ConfigurationError);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('MoneyGramProvider.createCheckout', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseCheckoutParams = {
    customer: { email: 'sender@example.com' },
    item_id: 'transfer-to-jane',
    quantity: 1,
    session_type: 'one_time' as const,
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
    metadata: {},
    provider_metadata: {
      amount: 100,
      currency: 'usd',
      destinationCountryCode: 'PHL',
      serviceOptionCode: 'WILL_CALL',
      sender: senderFixture,
      receiver: receiverFixture,
    },
  };

  it('runs the same quote -> update -> commit flow as createPayment, using amount/currency from provider_metadata', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(quoteFixture()))
      .mockResolvedValueOnce(
        jsonResponse(
          updateFixture({
            additionalDetails: {
              __paykit: JSON.stringify({
                item: 'transfer-to-jane',
                qty: 1,
              }),
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...commitFixture(),
          commitReceipt: {
            consumerHyperLink: 'https://moneygram.com/receipt/abc',
          },
        }),
      );

    const checkout = await makeProvider().createCheckout(
      baseCheckoutParams as never,
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://sandboxapi.moneygram.com/transfer/v1/transactions/quote',
    );

    const quoteBody = JSON.parse(
      (fetchMock.mock.calls[1][1] as { body: string }).body,
    );
    expect(quoteBody.sendAmount).toEqual({
      value: 100,
      currencyCode: 'USD',
    });

    expect(checkout.id).toBe('txn_1');
    expect(checkout.amount).toBe(100);
    expect(checkout.currency).toBe('USD');
    expect(checkout.session_type).toBe('one_time');
    expect(checkout.products).toEqual([
      { id: 'transfer-to-jane', quantity: 1 },
    ]);
    expect(checkout.payment_url).toBe(
      'https://moneygram.com/receipt/abc',
    );
  });

  it('throws when provider_metadata.amount/currency are missing', async () => {
    const { amount, currency, ...rest } =
      baseCheckoutParams.provider_metadata;

    await expect(
      makeProvider().createCheckout({
        ...baseCheckoutParams,
        provider_metadata: rest,
      } as never),
    ).rejects.toThrow(/amount|currency/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws ConfigurationError when provider_metadata.sender is missing', async () => {
    const { sender, ...rest } = baseCheckoutParams.provider_metadata;

    await expect(
      makeProvider().createCheckout({
        ...baseCheckoutParams,
        provider_metadata: rest,
      } as never),
    ).rejects.toThrow(ConfigurationError);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('MoneyGramProvider.retrieveCheckout / updateCheckout', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const statusFixture = () => ({
    transactionId: 'txn_1',
    referenceNumber: '12345678',
    transactionSendDateTime: '2026-07-20T10:00:00.000',
    expectedPayoutDate: '2026-07-22',
    transactionStatus: 'SENT',
    originatingCountryCode: 'USA',
    destinationCountryCode: 'PHL',
    serviceOptionCode: 'WILL_CALL',
    serviceOptionName: 'Cash Pickup',
    sendAmount: { amount: { value: 100, currencyCode: 'USD' } },
    receiveAmount: {
      amount: { value: 5600, currencyCode: 'PHP' },
      total: { value: 5600, currencyCode: 'PHP' },
      fxRate: 56,
    },
    sender: { name: { firstName: 'John', lastName: 'Doe' } },
    receiver: { name: { firstName: 'Jane', lastName: 'Smith' } },
    additionalDetails: {
      __paykit: JSON.stringify({ item: 'transfer-to-jane', qty: 2 }),
    },
  });

  it('retrieveCheckout maps the Status API response onto Checkout, recovering item/quantity', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(statusFixture()));

    const checkout = await makeProvider().retrieveCheckout('txn_1');

    expect(checkout?.id).toBe('txn_1');
    expect(checkout?.amount).toBe(100);
    expect(checkout?.currency).toBe('USD');
    expect(checkout?.session_type).toBe('one_time');
    expect(checkout?.products).toEqual([
      { id: 'transfer-to-jane', quantity: 2 },
    ]);
    // Receipt hyperlinks aren't returned by the Status API - only at commit time.
    expect(checkout?.payment_url).toBe('');
  });

  it('retrieveCheckout returns null on a 404', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        jsonResponse({ errors: [{ message: 'not found' }] }, 404),
      );

    await expect(
      makeProvider().retrieveCheckout('does-not-exist'),
    ).resolves.toBeNull();
  });

  it('updateCheckout amends the receiver name via PATCH, then re-fetches as a Checkout', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse(statusFixture()));

    const checkout = await makeProvider().updateCheckout('txn_1', {
      metadata: {},
      provider_metadata: {
        receiverFirstName: 'Jane',
        receiverLastName: 'Smith Corrected',
      },
    } as never);

    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://sandboxapi.moneygram.com/amend/v1/transactions/txn_1/receiver/name',
    );
    expect(checkout.id).toBe('txn_1');
  });

  it('updateCheckout without receiver name fields just re-fetches', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(statusFixture()));

    const checkout = await makeProvider().updateCheckout('txn_1', {
      metadata: {},
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(checkout.id).toBe('txn_1');
  });
});

describe('MoneyGramProvider.retrievePayment', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const statusFixture = (
    transactionStatus: string,
    extra: Record<string, unknown> = {},
  ) => ({
    transactionId: 'txn_1',
    referenceNumber: '12345678',
    transactionSendDateTime: '2026-07-20T10:00:00.000',
    expectedPayoutDate: '2026-07-22',
    transactionStatus,
    originatingCountryCode: 'USA',
    destinationCountryCode: 'PHL',
    serviceOptionCode: 'WILL_CALL',
    serviceOptionName: 'Cash Pickup',
    sendAmount: {
      amount: { value: 100, currencyCode: 'USD' },
      fees: { value: 5, currencyCode: 'USD' },
      total: { value: 105, currencyCode: 'USD' },
    },
    receiveAmount: {
      amount: { value: 5600, currencyCode: 'PHP' },
      total: { value: 5600, currencyCode: 'PHP' },
      fxRate: 56,
    },
    sender: { name: { firstName: 'John', lastName: 'Doe' } },
    receiver: { name: { firstName: 'Jane', lastName: 'Smith' } },
    additionalDetails: {
      __paykit: JSON.stringify({ item: 'transfer-to-jane' }),
    },
    ...extra,
  });

  it.each([
    ['UNFUNDED', 'requires_action'],
    ['SENT', 'succeeded'],
    ['AVAILABLE', 'succeeded'],
    ['IN_TRANSIT', 'succeeded'],
    ['RECEIVED', 'succeeded'],
    ['DELIVERED', 'succeeded'],
    ['PROCESSING', 'processing'],
    ['REJECTED', 'failed'],
    ['REFUNDED', 'canceled'],
    ['CLOSED', 'canceled'],
  ])(
    'maps MoneyGram status %s to PayKit status %s',
    async (mgStatus, paykitStatus) => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse(statusFixture(mgStatus)));

      const payment = await makeProvider().retrievePayment('txn_1');

      expect(payment?.status).toBe(paykitStatus);
      expect(payment?.item_id).toBe('transfer-to-jane');
    },
  );

  it('returns null on a 404', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        jsonResponse({ errors: [{ message: 'not found' }] }, 404),
      );

    const payment =
      await makeProvider().retrievePayment('does-not-exist');

    expect(payment).toBeNull();
  });
});

describe('MoneyGramProvider.createRefund', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const retrieveFixture = (extra: Record<string, unknown> = {}) => ({
    transactionId: 'txn_1',
    refundId: 'refund_1',
    transactionStatus: 'SENT',
    availableForRefund: true,
    sendAmount: { amount: { value: 100, currencyCode: 'USD' } },
    ...extra,
  });

  it('retrieves then commits the refund', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(retrieveFixture()))
      .mockResolvedValueOnce(
        jsonResponse({
          referenceNumber: '12345678',
          expectedPayoutDate: '2026-08-01',
        }),
      );

    const refund = await makeProvider().createRefund({
      payment_id: 'txn_1',
      amount: 100,
      reason: 'requested_by_customer',
      metadata: null,
      provider_metadata: { refundReasonCode: 'CUSTOMER_REQUEST' },
    } as never);

    expect(fetchMock.mock.calls[1][0]).toContain(
      '/refund/v2/transactions/txn_1?',
    );
    expect(fetchMock.mock.calls[1][0]).toContain(
      'refundReasonCode=CUSTOMER_REQUEST',
    );
    expect(fetchMock.mock.calls[2][0]).toBe(
      'https://sandboxapi.moneygram.com/refund/v2/transactions/txn_1/commit',
    );

    const commitBody = JSON.parse(
      (fetchMock.mock.calls[2][1] as { body: string }).body,
    );
    expect(commitBody.refundId).toBe('refund_1');

    expect(refund.id).toBe('refund_1');
    expect(refund.amount).toBe(100);
    expect(refund.currency).toBe('USD');
  });

  it('throws when the transaction is not available for refund', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        jsonResponse(retrieveFixture({ availableForRefund: false })),
      );

    await expect(
      makeProvider().createRefund({
        payment_id: 'txn_1',
        amount: 100,
        reason: null,
        metadata: null,
        provider_metadata: { refundReasonCode: 'CUSTOMER_REQUEST' },
      } as never),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when provider_metadata.refundReasonCode is missing', async () => {
    await expect(
      makeProvider().createRefund({
        payment_id: 'txn_1',
        amount: 100,
        reason: null,
        metadata: null,
      } as never),
    ).rejects.toThrow(/refundReasonCode/);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('MoneyGramProvider.updatePayment', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const statusFixture = () => ({
    transactionId: 'txn_1',
    referenceNumber: '12345678',
    transactionSendDateTime: '2026-07-20T10:00:00.000',
    expectedPayoutDate: '2026-07-22',
    transactionStatus: 'AVAILABLE',
    originatingCountryCode: 'USA',
    destinationCountryCode: 'PHL',
    serviceOptionCode: 'WILL_CALL',
    serviceOptionName: 'Cash Pickup',
    sendAmount: { amount: { value: 100, currencyCode: 'USD' } },
    receiveAmount: {
      amount: { value: 5600, currencyCode: 'PHP' },
      total: { value: 5600, currencyCode: 'PHP' },
      fxRate: 56,
    },
    sender: { name: { firstName: 'John', lastName: 'Doe' } },
    receiver: {
      name: { firstName: 'Jane', lastName: 'Smith Corrected' },
    },
  });

  it('amends the receiver name via PATCH, then re-fetches the transaction', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse()) // fetched once, then cached
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse(statusFixture()));

    const payment = await makeProvider().updatePayment('txn_1', {
      metadata: {},
      provider_metadata: {
        receiverFirstName: 'Jane',
        receiverLastName: 'Smith Corrected',
      },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://sandboxapi.moneygram.com/amend/v1/transactions/txn_1/receiver/name',
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[1][1] as { body: string }).body,
    );
    expect(body.name).toMatchObject({
      firstName: 'Jane',
      lastName: 'Smith Corrected',
    });

    expect(payment.id).toBe('txn_1');
  });

  it('without receiver name fields, just re-fetches the current transaction', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(statusFixture()));

    const payment = await makeProvider().updatePayment('txn_1', {
      metadata: {},
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(payment.id).toBe('txn_1');
  });
});

describe('MoneyGramProvider.handleWebhook', () => {
  const fetchMock = vi.fn();

  const { publicKey, privateKey } = crypto.generateKeyPairSync(
    'rsa',
    {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    },
  );

  const publicKeyBase64 = publicKey.toString('base64');

  // MoneyGram publishes exactly one fixed public key per environment - it
  // isn't something a caller supplies (see getWebhookPublicKey's JSDoc).
  // Since we don't have MoneyGram's real private key to sign test
  // payloads with, override the resolved key with a locally generated
  // one instead of relying on the (unused) webhookSecret parameter.
  class TestableMoneyGramProvider extends MoneyGramProvider {
    protected getWebhookPublicKey(): string {
      return publicKeyBase64;
    }
  }

  const makeWebhookProvider = () =>
    new TestableMoneyGramProvider({
      clientId: 'client_1',
      clientSecret: 'moneygram_test_secret',
      agentPartnerId: '30150519',
      operatorId: 'paykit-web',
      isSandbox: true,
      debug: false,
    });

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const eventFixture = (
    transactionStatus: string,
    extra: Record<string, unknown> = {},
  ) => ({
    eventId: 'evt_1',
    eventDate: '2026-07-20T10:00:00.000',
    subscriptionId: 'sub_1',
    subscriptionType: 'TRANSACTION_STATUS_EVENT',
    eventPayload: {
      transactionId: 'txn_1',
      agentPartnerId: '30150519',
      referenceNumber: '12345678',
      transactionSendDate: '2026-07-20T10:00:00.000',
      transactionStatusDate: '2026-07-20T10:00:00.000',
      expectedPayoutDate: '2026-07-22',
      transactionStatus,
      ...extra,
    },
  });

  const statusFixture = (transactionStatus: string) => ({
    transactionId: 'txn_1',
    referenceNumber: '12345678',
    transactionSendDateTime: '2026-07-20T10:00:00.000',
    expectedPayoutDate: '2026-07-22',
    transactionStatus,
    originatingCountryCode: 'USA',
    destinationCountryCode: 'PHL',
    serviceOptionCode: 'WILL_CALL',
    serviceOptionName: 'Cash Pickup',
    sendAmount: { amount: { value: 100, currencyCode: 'USD' } },
    receiveAmount: {
      amount: { value: 5600, currencyCode: 'PHP' },
      total: { value: 5600, currencyCode: 'PHP' },
      fxRate: 56,
    },
    sender: { name: { firstName: 'John', lastName: 'Doe' } },
    receiver: { name: { firstName: 'Jane', lastName: 'Smith' } },
  });

  const sign = (body: string, host: string, timestamp: number) => {
    const signedPayload = `${timestamp}.${host}.${body}`;
    const signatureBase64 = crypto
      .createSign('RSA-SHA256')
      .update(signedPayload)
      .sign(privateKey)
      .toString('base64');
    return `t=${timestamp}, s=${signatureBase64}`;
  };

  const makeWebhookDto = (
    body: string,
    timestamp = Math.floor(Date.now() / 1000),
  ) => ({
    body,
    headersAsObject: {
      signature: sign(body, 'app.example.com', timestamp),
    },
    fullUrl: 'https://app.example.com/api/webhook',
  });

  it('rejects when the Signature header is missing', async () => {
    await expect(
      makeWebhookProvider().handleWebhook(
        {
          body: '{}',
          headersAsObject: {},
          fullUrl: 'https://app.example.com/api/webhook',
        },
        null,
      ),
    ).rejects.toThrow(WebhookError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature', async () => {
    const body = JSON.stringify(eventFixture('SENT'));
    const dto = makeWebhookDto(body);
    dto.headersAsObject.signature =
      dto.headersAsObject.signature.replace(
        /s=.+$/,
        's=dGFtcGVyZWQ=',
      );

    await expect(
      makeWebhookProvider().handleWebhook(dto, null),
    ).rejects.toThrow(WebhookError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a stale timestamp outside the 65 minute window', async () => {
    const body = JSON.stringify(eventFixture('SENT'));
    const staleTimestamp = Math.floor(Date.now() / 1000) - 66 * 60;
    const dto = makeWebhookDto(body, staleTimestamp);

    await expect(
      makeWebhookProvider().handleWebhook(dto, null),
    ).rejects.toThrow(WebhookError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emits payment.succeeded for SENT after re-fetching the transaction', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(statusFixture('SENT')));

    const body = JSON.stringify(eventFixture('SENT'));
    const events = await makeWebhookProvider().handleWebhook(
      makeWebhookDto(body),
      null,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('payment.succeeded');
  });

  it('emits payment.created for UNFUNDED', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(statusFixture('UNFUNDED')));

    const body = JSON.stringify(eventFixture('UNFUNDED'));
    const events = await makeWebhookProvider().handleWebhook(
      makeWebhookDto(body),
      null,
    );

    expect(events[0].type).toBe('payment.created');
  });

  it('emits payment.failed for REJECTED', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(statusFixture('REJECTED')));

    const body = JSON.stringify(eventFixture('REJECTED'));
    const events = await makeWebhookProvider().handleWebhook(
      makeWebhookDto(body),
      null,
    );

    expect(events[0].type).toBe('payment.failed');
  });

  it('emits payment.updated for AVAILABLE (post-succeeded delivery tracking)', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        jsonResponse(statusFixture('AVAILABLE')),
      );

    const body = JSON.stringify(eventFixture('AVAILABLE'));
    const events = await makeWebhookProvider().handleWebhook(
      makeWebhookDto(body),
      null,
    );

    expect(events[0].type).toBe('payment.updated');
  });

  it('emits refund.created for REFUNDED', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(statusFixture('REFUNDED')));

    const body = JSON.stringify(eventFixture('REFUNDED'));
    const events = await makeWebhookProvider().handleWebhook(
      makeWebhookDto(body),
      null,
    );

    expect(events[0].type).toBe('refund.created');
  });

  it('throws when the transaction event has no transactionId', async () => {
    const body = JSON.stringify(
      eventFixture('SENT', { transactionId: undefined }),
    );

    await expect(
      makeWebhookProvider().handleWebhook(makeWebhookDto(body), null),
    ).rejects.toThrow(WebhookError);
  });

  it('ignores the webhookSecret argument - verification always uses getWebhookPublicKey()', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(statusFixture('SENT')));

    const body = JSON.stringify(eventFixture('SENT'));

    // A garbage webhookSecret changes nothing - the signature was made
    // with the private key matching getWebhookPublicKey()'s override.
    const events = await makeWebhookProvider().handleWebhook(
      makeWebhookDto(body),
      'this-is-not-used-for-anything',
    );

    expect(events[0].type).toBe('payment.succeeded');
  });
});

describe('MoneyGramProvider unsupported operations', () => {
  it('throws ProviderNotSupportedError for createCustomer / createSubscription', async () => {
    const provider = makeProvider();

    await expect(
      provider.createCustomer({} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(
      provider.createSubscription({} as never),
    ).rejects.toThrow(ProviderNotSupportedError);
  });

  it('throws ProviderNotSupportedError for capturePayment / cancelPayment / deletePayment / deleteCheckout', async () => {
    const provider = makeProvider();

    await expect(
      provider.capturePayment('txn_1', { amount: 100 }),
    ).rejects.toThrow(ProviderNotSupportedError);
    await expect(provider.cancelPayment('txn_1')).rejects.toThrow(
      ProviderNotSupportedError,
    );
    await expect(provider.deletePayment('txn_1')).rejects.toThrow(
      ProviderNotSupportedError,
    );
    await expect(provider.deleteCheckout('txn_1')).rejects.toThrow(
      ProviderNotSupportedError,
    );
  });
});
