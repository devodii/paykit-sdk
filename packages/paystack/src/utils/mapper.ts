import {
  Checkout,
  Customer,
  Invoice,
  Payment,
  Refund,
  Subscription,
  SubscriptionBillingInterval,
  omitInternalMetadata,
  PAYKIT_METADATA_KEY,
  parseJSON,
  Schema,
  billingModeSchema,
  parseCustomerName,
} from '@paykit-sdk/core';
import {
  PaystackCustomer,
  PaystackInitializeResponse,
  PaystackRefund,
  PaystackSubscription,
  PaystackTransaction,
} from '../schema';

/**
 * @internal
 */
export const Customer$inboundSchema = (
  data: PaystackCustomer,
): Customer => {
  const { fullName } = parseCustomerName({
    name:
      [data.first_name, data.last_name].filter(Boolean).join(' ') ??
      undefined,
    email: data.email,
  });

  return {
    id: data.customer_code,
    email: data.email,
    name: fullName,
    phone: data.phone ?? '',
    metadata: (data.metadata as Record<string, string>) ?? undefined,
    created_at: new Date(data.created_at),
    updated_at: data.updated_at ? new Date(data.updated_at) : null,
  };
};

const paystackStatusMap: Record<string, Payment['status']> = {
  success: 'succeeded',
  failed: 'failed',
  pending: 'pending',
  abandoned: 'canceled',
};

/**
 * @internal
 */
export const Payment$inboundSchema = (
  data: PaystackTransaction,
  overridePaymentUrl?: string | null,
): Payment => {
  const rawMetadata =
    parseJSON(
      data.metadata as unknown as string,
      Schema.record(Schema.string(), Schema.unknown()),
    ) ?? {};
  const metadata = omitInternalMetadata(rawMetadata);

  let itemId: string | null = null;

  const paykitMeta = parseJSON(
    rawMetadata[PAYKIT_METADATA_KEY] as string,
    Schema.object({
      item_id: Schema.string().optional(),
    }),
  );

  if (paykitMeta) {
    itemId = paykitMeta.item_id ?? null;
  }

  const status = paystackStatusMap[data.status] ?? 'pending';

  return {
    id: data.reference,
    amount: data.amount,
    currency: data.currency,
    customer: data.customer?.email
      ? { email: data.customer.email }
      : null,
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
  init: PaystackInitializeResponse,
  transaction: Partial<PaystackTransaction> & {
    currency?: string;
    amount?: number;
  },
): Checkout => {
  const rawMetadata =
    parseJSON(
      transaction.metadata as unknown as string,
      Schema.record(Schema.string(), Schema.unknown()),
    ) ?? {};

  const metadata = omitInternalMetadata(rawMetadata);

  let itemId = '';
  let quantity = 1;
  let type = null;

  const paykitMeta = parseJSON(
    rawMetadata[PAYKIT_METADATA_KEY] as string,
    Schema.object({
      item_id: Schema.string().optional(),
      quantity: Schema.number().optional(),
      type: billingModeSchema.optional(),
    }),
  );

  if (paykitMeta && typeof paykitMeta === 'string') {
    const parsed = parseJSON(
      paykitMeta,
      Schema.object({
        item_id: Schema.string().optional(),
        quantity: Schema.number().optional(),
        type: billingModeSchema.optional(),
      }),
    );

    if (parsed) {
      itemId = parsed.item_id ?? '';
      quantity = parsed.quantity ?? 1;
      type = parsed.type ?? null;
    }
  }

  return {
    id: init.reference,
    customer: transaction.customer?.email
      ? { email: transaction.customer.email }
      : null,
    payment_url: init.authorization_url,
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
    session_type: type ?? 'one_time',
    products: [{ id: itemId, quantity }],
    currency: transaction.currency ?? 'NGN',
    amount: transaction.amount ?? 0,
  };
};

const paystackIntervalMap: Record<
  string,
  SubscriptionBillingInterval
> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  annually: 'year',
  quarterly: {
    type: 'custom',
    durationMs: 3 * 30 * 24 * 60 * 60 * 1000,
  },
  biannually: {
    type: 'custom',
    durationMs: 6 * 30 * 24 * 60 * 60 * 1000,
  },
};

const paystackSubscriptionStatusMap: Record<
  string,
  Subscription['status']
> = {
  active: 'active',
  'non-renewing': 'canceled',
  cancelled: 'canceled',
  attention: 'past_due',
  completed: 'expired',
};

/**
 * @internal
 */
export const Subscription$inboundSchema = (
  data: PaystackSubscription,
): Subscription => {
  const nextPaymentDate = data.next_payment_date
    ? new Date(data.next_payment_date)
    : new Date();

  return {
    id: data.subscription_code,
    customer: data.customer?.email
      ? { email: data.customer.email }
      : null,
    amount: data.amount,
    currency: data.currency || data.plan?.currency || 'NGN',
    status: paystackSubscriptionStatusMap[data.status] ?? 'active',
    current_period_start: new Date(data.createdAt),
    current_period_end: nextPaymentDate,
    item_id: data.plan?.plan_code ?? '',
    billing_interval:
      paystackIntervalMap[data.plan?.interval] ?? 'month',
    metadata: null,
    custom_fields: null,
    requires_action: false,
    payment_url: null,
  };
};

/**
 * @internal
 */
export const Refund$inboundSchema = (
  data: PaystackRefund,
  fallbackCurrency: string,
): Refund => ({
  id: String(data.id),
  amount: data.amount,
  currency: data.currency || fallbackCurrency,
  reason: data.customer_note || data.merchant_note || null,
  metadata: null,
});

/**
 * @internal
 */
export const Invoice$inboundSchema = (
  data: PaystackTransaction,
): Invoice => {
  const rawMetadata =
    parseJSON(
      data.metadata as unknown as string,
      Schema.record(Schema.string(), Schema.unknown()),
    ) ?? {};

  const metadata = omitInternalMetadata(rawMetadata);

  return {
    id: String(data.id),
    customer: data.customer?.email
      ? { email: data.customer.email }
      : null,
    subscription_id: null,
    billing_mode: 'one_time',
    amount_paid: data.amount,
    currency: data.currency,
    status: 'paid',
    paid_at: data.paid_at ?? new Date().toISOString(),
    line_items: null,
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
    custom_fields: null,
  };
};
