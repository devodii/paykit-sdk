import {
  createCheckoutSchema,
  createCustomerSchema,
  Customer,
  HTTPClient,
  PayKitProvider,
  retrieveCheckoutSchema,
  retrieveCustomerSchema,
  retrieveSubscriptionSchema,
  Subscription,
  UpdateCustomerParams,
  UpdateSubscriptionSchema,
  updateCustomerSchema,
  updateSubscriptionSchema,
  WebhookEventPayload,
  WebhookHandlerConfig,
  CreatePaymentSchema,
  CreateRefundSchema,
  CreateSubscriptionSchema,
  Payment,
  Refund,
  UpdateCheckoutSchema,
  UpdatePaymentSchema,
  ValidationError,
  AbstractPayKitProvider,
  schema,
  NotImplementedError,
  PaykitProviderOptions,
  ProviderNotSupportedError,
  CapturePaymentSchema,
  CreateCheckoutSchema,
  CreateCustomerParams,
  Checkout,
  ProviderMetadataRegistry,
} from '@paykit-sdk/core';
import { z } from 'zod';

interface WithoutProviderMetadata extends ProviderMetadataRegistry {}

type WithoutProviderRawEvents = {
  [K in string as `provider.${K}`]: any;
};

/**
 * @description Adjust these keys to match your provider's specific needs (e.g., Merchant ID, Secret Key).
 */
export interface WithoutProviderSDKOptions
  extends PaykitProviderOptions {
  /**
   * The API key for the provider
   */
  apiKey: string;
}

const withoutProviderSDKOptionsSchema =
  schema<WithoutProviderSDKOptions>()(
    z.object({
      apiKey: z.string().min(1, 'API Key is required'),
      isSandbox: z.boolean(),
    }),
  );

const providerName = 'without-sdk';

/**
 * BLUEPRINT: Integration via REST API
 * @description Use this when you are communicating directly with a provider's HTTP endpoints.
 */
