import {
  Checkout,
  Customer,
  Invoice,
  omitInternalMetadata,
  PAYKIT_METADATA_KEY,
  Payee,
  Payment,
  PaymentStatus,
  Refund,
  Schema,
  Subscription,
  SubscriptionStatus,
  billingModeSchema,
  parseJSON,
} from '@paykit-sdk/core';
import {
  RazorpayCustomer,
  RazorpayPayment,
  RazorpayPaymentLink,
  RazorpayPlan,
  RazorpayRefund,
  RazorpaySubscription,
} from '../schema';

const paymentStatusMap: Record<string, PaymentStatus> = {
  created: 'pending',
  authorized: 'requires_capture',
  captured: 'succeeded',
  refunded: 'succeeded',
  failed: 'failed',
};

const subscriptionStatusMap: Record<string, SubscriptionStatus> = {
  created: 'pending',
  authenticated: 'pending',
  active: 'active',
  pending: 'past_due',
  halted: 'past_due',
  cancelled: 'canceled',
  completed: 'canceled',
  expired: 'expired',
  paused: 'canceled',
};

const resolveCustomerFromEmail = (
  email: string | null | undefined,
): Payee | null => (email ? { email } : null);

/**
 * @internal
 */
export const Payment$inboundSchema = (
  data: RazorpayPayment,
  overridePaymentUrl?: string | null,
): Payment => {
  const rawMeta = data.notes ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  let itemId: string | null = null;

  const paykitMeta = parseJSON(
    rawMeta[PAYKIT_METADATA_KEY] as string,
    Schema.object({ item_id: Schema.string().optional() }),
  );

  if (paykitMeta) itemId = paykitMeta.item_id ?? null;

  const status = paymentStatusMap[data.status] ?? 'pending';

  return {
    id: data.id,
    amount: data.amount,
    currency: data.currency,
    customer: resolveCustomerFromEmail(data.email),
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
  data: RazorpayPaymentLink,
): Checkout => {
  const rawMeta = data.notes ?? {};
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

  return {
    id: data.id,
    customer: resolveCustomerFromEmail(data.customer?.email ?? null),
    payment_url: data.short_url,
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
    session_type: type ?? 'one_time',
    products: [{ id: itemId, quantity }],
    currency: data.currency,
    amount: data.amount,
  };
};

/**
 * @internal
 */
export const Customer$inboundSchema = (
  data: RazorpayCustomer,
): Customer => {
  const rawMeta = data.notes ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    phone: data.contact,
    metadata,
    created_at: new Date(data.created_at * 1000),
    updated_at: null,
    custom_fields: { gstin: data.gstin },
  };
};

/**
 * Razorpay's subscription entity carries only `plan_id`/`quantity` - the
 * amount, currency and billing interval all live on the plan, so the plan
 * must be fetched and passed in alongside the subscription.
 *
 * @internal
 */
export const Subscription$inboundSchema = (
  data: RazorpaySubscription,
  plan: RazorpayPlan,
): Subscription => {
  const rawMeta = data.notes ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  const intervalUnitMap: Record<
    RazorpayPlan['period'],
    'day' | 'week' | 'month' | 'year'
  > = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
    quarterly: 'month',
    yearly: 'year',
  };

  const status = subscriptionStatusMap[data.status] ?? 'pending';

  return {
    id: data.id,
    customer: data.customer_id ? { id: data.customer_id } : null,
    amount: plan.item.amount * data.quantity,
    currency: plan.item.currency,
    status,
    current_period_start: data.current_start
      ? new Date(data.current_start * 1000)
      : new Date(0),
    current_period_end: data.current_end
      ? new Date(data.current_end * 1000)
      : new Date(0),
    item_id: plan.item.id,
    billing_interval: intervalUnitMap[plan.period],
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
    custom_fields: {
      source: data.source,
      total_count: data.total_count,
      paid_count: data.paid_count,
      remaining_count: data.remaining_count,
      has_scheduled_changes: data.has_scheduled_changes,
    },
    requires_action: status === 'pending',
    payment_url: data.short_url,
  };
};

/**
 * @internal
 */
export const Refund$inboundSchema = (
  data: RazorpayRefund,
): Refund => {
  const rawMeta = data.notes ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  return {
    id: data.id,
    amount: data.amount,
    currency: data.currency,
    reason: null,
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
  };
};

/**
 * @internal
 */
export const Invoice$inboundSchema = (
  data: RazorpayPayment,
): Invoice => {
  const rawMeta = data.notes ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  return {
    id: data.id,
    customer: resolveCustomerFromEmail(data.email),
    subscription_id: null,
    billing_mode: 'one_time',
    amount_paid: data.amount,
    currency: data.currency,
    status: 'paid',
    paid_at: new Date(data.created_at * 1000).toISOString(),
    line_items: null,
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
    // Razorpay-native fields with no PayKit core equivalent.
    custom_fields: {
      method: data.method,
      bank: data.bank,
      wallet: data.wallet,
      vpa: data.vpa,
      fee: data.fee,
      tax: data.tax,
      acquirer_data: data.acquirer_data,
    },
  };
};
