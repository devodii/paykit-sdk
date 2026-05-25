import { z } from 'zod';
import { schema } from '../tools';
import { OverrideProps } from '../types';
import { BillingInfo, billingSchema } from './billing';
import { Payee, payeeSchema } from './customer';
import { metadataSchema, PaykitMetadata } from './metadata';

export interface PaymentMethod {
  /**
   * The unique identifier of the payment method.
   */
  id: string;

  /**
   * The customer ID of the payment method.
   */
  customer_id: string;

  /**
   * The type of the payment method.
   */
  type: string;

  /**
   * The last 4 digits of the payment method.
   */
  last4?: string | null;

  /**
   * The brand of the payment method.
   */
  brand?: string | null;

  /**
   * The expiration month of the payment method.
   */
  exp_month?: number | null;

  /**
   * The expiration year of the payment method.
   */
  exp_year?: number | null;

  /**
   * The metadata of the payment method.
   */
  metadata?: PaykitMetadata | null;
}

export const paymentMethodSchema = schema<PaymentMethod>()(
  z.object({
    id: z.string(),
    customer_id: z.string(),
    type: z.string(),
    last4: z.string().nullable().optional(),
    brand: z.string().nullable().optional(),
    exp_month: z.number().nullable().optional(),
    exp_year: z.number().nullable().optional(),
    metadata: metadataSchema.nullable().optional(),
  }),
);

export interface ListPaymentMethodsParams {
  /**
   * The customer ID of the payment method.
   */
  customer_id: string;

  /**
   * The type of the payment method.
   */
  type?: string;

  /**
   * The limit of the payment methods.
   */
  limit?: number;
}

export interface SavePaymentMethodParams {
  /**
   * The unique identifier of the payment.
   */
  payment_id: string;

  /**
   * The customer ID of the payment method.
   */
  customer_id: string;

  /**
   * The metadata of the payment method.
   */
  metadata?: Record<string, unknown>;
}

/**
 * @description Payment statuses
 * PENDING - Payment is created but awaiting processing
 * PROCESSING - Payment is being processed by the provider,
 * REQUIRES_ACTION - Requires user action (3DS, bank verification, etc.)
 * REQUIRES_CAPTURE - Authorized, awaiting manual capture
 * SUCCEEDED - Payment completed successfully
 * CANCELED - Payment canceled before completion
 * FAILED - Payment attempt failed
 */
export const paymentStatusSchema = z.enum([
  'pending',
  'processing',
  'requires_action',
  'requires_capture',
  'succeeded',
  'canceled',
  'failed',
]);

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export interface Payment {
  /**
   * The unique identifier of the payment.
   */
  id: string;

  /**
   * The amount of the payment.
   */
  amount: number;

  /**
   * The currency of the payment.
   */
  currency: string;

  /**
   * The payee of the payment.
   */
  customer: Payee | null;

  /**
   * The status of the payment.
   */
  status: PaymentStatus;

  /**
   * The metadata of the payment.
   */
  metadata: PaykitMetadata;

  /**
   * The item ID of the payment.
   */
  item_id: string | null;

  /**
   *
   * Whether the payment requires action.
   */
  requires_action: boolean;

  /**
   * Whether the payment requires capture.
   */
  payment_url: string | null;
}

export const paymentSchema = schema<Payment>()(
  z.object({
    id: z.string(),
    amount: z.number().min(0),
    currency: z.string(),
    customer: payeeSchema.nullable(),
    status: paymentStatusSchema,
    metadata: metadataSchema,
    item_id: z.string().nullable(),
    requires_action: z.boolean(),
    payment_url: z.string().nullable(),
  }),
);

export interface CreatePaymentSchema<
  TProviderMetadata = Record<string, unknown>,
> extends OverrideProps<
    Omit<
      Payment,
      'id' | 'status' | 'requires_action' | 'payment_url'
    >,
    { metadata?: Record<string, unknown> }
  > {
  /**
   * The provider specific params of the payment.
   */
  provider_metadata?: TProviderMetadata;

  /**
   * The shipping info of the payment.
   */
  billing?: BillingInfo;

  /**
   * The capture method of the payment.
   */
  capture_method: 'automatic' | 'manual';
}

export const createPaymentSchema = schema<CreatePaymentSchema>()(
  paymentSchema
    .omit({
      id: true,
      status: true,
      metadata: true,
      requires_action: true,
      payment_url: true,
    })
    .extend({
      metadata: z.record(z.string(), z.unknown()).optional(),
      provider_metadata: z.record(z.string(), z.unknown()).optional(),
      billing: billingSchema.optional(),
      capture_method: z.enum(['automatic', 'manual']),
    }),
);

export interface UpdatePaymentSchema<
  TProviderMetadata = Record<string, unknown>,
> extends Partial<Omit<Payment, 'id' | 'status' | 'item_id'>> {
  provider_metadata?: TProviderMetadata;
}

export const updatePaymentSchema = schema<UpdatePaymentSchema>()(
  paymentSchema.partial().extend({
    provider_metadata: z.record(z.string(), z.unknown()).optional(),
  }),
);

export interface RetrievePaymentSchema {
  /**
   * The unique identifier of the payment.
   */
  id: string;
}

export const retrievePaymentSchema = schema<RetrievePaymentSchema>()(
  paymentSchema.pick({ id: true }),
);

export interface DeletePaymentSchema {
  /**
   * The unique identifier of the payment.
   */
  id: string;
}

export const deletePaymentSchema = schema<DeletePaymentSchema>()(
  paymentSchema.pick({ id: true }),
);

export interface CapturePaymentSchema {
  /**
   * The amount to capture.
   */
  amount: number;
}

export const capturePaymentSchema = schema<CapturePaymentSchema>()(
  z.object({
    amount: z.number(),
  }),
);
