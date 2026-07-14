import {
  AbstractPayKitProvider,
  CapturePaymentSchema,
  Checkout,
  ConfigurationError,
  CreateCheckoutSchema,
  CreateCustomerParams,
  CreatePaymentSchema,
  CreateRefundSchema,
  CreateSubscriptionSchema,
  Customer,
  HTTPClient,
  InvalidTypeError,
  isEmailCustomer,
  isIdCustomer,
  OAuth2TokenManager,
  OperationFailedError,
  PAYKIT_METADATA_KEY,
  PayKitProvider,
  PaykitProviderOptions,
  Payment,
  paykitEvent$InboundSchema,
  ProviderMetadataRegistry,
  ProviderNotSupportedError,
  Refund,
  schema,
  stringifyMetadataValues,
  Subscription,
  UpdateCheckoutSchema,
  UpdateCustomerParams,
  UpdatePaymentSchema,
  UpdateSubscriptionSchema,
  validateRequiredKeys,
  ValidationError,
  WebhookError,
  WebhookEventPayload,
  WebhookHandlerConfig,
  createCheckoutSchema,
  createPaymentSchema,
  createRefundSchema,
} from '@paykit-sdk/core';
import * as crypto from 'crypto';
import { z } from 'zod';
import {
  MoneyGramAmendReceiverNameRequest,
  MoneyGramCommitTransactionRequest,
  MoneyGramCommitTransactionResponse,
  MoneyGramErrorResponse,
  MoneyGramFundingSource,
  MoneyGramQuoteRequest,
  MoneyGramQuoteResponse,
  MoneyGramRawEvents,
  MoneyGramReceiver,
  MoneyGramRefundCommitRequest,
  MoneyGramRefundCommitResponse,
  MoneyGramRefundRetrieveResponse,
  MoneyGramSender,
  MoneyGramTransactionInformation,
  MoneyGramTransactionStatusEvent,
  MoneyGramTransactionStatusResponse,
  MoneyGramUpdateTransactionRequest,
  MoneyGramUpdateTransactionResponse,
} from './schema';
import {
  Checkout$inboundSchema,
  MoneyGramPaymentSnapshot,
  Payment$inboundSchema,
  Refund$inboundSchema,
} from './utils/mapper';

interface MoneyGramPaymentMetadata {
  /**
   * Required. The receiving country for the transfer (ISO alpha-3, e.g. "PHL").
   */
  destinationCountryCode: string;

  /**
   * Required. The transfer method, e.g. "WILL_CALL" (cash pickup) or a
   * bank/wallet routing option. Returned by the Quote step if omitted.
   */
  serviceOptionCode?: string;

  destinationCountrySubdivisionCode?: string;
  serviceOptionRoutingCode?: string;

  /**
   * Required. Full sender KYC data - MoneyGram has no customer-object API,
   * so this must be supplied on every createPayment call.
   * @see https://developer.moneygram.com/moneygram-developer/docs/update-a-transaction
   */
  sender: MoneyGramSender;

  /**
   * Required. Receiver name (address/phone required for some service options).
   */
  receiver: MoneyGramReceiver;

  receiveCurrencyCode?: string;
  fundingSource?: MoneyGramFundingSource;
  targetAccountProfileId?: string;
  targetAccount?: Record<string, string>;
  transactionInformation?: MoneyGramTransactionInformation;
  partnerTransactionId?: string;

  /** Overrides the provider-level default of the same name. */
  agentPartnerId?: string;
  operatorId?: string;
  posId?: string;
  userLanguage?: string;
  targetAudience?: string;

  /**
   * Amend a committed transaction's receiver name via updatePayment - only
   * used by `updatePayment`, ignored by `createPayment`.
   * @see https://developer.moneygram.com/moneygram-developer/docs/amend-api-overview
   */
  receiverFirstName?: string;
  receiverMiddleName?: string;
  receiverLastName?: string;
  receiverSecondLastName?: string;
}

/**
 * `Checkout` has no top-level `amount`/`currency` (unlike `Payment`), so
 * checkouts must carry them via `provider_metadata` instead - everything
 * else is identical to `MoneyGramPaymentMetadata` since `createCheckout`
 * runs the exact same Quote -> Update -> Commit flow as `createPayment`.
 */
interface MoneyGramCheckoutMetadata extends MoneyGramPaymentMetadata {
  /**
   * Required. The amount to send, in `sendAmount` units (e.g. `2900` for $29.00).
   */
  amount: number | string;

  /**
   * Required. ISO alpha-3 currency code of `amount`.
   */
  currency: string;
}

