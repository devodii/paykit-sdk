import {
  Checkout,
  Invoice,
  omitInternalMetadata,
  PAYKIT_METADATA_KEY,
  Payee,
  Payment,
  Refund,
  Schema,
  billingModeSchema,
  parseJSON,
} from '@paykit-sdk/core';
import { ChapaRefund, ChapaTransaction } from '../schema';

const chapaStatusMap: Record<string, Payment['status']> = {
  success: 'succeeded',
  failed: 'failed',
  pending: 'pending',
};

const resolveCustomer = (
  data: Pick<ChapaTransaction, 'email'>,
): Payee | null => (data.email ? { email: data.email } : null);

/**
 * @internal
 */
export const Payment$inboundSchema = (
  data: ChapaTransaction,
  overridePaymentUrl?: string | null,
): Payment => {
  const rawMeta = data.meta ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  let itemId: string | null = null;

  const paykitMeta = parseJSON(
    rawMeta[PAYKIT_METADATA_KEY] as string,
    Schema.object({ item_id: Schema.string().optional() }),
  );

  if (paykitMeta) itemId = paykitMeta.item_id ?? null;

  const status = chapaStatusMap[data.status] ?? 'pending';

  return {
    id: data.tx_ref,
    amount: parseFloat(data.amount),
    currency: data.currency,
    customer: resolveCustomer(data),
    status,
    metadata,
    item_id: itemId,
    requires_action: status === 'pending',
    payment_url: overridePaymentUrl ?? null,
  };
};

/**
 * @internal
 */
export const Checkout$inboundSchema = (
  init: { checkout_url: string | null; tx_ref: string },
  transaction: Omit<
    Partial<ChapaTransaction>,
    'amount' | 'currency'
  > & {
    amount?: number | string;
    currency?: string;
  },
): Checkout => {
  const rawMeta = transaction.meta ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  let itemId = '';
  let quantity = 1;
  let type: Checkout['session_type'] | null = null;

  const paykitMeta = parseJSON(
    rawMeta[PAYKIT_METADATA_KEY] as string,
    Schema.object({
      item_id: Schema.string().optional(),
      quantity: Schema.number().optional(),
      type: billingModeSchema.optional(),
    }),
  );

  if (paykitMeta) {
    itemId = paykitMeta.item_id ?? '';
    quantity = paykitMeta.quantity ?? 1;
    type = paykitMeta.type ?? null;
  }

  const amount =
    typeof transaction.amount === 'string'
      ? parseFloat(transaction.amount)
      : (transaction.amount ?? 0);

  return {
    id: init.tx_ref,
    customer: resolveCustomer({ email: transaction.email ?? null }),
    payment_url: init.checkout_url ?? '',
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
    session_type: type ?? 'one_time',
    products: [{ id: itemId, quantity }],
    currency: transaction.currency ?? 'ETB',
    amount,
  };
};

/**
 * @internal
 */
export const Invoice$inboundSchema = (
  data: ChapaTransaction,
): Invoice => {
  const rawMeta = data.meta ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  return {
    id: data.reference,
    customer: resolveCustomer(data),
    subscription_id: null,
    billing_mode: 'one_time',
    amount_paid: parseFloat(data.amount),
    currency: data.currency,
    status: 'paid',
    paid_at: data.updated_at,
    line_items: null,
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
    custom_fields: null,
  };
};

/**
 * Builds a `Refund` from a `charge.refunded`/`charge.reversed` webhook
 * payload, which is a transaction snapshot rather than a dedicated refund
 * resource - Chapa doesn't send a refund id on these events, so `tx_ref`
 * is used as the id.
 *
 * @internal
 */
export const RefundFromTransaction$inboundSchema = (data: ChapaTransaction): Refund => {
  const rawMeta = data.meta ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  return {
    id: data.tx_ref,
    amount: parseFloat(data.amount),
    currency: data.currency,
    reason: null,
    metadata: Object.keys(metadata).length > 0 ? (metadata as Record<string, string>) : null,
  };
};

/**
 * @internal
 */
export const Refund$inboundSchema = (
  data: Partial<ChapaRefund>,
  context: {
    paymentId: string;
    amount: number;
    currency: string;
    reason: string | null;
  },
): Refund => ({
  id: data.ref_id ?? context.paymentId,
  amount: data.amount ?? context.amount,
  currency: data.currency ?? context.currency,
  reason: context.reason,
  metadata: null,
});
