import {
  AbstractPayKitProvider,
  Checkout,
  CreateCheckoutSchema,
  CreateCustomerParams,
  Customer,
  HTTPClient,
  PayKitProvider,
  PaykitProviderOptions,
  ProviderNotSupportedError,
  schema,
  UpdateCheckoutSchema,
  UpdateCustomerParams,
  CreateSubscriptionSchema,
  Subscription,
  UpdateSubscriptionSchema,
  CreatePaymentSchema,
  Payment,
  UpdatePaymentSchema,
  CapturePaymentSchema,
  CreateRefundSchema,
  Refund,
  WebhookEventPayload,
  WebhookError,
  parseJSON,
  OAuth2TokenManager,
  PAYKIT_METADATA_KEY,
  createCheckoutSchema,
  createRefundSchema,
  ValidationError,
  validateRequiredKeys,
  OperationFailedError,
  InvalidTypeError,
  isEmailCustomer,
  ProviderMetadataRegistry,
  WebhookHandlerConfig,
  Schema,
} from '@paykit-sdk/core';
import { sha512 } from 'js-sha512';
import {
  monnifyToPaykitEventMap,
  Checkout$inboundSchema,
  Payment$inboundSchema,
  Refund$inboundSchema,
} from './utils/mapper';

interface MonnifyMetadata extends ProviderMetadataRegistry {}

interface MonnifyRawEvents extends Record<string, any> {}

export interface MonnifyOptions extends PaykitProviderOptions {
  /**
   * The API key for the Monnify API
   */
  apiKey: string;

  /**
   * The secret key for the Monnify API
   */
  secretKey: string;

  /**
   * Whether to use the sandbox environment
   */
  isSandbox: boolean;
}

const monnifyOptionsSchema = schema<MonnifyOptions>()(
  Schema.object({
    apiKey: Schema.string(),
    secretKey: Schema.string(),
    isSandbox: Schema.boolean(),
  }),
);

const providerName = 'monnify';