interface MoneyGramRefundMetadata {
  /**
   * Required. MoneyGram's enumerated refund reason code.
   */
  refundReasonCode: string;

  /**
   * Whether to also refund the transaction fee. Defaults to provider behavior.
   */
  refundFee?: boolean;
}

interface MoneyGramMetadata extends ProviderMetadataRegistry {
  checkout: MoneyGramCheckoutMetadata;
  payment: MoneyGramPaymentMetadata;
  refund: MoneyGramRefundMetadata;
}

export interface MoneyGramOptions extends PaykitProviderOptions {
  /**
   * OAuth2 client ID issued by MoneyGram.
   */
  clientId: string;

  /**
   * OAuth2 client secret issued by MoneyGram.
   */
  clientSecret: string;

  /**
   * MoneyGram's assigned partner/agent identifier, sent as `agentPartnerId`
   * on every request unless overridden via `provider_metadata`.
   */
  agentPartnerId: string;

  /**
   * Identifies the operator/system making the call, sent as `operatorId`
   * on every request unless overridden via `provider_metadata`.
   */
  operatorId: string;

  /**
   * Point of sale identifier. Defaults to "01".
   */
  posId?: string;

  /**
   * Defaults to "en-US".
   */
  userLanguage?: string;

  /**
   * Tailors MoneyGram's error messages/field metadata. Defaults to "AGENT_FACING".
   */
  targetAudience?: string;
}

const moneygramOptionsSchema = schema<MoneyGramOptions>()(
  z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    agentPartnerId: z.string(),
    operatorId: z.string(),
    isSandbox: z.boolean(),
    posId: z.string().optional(),
    userLanguage: z.string().optional(),
    targetAudience: z.string().optional(),
    debug: z.boolean().optional(),
  }),
);

const providerName = 'moneygram';

/**
 * MoneyGram's published webhook signature verification public keys.
 * @see https://developer.moneygram.com/moneygram-developer/docs/security
 */
const SANDBOX_WEBHOOK_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Dm7LFleQyaXakYdNOvCv2Irm2ufOcncek0Q4J+MtzmEYvdlfhx5Sm206s2Z5l0/+6YyA3tFljRNCFar3lm96o/S6IFNo0xOsCy+Il7EzQNl4S7kojqnOGfgMgUBC/qxf0S7zkh7y0St8G3OpcjYg7Ff7PAFXmcgjk22F1lUeOqy+zyP2dRJ+NEKZrcHJhbFheB0dPH++e+1foHSfhz+I+Pt9DDaESJasJptZGo0Ww3U+KkPmrDriOLbvpdE4r7MKzeQfGa7SMx4VzhtWFa98/6V6MO29ZjkegejHBZsCekA/1NU0gAQhQnxuYsgdCn/9LogrWqUS8Tl44K2yPYCsQIDAQAB';

const PRODUCTION_WEBHOOK_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtPGnqyaDXdZgsYqLuj+hP44TM4hTgnQi+Giq25FIXITANi5kHqS7/PtxGl0QsJex84NabOVc20PI56Nwk2X2+tid1dAXnIDH4S0dQeNRjTt3QRd3eNn0ikCKFZ+yJWyZ2IR1bkWR+FHn1WBjeC5DwrF4Jpmpv6D+YJGvJRFsDbjS3VFypN4RxF146kHDm3T/5cTFDhXnubgjWhi/T7dYpN881bY4Lh8y3maNpruH99bzTZEtkpyBpm4dnBUnmWdSDNgchhT/8t6nLzVczp1bDSl8cV5WUsgftaDW1aVZrde2fVuEnNwEvD5eFv/C9/8KwBRqr898aw7ZzMD9Y9vBkQIDAQAB';

const toPemPublicKey = (base64Der: string): string => {
  const lines = base64Der.match(/.{1,64}/g) ?? [base64Der];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
};

