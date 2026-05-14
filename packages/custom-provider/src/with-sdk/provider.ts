import {
  Checkout,
  CreateCheckoutSchema,
  CreateCustomerParams,
  Customer,
  PayKitProvider,
  PaykitProviderOptions,
  Subscription,
  UpdateCustomerParams,
  UpdateSubscriptionSchema,
  WebhookEventPayload,
  CreatePaymentSchema,
  CreateRefundSchema,
  CreateSubscriptionSchema,
  Payment,
  Refund,
  UpdateCheckoutSchema,
  UpdatePaymentSchema,
  schema,
  AbstractPayKitProvider,
  NotImplementedError,
  ProviderNotSupportedError,
  CapturePaymentSchema,
  WebhookHandlerConfig,
  ProviderMetadataRegistry,
} from '@paykit-sdk/core';
import { z } from 'zod';

class SomeProviderSDK {
  constructor(private readonly apiKey: string) {
    this.apiKey = apiKey;
  }
}

type WithProviderRawEvents = {
  [K in string as `provider.${K}`]: any;
};

export interface WithProviderMetadata extends ProviderMetadataRegistry {}

/**
 * @description Adjust these keys to match the credentials required by the official SDK.
 */
export interface WithProviderSDKOptions extends PaykitProviderOptions {
  /**
   * The API key for the provider
   */
  apiKey: string;
}

const withProviderSDKOptionsSchema = schema<WithProviderSDKOptions>()(
  z.object({
    apiKey: z.string().min(1),
    isSandbox: z.boolean(),
  }),
);

const providerName = 'with-sdk';

/**
 * BLUEPRINT: Integration via External SDK
 * @description Use this when wrapping an existing official library (e.g., Stripe, Adyen).
 */
export class WithProviderSDK
  extends AbstractPayKitProvider
  implements PayKitProvider<WithProviderMetadata, any, WithProviderRawEvents>
{
  readonly providerName = providerName;
  private sdk: SomeProviderSDK | null = null;

  constructor(private readonly opts: WithProviderSDKOptions) {
    super(withProviderSDKOptionsSchema, opts, providerName);

    this.sdk = new SomeProviderSDK(opts.apiKey);
  }

  private _ni(m: string): Promise<never> {
    return Promise.reject(
      new NotImplementedError(m, this.providerName, { futureSupport: true }),
    );
  }
  private _ns(m: string, r: string): Promise<never> {
    return Promise.reject(
      new ProviderNotSupportedError(m, this.providerName, { reason: r }),
    );
  }

  get _native() {
    return this.sdk;
  }

  /**
   * @example
   * try {
   *   const res = await this.sdk.checkouts.create(params);
   *   return mapToPaykit(res);
   * } catch (e) {
   *   throw new OperationFailedError("SDK Error", this.providerName, { cause: e });
   * }
   */
  createCheckout = (params: CreateCheckoutSchema): Promise<Checkout> =>
    this._ni('createCheckout');

  retrieveCheckout = (id: string): Promise<Checkout> =>
    this._ni('retrieveCheckout');

  updateCheckout = (
    id: string,
    params: UpdateCheckoutSchema,
  ): Promise<Checkout> => this._ni('updateCheckout');

  deleteCheckout = (id: string): Promise<null> => this._ni('deleteCheckout');

  createPayment = (params: CreatePaymentSchema): Promise<Payment> =>
    this._ni('createPayment');

  retrievePayment = (id: string): Promise<Payment | null> =>
    this._ni('retrievePayment');

  updatePayment = (id: string, params: UpdatePaymentSchema): Promise<Payment> =>
    this._ni('updatePayment');

  deletePayment = (id: string): Promise<null> => this._ni('deletePayment');

  capturePayment = (
    id: string,
    params: CapturePaymentSchema,
  ): Promise<Payment> => this._ni('capturePayment');

  cancelPayment = (id: string): Promise<Payment> => this._ni('cancelPayment');

  createCustomer = (params: CreateCustomerParams): Promise<Customer> =>
    this._ni('createCustomer');

  retrieveCustomer = (id: string): Promise<Customer> =>
    this._ni('retrieveCustomer');

  updateCustomer = (
    id: string,
    params: UpdateCustomerParams,
  ): Promise<Customer> => this._ni('updateCustomer');

  deleteCustomer = (id: string): Promise<null> => this._ni('deleteCustomer');

  createSubscription = (
    params: CreateSubscriptionSchema,
  ): Promise<Subscription> => this._ni('createSubscription');

  retrieveSubscription = (id: string): Promise<Subscription> =>
    this._ni('retrieveSubscription');

  updateSubscription = (
    id: string,
    params: UpdateSubscriptionSchema,
  ): Promise<Subscription> => this._ni('updateSubscription');

  deleteSubscription = (id: string): Promise<null> =>
    this._ni('deleteSubscription');

  cancelSubscription = (id: string): Promise<Subscription> =>
    this._ni('cancelSubscription');

  createRefund = (params: CreateRefundSchema): Promise<Refund> =>
    this._ni('createRefund');

  handleWebhook = (
    payload: WebhookHandlerConfig,
    webhookSecret: string,
  ): Promise<Array<WebhookEventPayload<WithProviderRawEvents>>> =>
    this._ni('handleWebhook');
}