export class WithoutProviderSDK
  extends AbstractPayKitProvider
  implements
    PayKitProvider<
      WithoutProviderMetadata,
      any,
      WithoutProviderRawEvents
    >
{
  private _client: HTTPClient;
  readonly providerName = providerName;

  constructor(protected readonly opts: WithoutProviderSDKOptions) {
    super(withoutProviderSDKOptionsSchema, opts, providerName);

    this._client = new HTTPClient({
      baseUrl: opts.isSandbox
        ? 'https://api.sandbox.your-provider.com'
        : 'https://api.your-provider.com',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      retryOptions: {
        max: 3,
        baseDelay: 1000,
        debug: opts.debug ?? true,
      },
    });
  }

  get _native() {
    return this._client;
  }

  private _ni(m: string): Promise<never> {
    return Promise.reject(
      new NotImplementedError(m, this.providerName, {
        futureSupport: true,
      }),
    );
  }
  private _ns(m: string, r: string): Promise<never> {
    return Promise.reject(
      new ProviderNotSupportedError(m, this.providerName, {
        reason: r,
      }),
    );
  }

  /**
   * @example
   * const { error, data } = createCheckoutSchema.safeParse(params);
   * if (error) throw ValidationError.fromZodError(error, this.providerName, 'createCheckout');
   *
   * const res = await this._client.post('/checkouts', { body: JSON.stringify(data) });
   * if (!res.ok) throw new Error('Failed to create checkout');
   * return res.value as Checkout;
   */
  createCheckout = async (
    params: CreateCheckoutSchema<WithoutProviderMetadata['checkout']>,
  ): Promise<Checkout> => {
    const { error, data } = createCheckoutSchema.safeParse(params);
    if (error)
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createCheckout',
      );

    const res = await this._client.post<Record<string, unknown>>(
      '/checkouts',
      {
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) throw new Error('Failed to create checkout');
    return res.value as unknown as Checkout;
  };

  retrieveCheckout = async (id: string): Promise<Checkout> => {
    const { error } = retrieveCheckoutSchema.safeParse({ id });
    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'retrieveCheckout',
      );
    }

    const res = await this._client.get<Record<string, unknown>>(
      `/checkouts/${id}`,
    );
    if (!res.ok) throw new Error('Failed to retrieve checkout');
    return res.value as unknown as Checkout;
  };

  updateCheckout = async (
    id: string,
    params: UpdateCheckoutSchema<WithoutProviderMetadata['checkout']>,
  ): Promise<Checkout> =>
    this._ns(
      'updateCheckout',
      'This provider does not support updating checkouts once created.',
    );

  deleteCheckout = (id: string): Promise<null> =>
    this._ni('deleteCheckout');

  createCustomer = async (
    params: CreateCustomerParams<WithoutProviderMetadata['customer']>,
  ): Promise<Customer> => {
    const { error, data } = createCustomerSchema.safeParse(params);
    if (error)
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createCustomer',
      );

    const res = await this._client.post<Record<string, unknown>>(
      '/customers',
      {
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) throw new Error('Failed to create customer');
    return res.value as unknown as Customer;
  };

  retrieveCustomer = async (id: string): Promise<Customer> => {
    const { error } = retrieveCustomerSchema.safeParse({ id });
    if (error)
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'retrieveCustomer',
      );

    const res = await this._client.get<Record<string, unknown>>(
      `/customers/${id}`,
    );
    if (!res.ok) throw new Error('Failed to retrieve customer');
    return res.value as unknown as Customer;
  };

  updateCustomer = async (
    id: string,
    params: UpdateCustomerParams,
  ): Promise<Customer> => {
    const { error, data } = updateCustomerSchema.safeParse({
      id,
      ...params,
    });
    if (error)
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'updateCustomer',
      );

    const res = await this._client.put<Record<string, unknown>>(
      `/customers/${id}`,
      {
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) throw new Error('Failed to update customer');
    return res.value as unknown as Customer;
  };

  deleteCustomer = (id: string): Promise<null> =>
    this._ni('deleteCustomer');

  createPayment = (params: CreatePaymentSchema): Promise<Payment> =>
    this._ni('createPayment');
  retrievePayment = (id: string): Promise<Payment | null> =>
    this._ni('retrievePayment');
  updatePayment = (
    id: string,
    params: UpdatePaymentSchema,
  ): Promise<Payment> => this._ni('updatePayment');
  deletePayment = (id: string): Promise<null> =>
    this._ni('deletePayment');
  capturePayment = (
    id: string,
    params: CapturePaymentSchema,
  ): Promise<Payment> => this._ni('capturePayment');
  cancelPayment = (id: string): Promise<Payment> =>
    this._ni('cancelPayment');

  createSubscription = (
    params: CreateSubscriptionSchema,
  ): Promise<Subscription> => this._ni('createSubscription');

  retrieveSubscription = async (
    id: string,
  ): Promise<Subscription> => {
    const { error } = retrieveSubscriptionSchema.safeParse({ id });
    if (error)
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'retrieveSubscription',
      );

    const res = await this._client.get<Record<string, unknown>>(
      `/subscriptions/${id}`,
    );
    if (!res.ok) throw new Error('Failed to retrieve subscription');
    return res.value as unknown as Subscription;
  };

  updateSubscription = async (
    id: string,
    params: UpdateSubscriptionSchema,
  ): Promise<Subscription> => {
    const { error, data } = updateSubscriptionSchema.safeParse({
      id,
      ...params,
    });
    if (error)
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'updateSubscription',
      );

    const res = await this._client.put<Record<string, unknown>>(
      `/subscriptions/${id}`,
      {
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) throw new Error('Failed to update subscription');
    return res.value as unknown as Subscription;
  };

  deleteSubscription = (id: string): Promise<null> =>
    this._ni('deleteSubscription');
  cancelSubscription = (id: string): Promise<Subscription> =>
    this._ni('cancelSubscription');

  createRefund = (params: CreateRefundSchema): Promise<Refund> =>
    this._ni('createRefund');

  handleWebhook = async (
    payload: WebhookHandlerConfig,
    webhookSecret: string | null,
  ): Promise<
    Array<WebhookEventPayload<WithoutProviderRawEvents>>
  > => {
    const { headersAsObject } = payload;

    const headers = new Headers(headersAsObject);

    const signature = headers.get('X-Signature');

    if (!signature) throw new Error('Signature is required');

    throw new NotImplementedError(
      'Method not implemented.',
      this.providerName,
      {
        futureSupport: true,
      },
    );
  };
}
