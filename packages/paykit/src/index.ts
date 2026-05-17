import { z } from 'zod';
import { PayKitProvider } from './paykit-provider';
import { providerSchema } from './provider-schema';
import { Telemetry } from './telemetry';
import { Webhook, WebhookSetupConfig } from './webhook-provider';

export const PAYKIT_METADATA_KEY = '__paykit';

/**
 * @template TMetadata - The registry of provider-specific metadata types
 * @template TNative - The type of the underlying native SDK client
 */
class PayKit<P extends PayKitProvider<any, any, any>> {
  constructor(private provider: P) {
    providerSchema.parse(provider);
  }

  private readonly sdkVersion = process.env.SDK_VERSION || '1.0.0';

  /**
   * Access the underlying native SDK (e.g., Stripe, Adyen) directly
   * with full type safety.
   */
  get _native(): P['_native'] {
    return this.provider._native;
  }

  private _track(action: string, result: any, isLiveMode: boolean) {
    if (!result) return;

    Telemetry.log(
      {
        provider: this.provider.providerName,
        action,
        amount: result.amount,
        currency: result.currency,
        status: result.status,
      },
      this.sdkVersion,
      isLiveMode,
    );
  }

  /**
   * Access the provider's name (e.g., 'stripe')
   */
  get providerName(): string {
    return this.provider.providerName;
  }

  get customers() {
    return {
      create: (params: Parameters<P['createCustomer']>[0]) =>
        this.provider.createCustomer(params),

      update: (
        id: string,
        params: Parameters<P['updateCustomer']>[1],
      ) => this.provider.updateCustomer(id, params),

      retrieve: (id: string) => this.provider.retrieveCustomer(id),
      delete: (id: string) => this.provider.deleteCustomer(id),
    };
  }

  get checkouts() {
    return {
      create: async (params: Parameters<P['createCheckout']>[0]) => {
        const res = await this.provider.createCheckout(params);
        this._track('checkout.create', res, !this.provider.isSandbox);
        return res;
      },

      retrieve: (id: string) => this.provider.retrieveCheckout(id),

      update: (
        id: string,
        params: Parameters<P['updateCheckout']>[1],
      ) => this.provider.updateCheckout(id, params),

      delete: (id: string) => this.provider.deleteCheckout(id),
    };
  }

  get payments() {
    return {
      create: async (params: Parameters<P['createPayment']>[0]) => {
        const res = await this.provider.createPayment(params);
        this._track('payment.create', res, !this.provider.isSandbox);
        return res;
      },

      retrieve: (id: string) => this.provider.retrievePayment(id),

      update: (
        id: string,
        params: Parameters<P['updatePayment']>[1],
      ) => this.provider.updatePayment(id, params),

      capture: async (
        id: string,
        params: Parameters<P['capturePayment']>[1],
      ) => {
        const res = await this.provider.capturePayment(id, params);
        this._track('payment.capture', res, !this.provider.isSandbox);
        return res;
      },

      delete: (id: string) => this.provider.deletePayment(id),
      cancel: (id: string) => this.provider.cancelPayment(id),
    };
  }

  get subscriptions() {
    return {
      create: async (
        params: Parameters<P['createSubscription']>[0],
      ) => {
        const res = await this.provider.createSubscription(params);
        this._track(
          'subscription.create',
          res,
          !this.provider.isSandbox,
        );
        return res;
      },

      update: (
        id: string,
        params: Parameters<P['updateSubscription']>[1],
      ) => this.provider.updateSubscription(id, params),

      cancel: (id: string) => this.provider.cancelSubscription(id),
      retrieve: (id: string) =>
        this.provider.retrieveSubscription(id),
      delete: (id: string) => this.provider.deleteSubscription(id),
    };
  }

  get refunds() {
    return {
      create: async (params: Parameters<P['createRefund']>[0]) => {
        const res = await this.provider.createRefund(params);
        this._track('refund.create', res, !this.provider.isSandbox);
        return res;
      },
    };
  }

  get webhooks() {
    type RawEvents =
      P extends PayKitProvider<any, any, infer R> ? R : any;

    return {
      setup: (
        config: Omit<WebhookSetupConfig<RawEvents>, 'provider'>,
      ) =>
        new Webhook<RawEvents>().setup({
          ...config,
          provider: this.provider,
        }),
    };
  }
}
export { PayKit, PayKitProvider };

export * from './resources';
export * from './types';
export * from './tools';
export * from './webhook-provider';
export * from './http-client';
export * from './error';
export * from './paykit-provider';
export * from './provider-schema';
export * from './server/create-endpoint-handler';
export * from './server/endpoints';
export * from './oauth2-token-manager';
export { z as Schema };
