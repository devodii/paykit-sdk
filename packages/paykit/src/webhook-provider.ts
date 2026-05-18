import { WebhookError } from './error';
import { PayKitProvider } from './paykit-provider';
import {
  CustomerCreated,
  CustomerDeleted,
  CustomerUpdated,
  SubscriptionCanceled,
  SubscriptionCreated,
  SubscriptionUpdated,
  InvoiceGenerated,
  PaymentCreated,
  PaymentUpdated,
  PaymentSucceeded,
  PaymentFailed,
  RefundCreated,
  WebhookEvent,
} from './resources/webhook';

export interface StandardEventHandlers {
  'customer.created': (event: CustomerCreated) => Promise<any>;
  'customer.updated': (event: CustomerUpdated) => Promise<any>;
  'customer.deleted': (event: CustomerDeleted) => Promise<any>;
  'subscription.created': (
    event: SubscriptionCreated,
  ) => Promise<any>;
  'subscription.updated': (
    event: SubscriptionUpdated,
  ) => Promise<any>;
  'subscription.canceled': (
    event: SubscriptionCanceled,
  ) => Promise<any>;
  'payment.created': (event: PaymentCreated) => Promise<any>;
  'payment.updated': (event: PaymentUpdated) => Promise<any>;
  'payment.succeeded': (event: PaymentSucceeded) => Promise<any>;
  'payment.failed': (event: PaymentFailed) => Promise<any>;
  'refund.created': (event: RefundCreated) => Promise<any>;
  'invoice.generated': (event: InvoiceGenerated) => Promise<any>;
}

export type StandardWebhookEventType = keyof StandardEventHandlers;

export type WebhookSetupConfig<TRaw extends Record<string, any>> = {
  /**
   * The secret key for the webhook. Pass null for providers that do not use a shared secret.
   */
  webhookSecret: string | null;

  /**
   * The provider for the webhook.
   */
  provider: PayKitProvider<any, any, TRaw>;
};

export type WebhookHandlerConfig = {
  /**
   * The body of the webhook.
   */
  body: string;

  /**
   * The headers of the webhook.
   */
  headersAsObject: Record<string, string>;

  /**
   * The full URL of the webhook.
   */
  fullUrl: string;
};

/**
 * @template TRawEvents - Map of Namespaced Event Name -> Data Type
 * @example { 'stripe.payment_intent.succeeded': Stripe.PaymentIntent }
 */
export class Webhook<
  TRawEvents extends Record<string, any> = Record<string, any>,
> {
  private handlers: Map<string, ((event: any) => Promise<void>)[]> =
    new Map();
  private config: WebhookSetupConfig<TRawEvents> | null = null;

  setup(config: WebhookSetupConfig<TRawEvents>): Webhook<TRawEvents> {
    this.config = config;
    return this;
  }

  on<T extends keyof StandardEventHandlers | keyof TRawEvents>(
    eventType: T,
    handler: T extends keyof StandardEventHandlers
      ? StandardEventHandlers[T]
      : T extends keyof TRawEvents
        ? (data: TRawEvents[T]) => Promise<any>
        : never,
  ): Webhook<TRawEvents> {
    if (!this.config) {
      throw new WebhookError(
        'Webhook not configured. Call setup() first.',
      );
    }

    const typeStr = eventType as string;
    if (!this.handlers.has(typeStr)) {
      this.handlers.set(typeStr, []);
    }

    this.handlers.get(typeStr)?.push(handler);
    return this;
  }

  async handle(dto: WebhookHandlerConfig): Promise<void> {
    if (!this.config) {
      throw new WebhookError(
        'Webhook not configured. Call setup() first.',
      );
    }

    const { webhookSecret, provider } = this.config;
    const events = await provider.handleWebhook(dto, webhookSecret);

    const executionPromises: Promise<any>[] = [];

    for (const event of events) {
      const matchedHandlers = this.handlers.get(event.type);

      if (matchedHandlers) {
        for (const handler of matchedHandlers) {
          const payload = event.is_raw ? event.data : event;
          executionPromises.push(handler(payload));
        }
      }
    }

    await Promise.all(executionPromises);
  }
}
