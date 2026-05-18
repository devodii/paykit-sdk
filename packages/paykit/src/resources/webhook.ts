import { Customer } from './customer';
import { Invoice } from './invoice';
import { Payment } from './payment';
import { Refund } from './refund';
import { Subscription } from './subscription';

export interface WebhookEvent<T = any> {
  /**
   * The ID of the webhook event.
   */
  id: string;

  /**
   * The type of the webhook event (Standard or Raw)
   */
  type: string;

  /**
   * The created timestamp of the webhook event.
   */
  created: number;

  /**
   * The data of the webhook event.
   */
  data: T;

  /**
   * Whether the webhook event is raw from the provider.
   */
  is_raw?: boolean;
}

export type CustomerCreated = WebhookEvent<Customer>;
export type CustomerUpdated = WebhookEvent<Customer | null>;
export type CustomerDeleted = WebhookEvent<Customer | null>;
export type SubscriptionCreated = WebhookEvent<Subscription>;
export type SubscriptionUpdated = WebhookEvent<Subscription | null>;
export type SubscriptionCanceled = WebhookEvent<Subscription | null>;
export type PaymentCreated = WebhookEvent<Payment>;
export type PaymentUpdated = WebhookEvent<Payment | null>;
export type PaymentSucceeded = WebhookEvent<Payment>;
export type PaymentFailed = WebhookEvent<Payment | null>;
export type RefundCreated = WebhookEvent<Refund>;
export type InvoiceGenerated = WebhookEvent<Invoice>;

/**
 * Raw Provider-Specific Event Escape Hatch
 */
export interface RawWebhookEvent<
  TProvider extends string = string,
  TData = any,
> extends WebhookEvent<TData> {
  type: `${TProvider}.${string}`;
  is_raw: true;
}

export type WebhookEventPayload<
  TRawMap extends Record<string, any> = Record<string, any>,
> =
  | CustomerCreated
  | CustomerUpdated
  | CustomerDeleted
  | SubscriptionCreated
  | SubscriptionUpdated
  | SubscriptionCanceled
  | PaymentCreated
  | PaymentUpdated
  | PaymentSucceeded
  | PaymentFailed
  | RefundCreated
  | InvoiceGenerated
  | { [K in keyof TRawMap]: WebhookEvent<TRawMap[K]> }[keyof TRawMap];

export const paykitEvent$InboundSchema = <Resource>(
  event: WebhookEvent<Resource>,
) => event;
