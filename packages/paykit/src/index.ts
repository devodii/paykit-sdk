import { z } from 'zod';
import { PayKitProvider } from './paykit-provider';
import { CreateRefundSchema } from './resources';
import { CreateCheckoutSchema, UpdateCheckoutSchema } from './resources/checkout';
import { CreateCustomerParams, UpdateCustomerParams } from './resources/customer';
import {
  CapturePaymentSchema,
  CreatePaymentSchema,
  UpdatePaymentSchema,
} from './resources/payment';
import {
  CreateSubscriptionSchema,
  UpdateSubscriptionSchema,
} from './resources/subscription';
import { Webhook, WebhookSetupConfig } from './webhook-provider';

export const PAYKIT_METADATA_KEY = '__paykit';

class PayKit {
  constructor(private provider: PayKitProvider) {}

  checkouts = {
    create: (params: CreateCheckoutSchema) => this.provider.createCheckout(params),
    retrieve: (id: string) => this.provider.retrieveCheckout(id),
    update: (id: string, params: UpdateCheckoutSchema) =>
      this.provider.updateCheckout(id, params),
    delete: (id: string) => this.provider.deleteCheckout(id),
  };

  customers = {
    create: (params: CreateCustomerParams) => this.provider.createCustomer(params),
    update: (id: string, params: UpdateCustomerParams) =>
      this.provider.updateCustomer(id, params),
    retrieve: (id: string) => this.provider.retrieveCustomer(id),
    delete: (id: string) => this.provider.deleteCustomer(id),
  };

  subscriptions = {
    create: (params: CreateSubscriptionSchema) =>
      this.provider.createSubscription(params),
    update: (id: string, params: UpdateSubscriptionSchema) =>
      this.provider.updateSubscription(id, params),
    cancel: (id: string) => this.provider.cancelSubscription(id),
    retrieve: (id: string) => this.provider.retrieveSubscription(id),
    delete: (id: string) => this.provider.deleteSubscription(id),
  };

  payments = {
    create: (params: CreatePaymentSchema) => this.provider.createPayment(params),
    retrieve: (id: string) => this.provider.retrievePayment(id),
    update: (id: string, params: UpdatePaymentSchema) =>
      this.provider.updatePayment(id, params),
    capture: (id: string, params: CapturePaymentSchema) =>
      this.provider.capturePayment(id, params),
    delete: (id: string) => this.provider.deletePayment(id),
    cancel: (id: string) => this.provider.cancelPayment(id),
  };

  refunds = {
    create: (params: CreateRefundSchema) => this.provider.createRefund(params),
  };

  webhooks = {
    setup: (config: Omit<WebhookSetupConfig, 'provider'>) =>
      new Webhook().setup({ ...config, provider: this.provider }),
  };
}

export { PayKit, PayKitProvider };

export * from './resources';
export * from './types';
export * from './tools';
export * from './webhook-provider';
export * from './http-client';
export * from './error';
export * from './paykit-provider';
export * from './provider-shema';
export * from './server/create-endpoint-handler';
export * from './server/endpoints';
export * from './oauth2-token-manager';
export { z as Schema };
