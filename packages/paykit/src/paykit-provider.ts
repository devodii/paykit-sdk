import { z } from 'zod';
import { ConfigurationError } from './error';
import {
  Checkout,
  CreateCheckoutSchema,
  UpdateCheckoutSchema,
} from './resources/checkout';
import {
  CreateCustomerParams,
  Customer,
  UpdateCustomerParams,
} from './resources/customer';
import {
  CapturePaymentSchema,
  CreatePaymentSchema,
  Payment,
  UpdatePaymentSchema,
} from './resources/payment';
import { CreateRefundSchema, Refund } from './resources/refund';
import {
  CreateSubscriptionSchema,
  Subscription,
  UpdateSubscriptionSchema,
} from './resources/subscription';
import { WebhookEventPayload } from './resources/webhook';
import { WebhookHandlerConfig } from './webhook-provider';

export interface ProviderMetadataRegistry {
  checkout?: any;
  customer?: any;
  payment?: any;
  subscription?: any;
  refund?: any;
}

export interface PayKitProvider<
  TMetadata extends
    ProviderMetadataRegistry = ProviderMetadataRegistry,
  TNativeClient = any,
  TRawEvents extends Record<string, any> = Record<string, any>,
> {
  /**
   * The name of the provider implementation
   * This is a required property for agentic services on the provider
   */
  readonly providerName: string;

  readonly isSandbox: boolean;

  /**
   * ESCAPE HATCH: Access the underlying SDK (Stripe, Adyen, etc.) directly.
   * This allows devs to use features we haven't mapped yet without leaving the ecosystem.
   */
  readonly _native: TNativeClient;

  /** Checkout */
  createCheckout(
    params: CreateCheckoutSchema<TMetadata['checkout']>,
  ): Promise<Checkout>;
  retrieveCheckout(id: string): Promise<Checkout | null>;
  updateCheckout(
    id: string,
    params: UpdateCheckoutSchema<TMetadata['checkout']>,
  ): Promise<Checkout>;
  deleteCheckout(id: string): Promise<null>;

  /** Customer */
  createCustomer(
    params: CreateCustomerParams<TMetadata['customer']>,
  ): Promise<Customer>;
  updateCustomer(
    id: string,
    params: UpdateCustomerParams<TMetadata['customer']>,
  ): Promise<Customer>;
  retrieveCustomer(id: string): Promise<Customer | null>;
  deleteCustomer(id: string): Promise<null>;

  /** Subscription */
  createSubscription(
    params: CreateSubscriptionSchema<TMetadata['subscription']>,
  ): Promise<Subscription>;
  updateSubscription(
    id: string,
    params: UpdateSubscriptionSchema<TMetadata['subscription']>,
  ): Promise<Subscription>;
  cancelSubscription(id: string): Promise<Subscription>;
  deleteSubscription(id: string): Promise<null>;
  retrieveSubscription(id: string): Promise<Subscription | null>;

  /** Payment */
  createPayment(
    params: CreatePaymentSchema<TMetadata['payment']>,
  ): Promise<Payment>;
  updatePayment(
    id: string,
    params: UpdatePaymentSchema<TMetadata['payment']>,
  ): Promise<Payment>;
  retrievePayment(id: string): Promise<Payment | null>;
  deletePayment(id: string): Promise<null>;
  capturePayment(
    id: string,
    params: CapturePaymentSchema,
  ): Promise<Payment>;
  cancelPayment(id: string): Promise<Payment>;

  /** Refund */
  createRefund(
    params: CreateRefundSchema<TMetadata['refund']>,
  ): Promise<Refund>;

  /** Webhook */
  handleWebhook(
    payload: WebhookHandlerConfig,
    webhookSecret: string | null,
  ): Promise<Array<WebhookEventPayload<TRawEvents>>>;
}

export class AbstractPayKitProvider {
  protected constructor(
    schema: z.ZodType<Record<string, unknown>>,
    options: unknown,
    providerName: string,
  ) {
    const { error } = schema.safeParse(options);

    if (error) {
      throw new ConfigurationError(
        `Invalid ${providerName} configuration`,
        {
          provider: providerName,
          missingKeys: Object.keys(error.flatten().fieldErrors ?? {}),
        },
      );
    }
  }
}