export class MonnifyProvider
  extends AbstractPayKitProvider
  implements PayKitProvider<MonnifyMetadata, null, MonnifyRawEvents>
{
  readonly providerName = providerName;

  private _client: HTTPClient;
  private baseUrl: string;

  private tokenManager: OAuth2TokenManager;

  get _native() {
    return null;
  }

  constructor(private readonly opts: MonnifyOptions) {
    super(monnifyOptionsSchema, opts, providerName);

    const debug = opts.debug ?? true;

    this.baseUrl = opts.isSandbox
      ? 'https://sandbox.monnify.com/api'
      : 'https://api.monnify.com/api';

    this._client = new HTTPClient({
      baseUrl: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      retryOptions: { max: 3, baseDelay: 1000, debug },
    });

    this.tokenManager = new OAuth2TokenManager({
      client: this._client,
      provider: this.providerName,
      tokenEndpoint: '/v1/auth/login',
      credentials: {
        username: opts.apiKey,
        password: opts.secretKey,
      },
      responseAdapter: ({ responseBody }) => ({
        accessToken: responseBody?.accessToken ?? '',
        expiresIn: responseBody?.expiresIn ?? 0,
      }),
      expiryBuffer: 5 * 60, // 5 minutes
    });
  }

  /**
   * Validates schema and throws ValidationError if invalid
   */
  private validateSchema<T>(
    schema: Schema.ZodSchema<T>,
    params: unknown,
    method: string,
  ): T {
    const { error, data } = schema.safeParse(params);
    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        method,
      );
    }
    return data;
  }

  /**
   * Ensures API response is successful and has responseBody
   */
  private ensureResponse<T = Record<string, any>>(
    response: {
      ok: boolean;
      value?: { responseBody?: T };
      error?: unknown;
    },
    method: string,
    errorMessage?: string,
  ): T {
    if (!response.ok || !response.value?.responseBody) {
      throw new OperationFailedError(method, this.providerName, {
        cause: new Error(
          errorMessage ||
            JSON.stringify(response.error ?? response.value),
        ),
      });
    }
    return response.value.responseBody;
  }

  /**
   * Queries transaction by transactionReference or paymentReference (with fallback)
   */
  private async queryTransaction(
    id: string,
    errorMessage = 'Transaction not found',
  ): Promise<Record<string, any>> {
    const response = await this._client.get<Record<string, any>>(
      `/v2/merchant/transactions/query?transactionReference=${id}`,
      { headers: await this.tokenManager.getAuthHeaders() },
    );

    if (response.ok && response.value?.responseBody) {
      return response.value.responseBody;
    }

    // Fallback to paymentReference
    const altResponse = await this._client.get<Record<string, any>>(
      `/v2/merchant/transactions/query?paymentReference=${id}`,
      { headers: await this.tokenManager.getAuthHeaders() },
    );

    if (!altResponse.ok || !altResponse.value?.responseBody) {
      throw new OperationFailedError(
        'queryTransaction',
        this.providerName,
        {
          cause: new Error(errorMessage),
        },
      );
    }

    return altResponse.value.responseBody;
  }

  createCheckout = async (
    params: CreateCheckoutSchema,
  ): Promise<Checkout> => {
    const data = this.validateSchema(
      createCheckoutSchema,
      params,
      'createCheckout',
    );

    if (!isEmailCustomer(data.customer)) {
      throw new InvalidTypeError(
        'customer',
        'object (customer) with email',
        'string (customer ID)',
        {
          provider: this.providerName,
          method: 'createCheckout',
        },
      );
    }

    const { amount, currency } = validateRequiredKeys(
      ['amount', 'currency'],
      (data.provider_metadata ?? { currency: 'NGN' }) as Record<
        string,
        string
      >,
      'The following fields must be present in the provider_metadata of createCheckout: {keys}',
    );

    const paymentReference = crypto.randomUUID();

    const body: Record<string, unknown> = {
      amount,
      paymentReference,
      paymentDescription: `Checkout for ${data.item_id} x ${data.quantity} item${data.quantity > 1 ? 's' : ''}`,
      currencyCode: currency,
      redirectUrl: data.success_url,
      paymentMethods: ['CARD', 'ACCOUNT_TRANSFER'],
      metadata: {
        ...params.metadata,
        [PAYKIT_METADATA_KEY]: JSON.stringify({
          item: data.item_id,
          qty: data.quantity,
        }),
      },
      customerEmail: data.customer.email,
    };

    const response = await this._client.post<Record<string, any>>(
      '/v1/merchant/transactions/init-transaction',
      {
        body: JSON.stringify(body),
        headers: await this.tokenManager.getAuthHeaders(),
      },
    );

    const responseBody = this.ensureResponse(
      response,
      'createCheckout',
    );

    const transactionReference = responseBody.transactionReference;
    const checkoutUrl = responseBody.checkoutUrl;

    // Query the transaction to get full details
    const checkoutResponse = await this._client.get<
      Record<string, any>
    >(
      `/v2/merchant/transactions/query?paymentReference=${paymentReference}`,
      { headers: await this.tokenManager.getAuthHeaders() },
    );

    const checkoutData = this.ensureResponse(
      checkoutResponse,
      'createCheckout',
      'Failed to retrieve checkout details',
    );

    return Checkout$inboundSchema({
      ...checkoutData,
      checkoutUrl,
      transactionReference,
    });
  };

  retrieveCheckout = async (id: string): Promise<Checkout> => {
    const transactionData = await this.queryTransaction(
      id,
      'Checkout not found',
    );
    return Checkout$inboundSchema(transactionData);
  };

  updateCheckout = async (
    id: string,
    params: UpdateCheckoutSchema,
  ): Promise<Checkout> => {
    throw new ProviderNotSupportedError(
      'updateCheckout',
      'Moniepoint',
      {
        reason: 'Moniepoint does not support updating checkouts',
        alternative: 'Use the updatePayment method instead',
      },
    );
  };

  deleteCheckout = async (id: string): Promise<null> => {
    throw new ProviderNotSupportedError(
      'deleteCheckout',
      'Moniepoint',
      {
        reason: 'Moniepoint does not support deleting checkouts',
        alternative: 'Use the deletePayment method instead',
      },
    );
  };

  createCustomer = async (
    params: CreateCustomerParams,
  ): Promise<Customer> => {
    throw new ProviderNotSupportedError(
      'createCustomer',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support creating customers",
      },
    );
  };

  retrieveCustomer = async (id: string): Promise<Customer | null> => {
    throw new ProviderNotSupportedError(
      'retrieveCustomer',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support retrieving customers",
        alternative: 'Use the retrieveCustomer method instead',
      },
    );
  };

  updateCustomer = async (
    id: string,
    params: UpdateCustomerParams,
  ): Promise<Customer> => {
    throw new ProviderNotSupportedError(
      'updateCustomer',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support updating customers",
        alternative: 'Use the updateCustomer method instead',
      },
    );
  };

  deleteCustomer = async (id: string): Promise<null> => {
    throw new ProviderNotSupportedError(
      'deleteCustomer',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support deleting customers",
        alternative: 'Use the deleteCustomer method instead',
      },
    );
  };

  createSubscription = async (
    params: CreateSubscriptionSchema,
  ): Promise<Subscription> => {
    throw new ProviderNotSupportedError(
      'createSubscription',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support creating subscriptions",
        alternative: 'Use the createSubscription method instead',
      },
    );
  };

  updateSubscription = async (
    id: string,
    params: UpdateSubscriptionSchema,
  ): Promise<Subscription> => {
    throw new ProviderNotSupportedError(
      'updateSubscription',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support updating subscriptions",
        alternative: 'Use the updateSubscription method instead',
      },
    );
  };

  cancelSubscription = async (id: string): Promise<Subscription> => {
    throw new ProviderNotSupportedError(
      'cancelSubscription',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support canceling subscriptions",
        alternative: 'Use the cancelSubscription method instead',
      },
    );
  };

  deleteSubscription = async (id: string): Promise<null> => {
    throw new ProviderNotSupportedError(
      'deleteSubscription',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support deleting subscriptions",
        alternative: 'Use the deleteSubscription method instead',
      },
    );
  };

  retrieveSubscription = async (
    id: string,
  ): Promise<Subscription | null> => {
    throw new ProviderNotSupportedError(
      'retrieveSubscription',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support retrieving subscriptions",
        alternative: 'Use the retrieveSubscription method instead',
      },
    );
  };

  createPayment = async (
    params: CreatePaymentSchema,
  ): Promise<Payment> => {
    throw new ProviderNotSupportedError(
      'createPayment',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support creating payments",
        alternative: 'Use the createPayment method instead',
      },
    );
  };

  retrievePayment = async (id: string): Promise<Payment | null> => {
    try {
      const transactionData = await this.queryTransaction(id);
      return Payment$inboundSchema(transactionData);
    } catch {
      return null;
    }
  };

  updatePayment = async (
    id: string,
    params: UpdatePaymentSchema,
  ): Promise<Payment> => {
    throw new ProviderNotSupportedError(
      'updatePayment',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support updating payments",
        alternative: 'Use the updatePayment method instead',
      },
    );
  };

  deletePayment = async (id: string): Promise<null> => {
    throw new ProviderNotSupportedError(
      'deletePayment',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support deleting payments",
        alternative: 'Use the deletePayment method instead',
      },
    );
  };

  capturePayment = async (
    id: string,
    params: CapturePaymentSchema,
  ): Promise<Payment> => {
    throw new ProviderNotSupportedError(
      'capturePayment',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support capturing payments",
        alternative: 'Use the capturePayment method instead',
      },
    );
  };

  cancelPayment = async (id: string): Promise<Payment> => {
    throw new ProviderNotSupportedError(
      'cancelPayment',
      'Moniepoint',
      {
        reason: "Moniepoint doesn't support canceling payments",
        alternative: 'Use the cancelPayment method instead',
      },
    );
  };

  createRefund = async (
    params: CreateRefundSchema,
  ): Promise<Refund> => {
    const data = this.validateSchema(
      createRefundSchema,
      params,
      'createRefund',
    );

    // First, retrieve the payment to get transactionReference
    const payment = await this.retrievePayment(data.payment_id);

    if (!payment) {
      throw new OperationFailedError(
        'createRefund',
        this.providerName,
        {
          cause: new Error('Payment not found'),
        },
      );
    }

    const body: Record<string, unknown> = {
      transactionReference: data.payment_id,
      refundAmount: data.amount,
      refundReason: data.reason ?? 'Customer request',
      ...(data.provider_metadata || {}),
    };

    const response = await this._client.post<Record<string, any>>(
      '/v1/merchant/transactions/refund',
      {
        body: JSON.stringify(body),
        headers: await this.tokenManager.getAuthHeaders(),
      },
    );

    const responseBody = this.ensureResponse(
      response,
      'createRefund',
    );

    return Refund$inboundSchema({
      ...responseBody,
      metadata: data.metadata ?? null,
    });
  };

  handleWebhook = async (
    payload: WebhookHandlerConfig,
    webhookSecret: string | null,
  ): Promise<Array<WebhookEventPayload<MonnifyRawEvents>>> => {
    if (!webhookSecret) {
      throw new WebhookError(
        'webhookSecret is required for Monnify webhook verification',
        { provider: this.providerName },
      );
    }

    const { body, headersAsObject } = payload;

    const receivedHash = headersAsObject['monnify-signature'];

    if (!receivedHash) {
      throw new WebhookError('Missing Monnify signature', {
        provider: this.providerName,
      });
    }

    const computedHash = sha512.hmac(
      webhookSecret,
      JSON.stringify(body),
    );

    if (computedHash !== receivedHash)
      throw new WebhookError('Invalid Monnify signature', {
        provider: this.providerName,
      });

    const parsedBody = parseJSON(
      body,
      Schema.object({
        eventType: Schema.string(),
        eventData: Schema.record(Schema.any()),
      }).strict(),
    );

    if (!parsedBody) {
      throw new WebhookError(
        'Invalid webhook payload: not valid JSON',
        {
          provider: this.providerName,
        },
      );
    }

    const { eventType, eventData } = parsedBody;

    const eventMapper = monnifyToPaykitEventMap[eventType];

    if (!eventMapper) {
      throw new WebhookError('Unknown Monnify event type', {
        provider: this.providerName,
      });
    }

    if (typeof eventMapper === 'function') {
      const event = eventMapper(eventData);

      return [
        {
          type: event,
          created: new Date().getTime(),
          id: `paykit:webhook:${Math.random().toString(36).substring(2, 15)}`,
          data: eventData as any, // todo: add mapper for event data
        },
      ];
    } else {
      const event = eventMapper as string;

      return [
        {
          type: event,
          created: new Date().getTime(),
          id: `paykit:webhook:${Math.random().toString(36).substring(2, 15)}`,
          data: eventData as any, // todo: add mapper for event data
        },
      ];
    }
  };
}
