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
  XenditCustomer,
  XenditInvoice,
  XenditRecurringInterval,
  XenditRecurringPlan,
  XenditRefund,
} from '../schema';

const paymentStatusMap: Record<string, PaymentStatus> = {
  PENDING: 'pending',
  PAID: 'succeeded',
  SETTLED: 'succeeded',
  EXPIRED: 'canceled',
};

const subscriptionStatusMap: Record<string, SubscriptionStatus> = {
  ACTIVE: 'active',
  INACTIVE: 'canceled',
  PENDING: 'pending',
  REQUIRES_ACTION: 'pending',
};

const resolveCustomerFromEmail = (
  email: string | null | undefined,
): Payee | null => (email ? { email } : null);

/**
 * @internal
 */
export const Payment$inboundSchema = (
  data: XenditInvoice,
  overridePaymentUrl?: string | null,
): Payment => {
  const rawMeta = data.metadata ?? {};
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
    customer: resolveCustomerFromEmail(
      data.payer_email ?? data.customer?.email,
    ),
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
  data: XenditInvoice,
): Checkout => {
  const rawMeta = data.metadata ?? {};
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
    customer: resolveCustomerFromEmail(
      data.payer_email ?? data.customer?.email,
    ),
    payment_url: data.invoice_url,
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
  data: XenditCustomer,
): Customer => {
  const rawMeta = data.metadata ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  const name = [
    data.individual_detail?.given_names,
    data.individual_detail?.surname,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    id: data.id,
    email: data.email ?? '',
    name,
    phone: data.mobile_number ?? data.phone_number ?? null,
    metadata,
    created_at: new Date(data.created),
    updated_at: new Date(data.updated),
    // Xendit-native fields with no PayKit core equivalent.
    custom_fields: { type: data.type ?? null },
  };
};

const recurringIntervalUnitMap: Record<
  XenditRecurringInterval,
  'day' | 'week' | 'month'
> = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
};

/**
 * Xendit's Recurring Plans API has no separate reusable plan template to
 * reference - the "plan" created here already carries the amount/currency
 * for one specific subscription, so `item_id` is round-tripped through
 * `description` instead of pointing at an external resource.
 *
 * @internal
 */
export const Subscription$inboundSchema = (
  data: XenditRecurringPlan,
): Subscription => {
  const rawMeta = data.metadata ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  const status = subscriptionStatusMap[data.status] ?? 'pending';
  const periodAnchor = data.schedule.anchor_date
    ? new Date(data.schedule.anchor_date)
    : new Date(0);

  const authAction = data.actions?.find(
    action => action.action === 'AUTH',
  );

  return {
    id: data.id,
    customer: { id: data.customer_id },
    amount: data.amount,
    currency: data.currency,
    status,
    current_period_start: periodAnchor,
    current_period_end: periodAnchor,
    item_id: data.description ?? data.reference_id,
    billing_interval:
      recurringIntervalUnitMap[data.schedule.interval] ?? 'month',
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
    custom_fields: {
      payment_tokens: data.payment_tokens,
      recurring_cycle_count: data.recurring_cycle_count ?? null,
      failed_cycle_action: data.failed_cycle_action ?? null,
    },
    requires_action:
      status === 'pending' || data.status === 'REQUIRES_ACTION',
    payment_url: authAction?.url ?? null,
  };
};

/**
 * @internal
 */
export const Refund$inboundSchema = (data: XenditRefund): Refund => {
  const rawMeta = data.metadata ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  return {
    id: data.id,
    amount: data.amount,
    currency: data.currency,
    reason: data.reason ?? null,
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
  data: XenditInvoice,
): Invoice => {
  const rawMeta = data.metadata ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  return {
    id: data.id,
    customer: resolveCustomerFromEmail(
      data.payer_email ?? data.customer?.email,
    ),
    subscription_id: data.recurring_payment_id ?? null,
    billing_mode: data.recurring_payment_id
      ? 'recurring'
      : 'one_time',
    amount_paid: data.paid_amount ?? data.amount,
    currency: data.currency,
    status: 'paid',
    paid_at: data.paid_at ?? data.updated,
    line_items:
      data.items?.map(item => ({
        id: item.name,
        quantity: item.quantity,
      })) ?? null,
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
    custom_fields: {
      payment_method: data.payment_method ?? null,
      payment_channel: data.payment_channel ?? null,
    },
  };
};