export class MoneyGramProvider
  extends AbstractPayKitProvider
  implements
    PayKitProvider<MoneyGramMetadata, null, MoneyGramRawEvents>
{
  readonly providerName = providerName;
  readonly providerVersion = process.env.PROVIDER_VERSION!;

  private _client: HTTPClient;

  readonly isSandbox: boolean;

  private tokenManager: OAuth2TokenManager;

  get _native() {
    return null;
  }

  /**
   * MoneyGram publishes exactly one fixed public key per environment
   * (sandbox/production) for webhook signature verification - there's no
   * per-partner issuance or rotation mechanism documented, so this is
   * resolved purely from `isSandbox` rather than any caller input.
   * Protected (not private) only so tests can override it with a locally
   * generated keypair, since signing a real payload requires MoneyGram's
   * private key.
   * @see https://developer.moneygram.com/moneygram-developer/docs/security
   */
  protected getWebhookPublicKey(): string {
    return this.isSandbox
      ? SANDBOX_WEBHOOK_PUBLIC_KEY
      : PRODUCTION_WEBHOOK_PUBLIC_KEY;
  }

  constructor(private readonly opts: MoneyGramOptions) {
    super(moneygramOptionsSchema, opts, providerName);

    this.isSandbox = opts.isSandbox;

    const debug = opts.debug ?? true;

    const baseUrl = opts.isSandbox
      ? 'https://sandboxapi.moneygram.com'
      : 'https://api.moneygram.com';

    this._client = new HTTPClient({
      baseUrl,
      headers: {},
      retryOptions: { max: 3, baseDelay: 1000, debug },
    });

    this.tokenManager = new OAuth2TokenManager({
      client: this._client,
      provider: this.providerName,
      tokenEndpoint:
        '/oauth/accesstoken?grant_type=client_credentials',
      method: 'GET',
      credentials: {
        username: opts.clientId,
        password: opts.clientSecret,
      },
      responseAdapter: response => ({
        accessToken: response.access_token,
        expiresIn: response.expires_in,
      }),
      requestHeaders: { 'Content-Type': 'application/json' },
    });
  }

  private request = async <T>(
    method: 'get' | 'post' | 'put' | 'patch',
    path: string,
    body: unknown,
    operation: string,
  ): Promise<T> => {
    const headers = {
      ...(await this.tokenManager.getAuthHeaders()),
      'X-MG-ClientRequestId': crypto.randomUUID(),
    };

    const response = await this._client[method]<T>(path, {
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const err = response.error as
        | { message?: string; cause?: unknown }
        | undefined;
      const cause = err?.cause as MoneyGramErrorResponse | undefined;
      const message =
        cause?.errors?.map(e => e.message).join('; ') ??
        err?.message ??
        JSON.stringify(response.error ?? response);

      throw new OperationFailedError(operation, this.providerName, {
        cause: new Error(message),
      });
    }

    return response.value;
  };

  private defaults() {
    return {
      agentPartnerId: this.opts.agentPartnerId,
      operatorId: this.opts.operatorId,
      posId: this.opts.posId ?? '01',
      userLanguage: this.opts.userLanguage ?? 'en-US',
      targetAudience: this.opts.targetAudience ?? 'AGENT_FACING',
    };
  }

  /**
   * `provider_metadata.{agentPartnerId,operatorId,posId,userLanguage,targetAudience}`
   * override the provider-level defaults of the same name - shared by
   * `createPayment` and `createCheckout` since both build the same
   * request shape.
   */
  private resolveTransferOverrides(pm: MoneyGramPaymentMetadata) {
    return {
      ...this.defaults(),
      ...(pm.agentPartnerId && { agentPartnerId: pm.agentPartnerId }),
      ...(pm.operatorId && { operatorId: pm.operatorId }),
      ...(pm.posId && { posId: pm.posId }),
      ...(pm.userLanguage && { userLanguage: pm.userLanguage }),
      ...(pm.targetAudience && {
        targetAudience: pm.targetAudience,
      }),
    };
  }

  private requireSenderAndReceiver(
    pm: MoneyGramPaymentMetadata | undefined,
    operation: string,
  ): asserts pm is MoneyGramPaymentMetadata {
    if (!pm?.sender) {
      throw new ConfigurationError(
        `provider_metadata.sender is required - MoneyGram has no customer-object API, full sender KYC data must be supplied on every ${operation} call`,
        { provider: this.providerName, missingKeys: ['sender'] },
      );
    }

    if (!pm.receiver) {
      throw new ConfigurationError(
        'provider_metadata.receiver is required',
        { provider: this.providerName, missingKeys: ['receiver'] },
      );
    }
  }

  /**
   * Runs MoneyGram's full Quote -> Update -> Commit flow - the shared
   * core of both `createPayment` and `createCheckout`. MoneyGram has no
   * hosted checkout page, so a "checkout" here is just a transfer whose
   * creation also surfaces a receipt link as `payment_url`.
   * @see https://developer.moneygram.com/moneygram-developer/docs/transfer-api
   */
  private runTransferFlow = async (input: {
    operation: string;
    amount: number;
    currencyCode: string;
    itemId: string;
    quantity?: number;
    metadata?: Record<string, unknown> | null;
    pm: MoneyGramPaymentMetadata;
    destinationCountryCode: string;
    agentPartnerId: string;
    operatorId: string;
    posId: string;
    userLanguage: string;
    targetAudience: string;
  }): Promise<{
    transactionId: string;
    amount: number;
    currency: string;
    additionalDetails?: Record<string, string>;
    receiptUrl: string | null;
  }> => {
    const {
      operation,
      amount,
      currencyCode,
      itemId,
      quantity,
      metadata,
      pm,
      destinationCountryCode,
      agentPartnerId,
      operatorId,
      posId,
      userLanguage,
      targetAudience,
    } = input;

    // Step 1: Quote - reserves a transactionId and locks in fees/fx for 30 minutes
    const quoteBody: MoneyGramQuoteRequest = {
      targetAudience,
      agentPartnerId,
      operatorId,
      destinationCountryCode,
      destinationCountrySubdivisionCode:
        pm.destinationCountrySubdivisionCode,
      posId,
      userLanguage,
      serviceOptionCode: pm.serviceOptionCode,
      sendAmount: { value: amount, currencyCode },
    };

    const quoteResponse = await this.request<MoneyGramQuoteResponse>(
      'post',
      '/transfer/v1/transactions/quote',
      quoteBody,
      operation,
    );

    const [transaction] = quoteResponse.transactions ?? [];

    if (!transaction) {
      throw new OperationFailedError(operation, this.providerName, {
        cause: new Error('MoneyGram quote returned no transactions'),
      });
    }

    // Step 2: Update - attaches sender/receiver/compliance data to the quoted transactionId
    const updateBody: MoneyGramUpdateTransactionRequest = {
      targetAudience,
      agentPartnerId,
      posId,
      operatorId,
      userLanguage,
      destinationCountryCode,
      destinationCountrySubdivisionCode:
        pm.destinationCountrySubdivisionCode,
      serviceOptionCode: transaction.serviceOptionCode,
      serviceOptionRoutingCode:
        pm.serviceOptionRoutingCode ??
        transaction.serviceOptionRoutingCode,
      sendAmount: { value: amount, currencyCode },
      receiveCurrencyCode: pm.receiveCurrencyCode ?? currencyCode,
      fundingSource: pm.fundingSource,
      targetAccountProfileId: pm.targetAccountProfileId,
      targetaccount: pm.targetAccount,
      sender: pm.sender,
      receiver: pm.receiver,
      transactionInformation: pm.transactionInformation,
      partnerTransactionId: pm.partnerTransactionId,
      additionalDetails: {
        ...stringifyMetadataValues(metadata ?? {}),
        [PAYKIT_METADATA_KEY]: JSON.stringify({
          item: itemId,
          qty: quantity ?? 1,
        }),
      },
    };

    const updateResponse =
      await this.request<MoneyGramUpdateTransactionResponse>(
        'put',
        `/transfer/v1/transactions/${transaction.transactionId}`,
        updateBody,
        operation,
      );

    if (updateResponse.readyForCommit === false) {
      throw new OperationFailedError(operation, this.providerName, {
        cause: new Error(
          `Transaction ${transaction.transactionId} is not ready for commit - MoneyGram rejected the sender/receiver data supplied`,
        ),
      });
    }

    // Step 3: Commit - actually moves the money
    const commitBody: MoneyGramCommitTransactionRequest = {
      fundingSource: pm.fundingSource,
    };

    const commitResponse =
      await this.request<MoneyGramCommitTransactionResponse>(
        'put',
        `/transfer/v1/transactions/${transaction.transactionId}/commit`,
        commitBody,
        operation,
      );

    return {
      transactionId: transaction.transactionId,
      amount: updateResponse.sendAmount.amount?.value ?? amount,
      currency:
        updateResponse.sendAmount.amount?.currencyCode ??
        currencyCode,
      additionalDetails: updateResponse.additionalDetails,
      receiptUrl:
        commitResponse.commitReceipt?.consumerHyperLink ?? null,
    };
  };

  /**
   * GET /status/v1/transactions/{id} - shared by `retrievePayment` and
   * `retrieveCheckout`, since MoneyGram has one transaction resource, not
   * separate payment/checkout resources.
   */
  private fetchTransactionStatus = async (
    id: string,
  ): Promise<MoneyGramTransactionStatusResponse | null> => {
    const response =
      await this._client.get<MoneyGramTransactionStatusResponse>(
        `/status/v1/transactions/${id}`,
        { headers: await this.tokenManager.getAuthHeaders() },
      );

    if (!response.ok) {
      if ((response.error as Error)?.message === 'not_found')
        return null;

      throw new OperationFailedError(
        'retrieveTransaction',
        this.providerName,
        {
          cause: new Error(
            `Failed to retrieve transaction: ${JSON.stringify(response.error)}`,
          ),
        },
      );
    }

    return response.value;
  };

  private snapshotFromStatus(
    data: MoneyGramTransactionStatusResponse,
  ): MoneyGramPaymentSnapshot {
    return {
      transactionId: data.transactionId,
      transactionStatus: data.transactionStatus,
      amount: data.sendAmount.amount?.value ?? 0,
      currency: data.sendAmount.amount?.currencyCode ?? '',
      customer: data.sender?.profileId
        ? { id: data.sender.profileId }
        : null,
      additionalDetails: {
        ...data.sender?.additionalDetails,
        ...data.additionalDetails,
      },
      requiresAction: data.transactionStatus === 'UNFUNDED',
    };
  }

  /**
   * `provider_metadata.receiverFirstName` + `receiverLastName` amends a
   * committed transaction's receiver name via the Amend API (e.g. to
   * match their ID for payout) - shared by `updatePayment` and
   * `updateCheckout`. Without them, this is a no-op; the caller then
   * just re-fetches the current transaction.
   * @see https://developer.moneygram.com/moneygram-developer/docs/amend-api-overview
   */
  private async amendReceiverNameIfRequested(
    id: string,
    pm: MoneyGramPaymentMetadata | undefined,
    operation: string,
  ): Promise<void> {
    if (!pm?.receiverFirstName || !pm?.receiverLastName) return;

    const body: MoneyGramAmendReceiverNameRequest = {
      name: {
        firstName: pm.receiverFirstName,
        lastName: pm.receiverLastName,
        middleName: pm.receiverMiddleName,
        secondLastName: pm.receiverSecondLastName,
      },
    };

    await this.request(
      'patch',
      `/amend/v1/transactions/${id}/receiver/name`,
      body,
      operation,
    );
  }

  /**
   * MoneyGram has no hosted checkout page - this runs the exact same
   * Quote -> Update -> Commit flow as `createPayment` (via
   * `runTransferFlow`). Since `Checkout` has no top-level `amount`/
   * `currency`, both are required in `provider_metadata` instead.
   * @see https://developer.moneygram.com/moneygram-developer/docs/transfer-api
   */
  createCheckout = async (
    params: CreateCheckoutSchema<MoneyGramMetadata['checkout']>,
  ): Promise<Checkout> => {
    const { error, data } = createCheckoutSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createCheckout',
      );
    }

    const pm = data.provider_metadata as unknown as
      | MoneyGramCheckoutMetadata
      | undefined;

    const { amount, currency, destinationCountryCode } =
      validateRequiredKeys(
        ['amount', 'currency', 'destinationCountryCode'],
        (data.provider_metadata as Record<string, string>) ?? {},
        'The following fields must be present in the provider_metadata of createCheckout: {keys}',
      );

    this.requireSenderAndReceiver(pm, 'createCheckout');

    const result = await this.runTransferFlow({
      operation: 'createCheckout',
      amount: Number(amount),
      currencyCode: currency.toUpperCase(),
      itemId: data.item_id,
      quantity: data.quantity,
      metadata: data.metadata,
      pm,
      destinationCountryCode,
      ...this.resolveTransferOverrides(pm),
    });

    return Checkout$inboundSchema({
      transactionId: result.transactionId,
      transactionStatus: undefined,
      amount: result.amount,
      currency: result.currency,
      customer: data.customer,
      additionalDetails: result.additionalDetails,
      receiptUrl: result.receiptUrl,
    });
  };

  retrieveCheckout = async (id: string): Promise<Checkout | null> => {
    const data = await this.fetchTransactionStatus(id);

    if (!data) return null;

    return Checkout$inboundSchema({
      ...this.snapshotFromStatus(data),
      // Receipt hyperlinks are only returned once, at commit time, and
      // expire after 5 minutes - nothing to recover here later.
      receiptUrl: null,
    });
  };

  /**
   * @see updatePayment - identical behavior, mapped onto Checkout.
   */
  updateCheckout = async (
    id: string,
    params: UpdateCheckoutSchema<MoneyGramMetadata['checkout']>,
  ): Promise<Checkout> => {
    await this.amendReceiverNameIfRequested(
      id,
      params.provider_metadata,
      'updateCheckout',
    );

    const checkout = await this.retrieveCheckout(id);

    if (!checkout) {
      throw new OperationFailedError(
        'updateCheckout',
        this.providerName,
        { cause: new Error('Failed to retrieve checkout') },
      );
    }

    return checkout;
  };

  deleteCheckout = async (id: string): Promise<null> => {
    throw new ProviderNotSupportedError(
      'deleteCheckout',
      this.providerName,
      {
        reason:
          'MoneyGram transfers commit immediately and cannot be deleted',
        alternative: 'Use createRefund() instead',
      },
    );
  };

  createCustomer = async (
    params: CreateCustomerParams,
  ): Promise<Customer> => {
    throw new ProviderNotSupportedError(
      'createCustomer',
      this.providerName,
      {
        reason:
          "MoneyGram doesn't expose a customer-object API - sender/receiver KYC data is supplied per-transaction",
        alternative:
          'Pass full sender/receiver details via provider_metadata on createPayment or createCheckout',
      },
    );
  };

  updateCustomer = async (
    id: string,
    params: UpdateCustomerParams,
  ): Promise<Customer> => {
    throw new ProviderNotSupportedError(
      'updateCustomer',
      this.providerName,
    );
  };

  deleteCustomer = async (id: string): Promise<null> => {
    throw new ProviderNotSupportedError(
      'deleteCustomer',
      this.providerName,
    );
  };

  retrieveCustomer = async (id: string): Promise<Customer | null> => {
    throw new ProviderNotSupportedError(
      'retrieveCustomer',
      this.providerName,
    );
  };

  createSubscription = async (
    params: CreateSubscriptionSchema<
      MoneyGramMetadata['subscription']
    >,
  ): Promise<Subscription> => {
    throw new ProviderNotSupportedError(
      'createSubscription',
      this.providerName,
      {
        reason:
          'MoneyGram money transfers are one-time, not recurring',
        alternative: 'Call createPayment() for each transfer',
      },
    );
  };

  updateSubscription = async (
    id: string,
    params: UpdateSubscriptionSchema<
      MoneyGramMetadata['subscription']
    >,
  ): Promise<Subscription> => {
    throw new ProviderNotSupportedError(
      'updateSubscription',
      this.providerName,
    );
  };

  cancelSubscription = async (id: string): Promise<Subscription> => {
    throw new ProviderNotSupportedError(
      'cancelSubscription',
      this.providerName,
    );
  };

  deleteSubscription = async (id: string): Promise<null> => {
    throw new ProviderNotSupportedError(
      'deleteSubscription',
      this.providerName,
    );
  };

  retrieveSubscription = async (
    id: string,
  ): Promise<Subscription | null> => {
    throw new ProviderNotSupportedError(
      'retrieveSubscription',
      this.providerName,
    );
  };

  /**
   * Runs MoneyGram's full Quote -> Update -> Commit flow (via
   * `runTransferFlow`, shared with `createCheckout`) as a single atomic
   * `createPayment` call.
   * @see https://developer.moneygram.com/moneygram-developer/docs/transfer-api
   */
  createPayment = async (
    params: CreatePaymentSchema<MoneyGramMetadata['payment']>,
  ): Promise<Payment> => {
    const { error, data } = createPaymentSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createPayment',
      );
    }

    if (data.capture_method !== 'automatic') {
      throw new ProviderNotSupportedError(
        'createPayment',
        this.providerName,
        {
          reason:
            'MoneyGram transfers commit immediately - there is no manual capture step',
          alternative: 'Use capture_method: "automatic"',
        },
      );
    }

    if (
      !isEmailCustomer(data.customer) &&
      !isIdCustomer(data.customer)
    ) {
      throw new InvalidTypeError(
        'customer',
        'object with email or id',
        typeof data.customer,
        {
          provider: this.providerName,
          method: 'createPayment',
        },
      );
    }

    if (!data.item_id) {
      throw new ConfigurationError(
        'item_id is required for createPayment',
        { provider: this.providerName, missingKeys: ['item_id'] },
      );
    }

    const pm = data.provider_metadata as unknown as
      | MoneyGramPaymentMetadata
      | undefined;

    const { destinationCountryCode } = validateRequiredKeys(
      ['destinationCountryCode'],
      (data.provider_metadata as Record<string, string>) ?? {},
      'The following fields must be present in the provider_metadata of createPayment: {keys}',
    );

    this.requireSenderAndReceiver(pm, 'createPayment');

    const result = await this.runTransferFlow({
      operation: 'createPayment',
      amount: Number(data.amount),
      currencyCode: data.currency.toUpperCase(),
      itemId: data.item_id,
      metadata: data.metadata,
      pm,
      destinationCountryCode,
      ...this.resolveTransferOverrides(pm),
    });

    return Payment$inboundSchema({
      transactionId: result.transactionId,
      // Commit's response doesn't echo transactionStatus back - a
      // successful commit always implies "SENT" (see mapper.ts).
      transactionStatus: undefined,
      amount: result.amount,
      currency: result.currency,
      customer: data.customer,
      additionalDetails: result.additionalDetails,
    });
  };

  retrievePayment = async (id: string): Promise<Payment | null> => {
    const data = await this.fetchTransactionStatus(id);

    if (!data) return null;

    return Payment$inboundSchema(this.snapshotFromStatus(data));
  };

  deletePayment = async (id: string): Promise<null> => {
    throw new ProviderNotSupportedError(
      'deletePayment',
      this.providerName,
      {
        reason:
          'MoneyGram transfers commit immediately and cannot be deleted',
        alternative: 'Use createRefund() instead',
      },
    );
  };

  capturePayment = async (
    id: string,
    params: CapturePaymentSchema,
  ): Promise<Payment> => {
    throw new ProviderNotSupportedError(
      'capturePayment',
      this.providerName,
      {
        reason:
          'MoneyGram transfers commit immediately - there is no manual capture step',
      },
    );
  };

  cancelPayment = async (id: string): Promise<Payment> => {
    throw new ProviderNotSupportedError(
      'cancelPayment',
      this.providerName,
      {
        reason:
          'MoneyGram does not support voiding a committed transfer',
        alternative: 'Use createRefund() instead',
      },
    );
  };

  /**
   * MoneyGram has no general "update transaction" endpoint post-commit -
   * the only supported post-commit edit is amending the receiver's name
   * (e.g. to match their ID for payout), via the Amend API. Supply
   * `provider_metadata.receiverFirstName` + `receiverLastName` to trigger
   * it; otherwise this just re-fetches the current transaction.
   * @see https://developer.moneygram.com/moneygram-developer/docs/amend-api-overview
   */
  updatePayment = async (
    id: string,
    params: UpdatePaymentSchema<MoneyGramMetadata['payment']>,
  ): Promise<Payment> => {
    await this.amendReceiverNameIfRequested(
      id,
      params.provider_metadata,
      'updatePayment',
    );

    const payment = await this.retrievePayment(id);

    if (!payment) {
      throw new OperationFailedError(
        'updatePayment',
        this.providerName,
        {
          cause: new Error('Failed to retrieve payment'),
        },
      );
    }

    return payment;
  };

  /**
   * MoneyGram's refund flow is 2 steps: retrieve the transaction (which
   * returns a `refundId`) then commit the refund using that id.
   * @see https://developer.moneygram.com/moneygram-developer/docs/refund-api-overview
   */
  createRefund = async (
    params: CreateRefundSchema<MoneyGramMetadata['refund']>,
  ): Promise<Refund> => {
    const { error, data } = createRefundSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createRefund',
      );
    }

    const { refundReasonCode } = validateRequiredKeys(
      ['refundReasonCode'],
      (data.provider_metadata as Record<string, string>) ?? {},
      'The following fields must be present in the provider_metadata of createRefund: {keys}',
    );

    const { agentPartnerId, userLanguage, targetAudience } =
      this.defaults();
    const refundFee = (
      data.provider_metadata as MoneyGramRefundMetadata | undefined
    )?.refundFee;

    const query = new URLSearchParams({
      agentPartnerId,
      operatorId: this.opts.operatorId,
      refundReasonCode,
      userLanguage,
      ...(refundFee !== undefined && {
        refundFee: String(refundFee),
      }),
    });

    const retrieveResponse =
      await this.request<MoneyGramRefundRetrieveResponse>(
        'get',
        `/refund/v2/transactions/${data.payment_id}?${query.toString()}`,
        undefined,
        'createRefund',
      );

    if (!retrieveResponse.availableForRefund) {
      throw new OperationFailedError(
        'createRefund',
        this.providerName,
        {
          cause: new Error(
            `Transaction ${data.payment_id} is not available for refund (status: ${retrieveResponse.transactionStatus})`,
          ),
        },
      );
    }

    const commitBody: MoneyGramRefundCommitRequest = {
      targetAudience,
      agentPartnerId,
      userLanguage,
      refundId: retrieveResponse.refundId,
    };

    await this.request<MoneyGramRefundCommitResponse>(
      'put',
      `/refund/v2/transactions/${data.payment_id}/commit`,
      commitBody,
      'createRefund',
    );

    return Refund$inboundSchema({
      refundId: retrieveResponse.refundId,
      amount: data.amount,
      currency:
        retrieveResponse.refundAmount?.amount?.currencyCode ??
        retrieveResponse.sendAmount?.amount?.currencyCode ??
        '',
      reason: data.reason,
      metadata: data.metadata
        ? stringifyMetadataValues(data.metadata)
        : {},
    });
  };

  /**
   * Verifies the `Signature` header (RSA-SHA256 over
   * `{timestamp}.{destinationHost}.{body}`), then re-fetches the full
   * transaction from the Status API rather than trusting the webhook body
   * - MoneyGram's TRANSACTION_STATUS_EVENT payload only carries status
   * fields, not amounts/sender/receiver data.
   *
   * `webhookSecret` is unused - MoneyGram doesn't have a shared-secret (or
   * per-partner key) concept for webhooks. It publishes exactly one fixed
   * public key per environment (sandbox/production) and signs every
   * notification with the matching private key, so verification always
   * uses `getWebhookPublicKey()` (resolved from `isSandbox`), the same way
   * GoPay's webhookSecret goes unused because it has no secret at all.
   * Pass `null` at `.setup({ webhookSecret: null })`.
   * @see https://developer.moneygram.com/moneygram-developer/docs/transaction-event
   * @see https://developer.moneygram.com/moneygram-developer/docs/security
   */
  handleWebhook = async (
    payload: WebhookHandlerConfig,
    webhookSecret: string | null,
  ): Promise<Array<WebhookEventPayload<MoneyGramRawEvents>>> => {
    const { body, headersAsObject, fullUrl } = payload;

    const signatureHeader =
      headersAsObject['signature'] ?? headersAsObject['Signature'];

    if (!signatureHeader) {
      throw new WebhookError('Missing Signature header', {
        provider: this.providerName,
      });
    }

    const match = /t=([^,]+),\s*s=(.+)/.exec(signatureHeader);

    if (!match) {
      throw new WebhookError('Malformed Signature header', {
        provider: this.providerName,
      });
    }

    const [, timestampStr, signatureBase64] = match;
    const timestamp = Number(timestampStr);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (
      !Number.isFinite(timestamp) ||
      Math.abs(nowSeconds - timestamp) > 65 * 60
    ) {
      throw new WebhookError(
        'Signature timestamp is outside the 65 minute freshness window',
        { provider: this.providerName },
      );
    }

    const host = new URL(fullUrl).host;
    const signedPayload = `${timestampStr}.${host}.${body}`;

    const publicKeyDer = this.getWebhookPublicKey();

    const isValid = crypto
      .createVerify('RSA-SHA256')
      .update(signedPayload)
      .verify(
        toPemPublicKey(publicKeyDer),
        Buffer.from(signatureBase64, 'base64'),
      );

    if (!isValid) {
      throw new WebhookError('Invalid webhook signature', {
        provider: this.providerName,
      });
    }

    const event: MoneyGramTransactionStatusEvent = JSON.parse(body);

    if (event.subscriptionType !== 'TRANSACTION_STATUS_EVENT') {
      return [
        {
          id: event.eventId,
          type: `moneygram.${event.subscriptionType}` as `moneygram.${string}`,
          created: new Date(event.eventDate).getTime(),
          data: event as never,
          is_raw: true,
        },
      ];
    }

    const { eventPayload } = event;

    if (!eventPayload.transactionId) {
      throw new WebhookError(
        'Transaction event is missing transactionId',
        { provider: this.providerName },
      );
    }

    const payment = await this.retrievePayment(
      eventPayload.transactionId,
    );

    if (!payment) {
      throw new WebhookError(
        'Transaction not found for webhook event',
        { provider: this.providerName },
      );
    }

    const status = eventPayload.transactionStatus;

    if (status === 'REFUNDED') {
      const refund = Refund$inboundSchema({
        refundId: crypto.randomBytes(8).toString('hex').slice(0, 15),
        amount: payment.amount,
        currency: payment.currency,
        reason: 'refunded',
        metadata: payment.metadata ?? {},
      });

      return [
        paykitEvent$InboundSchema<Refund>({
          type: 'refund.created',
          created: new Date(event.eventDate).getTime(),
          id: event.eventId,
          data: refund,
        }),
      ];
    }

    const eventTypeMap: Record<
      Exclude<typeof status, 'REFUNDED'>,
      | 'payment.created'
      | 'payment.updated'
      | 'payment.succeeded'
      | 'payment.failed'
    > = {
      UNFUNDED: 'payment.created',
      SENT: 'payment.succeeded',
      AVAILABLE: 'payment.updated',
      IN_TRANSIT: 'payment.updated',
      RECEIVED: 'payment.updated',
      DELIVERED: 'payment.updated',
      PROCESSING: 'payment.updated',
      REJECTED: 'payment.failed',
      CLOSED: 'payment.updated',
    };

    const type = eventTypeMap[status];

    return [
      paykitEvent$InboundSchema<Payment>({
        type,
        created: new Date(event.eventDate).getTime(),
        id: event.eventId,
        data: payment,
      }),
    ];
  };
}
