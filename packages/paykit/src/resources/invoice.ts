import { z } from 'zod';
import { schema } from '../tools';
import { BillingMode, billingModeSchema } from './checkout';
import { Payee, payeeSchema } from './customer';
import { metadataSchema, PaykitMetadata } from './metadata';

export const invoiceStatusSchema = z.enum(['paid', 'open']);

export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export interface Invoice {
  /**
   * The unique identifier of the invoice.
   */
  id: string;

  /**
   * The payee linked to the invoice.
   */
  customer: Payee | null;

  /**
   * The subscription ID, if recurring (null for one-time).
   */
  subscription_id: string | null;

  /**
   * Billing mode: one-time or recurring.
   */
  billing_mode: BillingMode;

  /**
   * Amount paid in smallest currency unit (e.g., cents).
   */
  amount_paid: number;

  /**
   * ISO 4217 currency code (e.g., USD, EUR).
   */
  currency: string;

  /**
   * Invoice status.
   */
  status: InvoiceStatus;

  /**
   * Date the invoice was paid (ISO 8601 string, null if unpaid).
   */
  paid_at: string | null;

  /**
   * Line items of the invoice.
   */
  line_items: Array<{ id: string; quantity: number }> | null;

  /**
   * Metadata for provider-specific or custom data.
   */
  metadata: PaykitMetadata | null;

  /**
   * The provider custom field
   */
  custom_fields: Record<string, unknown> | null;
}

export const invoiceSchema = schema<Invoice>()(
  z.object({
    id: z.string(),
    customer: payeeSchema.nullable(),
    subscription_id: z.string().nullable(),
    billing_mode: billingModeSchema,
    amount_paid: z.number(),
    currency: z.string(),
    status: invoiceStatusSchema,
    paid_at: z.string().nullable(),
    line_items: z
      .array(z.object({ id: z.string(), quantity: z.number() }))
      .nullable(),
    metadata: metadataSchema.nullable(),
    custom_fields: z.record(z.string(), z.any()).nullable(),
  }),
);
