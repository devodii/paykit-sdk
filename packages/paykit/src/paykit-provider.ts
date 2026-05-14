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
import { HandleWebhookParams } from './webhook-provider';

export interface PayKitProvider {
  /**
   * The name of the provider implementation
   * This is a required property for agentic operations on the provider
   */
  readonly providerName: string;

  /**
   * Checkout sessions
   */
  createCheckout(params: CreateCheckoutSchema): Promise<Checkout>;
  retrieveCheckout(id: string): Promise<Checkout | null>;
  updateCheckout(id: string, params: UpdateCheckoutSchema): Promise<Checkout>;
  deleteCheckout(id: string): Promise<null>;

  /**
   * Customer management
   */
  createCustomer(params: CreateCustomerParams): Promise<Customer>;
  updateCustomer(id: string, params: UpdateCustomerParams): Promise<Customer>;
  retrieveCustomer(id: string): Promise<Customer | null>;
  deleteCustomer(id: string): Promise<null>;

  /**
   * Subscription management
   */
  createSubscription(params: CreateSubscriptionSchema): Promise<Subscription>;
  updateSubscription(id: string, params: UpdateSubscriptionSchema): Promise<Subscription>;
  cancelSubscription(id: string): Promise<Subscription>;
  deleteSubscription(id: string): Promise<null>;
  retrieveSubscription(id: string): Promise<Subscription | null>;

  /**
   * Payment management
   */
  createPayment(params: CreatePaymentSchema): Promise<Payment>;
  updatePayment(id: string, params: UpdatePaymentSchema): Promise<Payment>;
  retrievePayment(id: string): Promise<Payment | null>;
  deletePayment(id: string): Promise<null>;
  capturePayment(id: string, params: CapturePaymentSchema): Promise<Payment>;
  cancelPayment(id: string): Promise<Payment>;

  /**
   * Refund management
   */
  createRefund(params: CreateRefundSchema): Promise<Refund>;

  /**
   * Webhook management
   */
  handleWebhook(payload: HandleWebhookParams): Promise<Array<WebhookEventPayload>>;
}

export class AbstractPayKitProvider {
  protected constructor(
    schema: z.ZodType<Record<string, unknown>>,
    options: unknown,
    providerName: string,
  ) {
    const { error } = schema.safeParse(options);

    if (error) {
      throw new ConfigurationError(`Invalid ${providerName} configuration`, {
        provider: providerName,
        missingKeys: Object.keys(error.flatten().fieldErrors ?? {}),
      });
    }
  }
}
