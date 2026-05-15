import { z } from 'zod';
import { schema } from '../tools';
import { Payee, payeeSchema } from './customer';
import { metadataSchema, PaykitMetadata } from './metadata';

export const subscriptionIntervalUnitSchema = z.enum([
  'day',
  'week',
  'month',
  'year',
]);

export const subscriptionBillingIntervalSchema = z.union([
  subscriptionIntervalUnitSchema,
  z.object({
    type: z.literal('custom'),
    durationMs: z.number().int().positive(),
  }),
]);

export type SubscriptionBillingInterval = z.infer<
  typeof subscriptionBillingIntervalSchema
>;

export const subscriptionStatusSchema = z.enum([
  'active',
  'past_due',
  'canceled',
  'expired',
  'trialing',
  'pending',
]);

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export interface Subscription {
  /**
   * The unique identifier of the subscription.
   */
  id: string;

  /**
   * The payee linked to the subscription.
   */
  customer: Payee | null;

  /**
   * The amount of the subscription.
   */
  amount: number;

  /**
   * The currency of the subscription.
   */
  currency: string;

  /**
   * The status of the subscription.
   */
  status: SubscriptionStatus;

  /**
   * The start of the current billing period.
   */
  current_period_start: Date;

  /**
   * The end of the current billing period.
   */
  current_period_end: Date;

  /**
   * The item ID of the subscription.
   */
  item_id: string;

  /**
   * The billing interval of the subscription.
   */
  billing_interval: SubscriptionBillingInterval;

  /**
   * The metadata of the subscription.
   */
  metadata: PaykitMetadata | null;

  /**
   * The custom fields of the subscription.
   */
  custom_fields: Record<string, unknown> | null;

  /**
   * Whether the subscription requires action.
   */
  requires_action: boolean;

  /**
   * The URL to the payment page of the subscription if requires action.
   */
  payment_url: string | null;
}

export const subscriptionSchema = schema<Subscription>()(
  z.object({
    id: z.string(),
    customer: payeeSchema.nullable(),
    amount: z.number(),
    currency: z.string(),
    status: subscriptionStatusSchema,
    current_period_start: z.date(),
    current_period_end: z.date(),
    item_id: z.string(),
    billing_interval: subscriptionBillingIntervalSchema,
    metadata: metadataSchema.nullable(),
    custom_fields: z.record(z.string(), z.unknown()).nullable(),
    requires_action: z.boolean(),
    payment_url: z.string().nullable(),
  }),
);

export interface UpdateSubscriptionSchema<
  TProviderMetadata = Record<string, unknown>,
> {
  /**
   * The metadata of the subscription.
   */
  metadata: PaykitMetadata;

  /**
   * The provider metadata of the subscription.
   */
  provider_metadata?: TProviderMetadata;
}

export const updateSubscriptionSchema = schema<UpdateSubscriptionSchema>()(
  z.object({
    metadata: metadataSchema,
    provider_metadata: z.record(z.string(), z.unknown()).optional(),
  }),
);

export interface RetrieveSubscriptionSchema {
  /**
   * The unique identifier of the subscription.
   */
  id: string;
}

export const retrieveSubscriptionSchema = schema<RetrieveSubscriptionSchema>()(
  z.object({
    id: z.string(),
  }),
);

export interface DeleteSubscriptionSchema {
  /**
   * The unique identifier of the subscription.
   */
  id: string;
}

export const deleteSubscriptionSchema = schema<DeleteSubscriptionSchema>()(
  z.object({
    id: z.string(),
  }),
);

export interface CreateSubscriptionSchema<
  TProviderMetadata = Record<string, unknown>,
> extends Omit<
    Subscription,
    | 'id'
    | 'status'
    | 'custom_fields'
    | 'current_period_start'
    | 'current_period_end'
    | 'requires_action'
    | 'payment_url'
  > {
  /**
   * The provider metadata of the subscription.
   */
  provider_metadata?: TProviderMetadata;

  /**
   * The quantity of the subscription.
   */
  quantity: number;
}

export const createSubscriptionSchema = schema<CreateSubscriptionSchema>()(
  subscriptionSchema
    .omit({
      id: true,
      status: true,
      custom_fields: true,
      current_period_start: true,
      current_period_end: true,
      requires_action: true,
      payment_url: true,
    })
    .extend({
      provider_metadata: z.record(z.string(), z.unknown()).optional(),
      quantity: z.number(),
    }),
);
