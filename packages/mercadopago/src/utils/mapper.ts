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
  MercadoPagoCustomer,
  MercadoPagoPayment,
  MercadoPagoPreApproval,
  MercadoPagoPreference,
  MercadoPagoRefund,
} from '../schema';

const paymentStatusMap: Record<string, PaymentStatus> = {
  pending: 'pending',
  in_process: 'processing',
  in_mediation: 'processing',
  authorized: 'requires_capture',
  approved: 'succeeded',
  refunded: 'succeeded',
  charged_back: 'succeeded',
  rejected: 'failed',
  cancelled: 'canceled',
};

const subscriptionStatusMap: Record<string, SubscriptionStatus> = {
  pending: 'pending',
  authorized: 'active',
  paused: 'past_due',
  cancelled: 'canceled',
};

const resolveCustomerFromEmail = (
  email: string | null | undefined,
): Payee | null => (email ? { email } : null);

/**
 * @internal
 */
export const Payment$inboundSchema = (
  data: MercadoPagoPayment,
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
    id: String(data.id),
    amount: data.transaction_amount,
    currency: data.currency_id,
    customer: resolveCustomerFromEmail(data.payer?.email),
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
  data: MercadoPagoPreference,
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

  const firstItem = data.items[0];
  const amount = firstItem
    ? firstItem.unit_price * firstItem.quantity
    : 0;

  return {
    id: data.id,
    customer: resolveCustomerFromEmail(data.payer?.email),
    payment_url: data.init_point ?? data.sandbox_init_point ?? '',
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
    session_type: type ?? 'one_time',
    products: [{ id: itemId, quantity }],
    currency: firstItem?.currency_id ?? 'ARS',
    amount,
  };
};

/**
 * @internal
 */
export const Customer$inboundSchema = (
  data: MercadoPagoCustomer,
): Customer => {
  const rawMeta = data.metadata ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  const name = [data.first_name, data.last_name]
    .filter(Boolean)
    .join(' ');

  return {
    id: data.id,
    email: data.email,
    name,
    phone: data.phone?.number ?? null,
    metadata,
    created_at: data.date_created
      ? new Date(data.date_created)
      : new Date(0),
    updated_at: data.date_last_updated
      ? new Date(data.date_last_updated)
      : null,
    // Mercado Pago-native fields with no PayKit core equivalent.
    custom_fields: { identification: data.identification ?? null },
  };
};

/**
 * Mercado Pago's `auto_recurring` sub-object already carries the amount,
 * currency, and billing frequency directly on the subscription resource -
 * unlike providers whose subscription entity only references a plan id,
 * no separate plan fetch is needed here.
 *
 * @internal
 */
export const Subscription$inboundSchema = (
  data: MercadoPagoPreApproval,
): Subscription => {
  let metadata: Record<string, string> | null = null;

  if (data.external_reference) {
    const parsed = parseJSON(
      data.external_reference,
      Schema.record(Schema.string(), Schema.string()),
    );
    if (parsed) metadata = parsed;
  }

  const intervalUnitMap: Record<
    string,
    'day' | 'week' | 'month' | 'year'
  > = {
    days: 'day',
    weeks: 'week',
    months: 'month',
    years: 'year',
  };

  const status = subscriptionStatusMap[data.status] ?? 'pending';

  return {
    id: data.id,
    customer: resolveCustomerFromEmail(data.payer_email),
    amount: data.auto_recurring.transaction_amount ?? 0,
    currency: data.auto_recurring.currency_id,
    status,
    current_period_start: data.next_payment_date
      ? new Date(data.next_payment_date)
      : new Date(0),
    current_period_end: data.next_payment_date
      ? new Date(data.next_payment_date)
      : new Date(0),
    item_id: data.preapproval_plan_id ?? '',
    billing_interval:
      intervalUnitMap[data.auto_recurring.frequency_type] ?? 'month',
    metadata,
    // Mercado Pago-native fields with no PayKit core equivalent.
    custom_fields: {
      payment_method_id: data.payment_method_id ?? null,
      first_invoice_offset: data.first_invoice_offset ?? null,
    },
    requires_action: status === 'pending',
    payment_url: data.init_point ?? data.sandbox_init_point ?? null,
  };
};

/**
 * Mercado Pago's refund resource carries no currency of its own - it's
 * backfilled from the request-time context (the payment being refunded)
 * rather than assumed present on the response.
 *
 * @internal
 */
export const Refund$inboundSchema = (
  data: MercadoPagoRefund,
  context: { currency: string; reason: string | null },
): Refund => {
  const rawMeta = data.metadata ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  return {
    id: String(data.id),
    amount: data.amount,
    currency: context.currency,
    reason: data.reason ?? context.reason,
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
  };
};

/**
 * Built from an approved payment - Mercado Pago doesn't expose a dedicated
 * invoices resource for one-off Checkout Pro / Payments charges.
 *
 * @internal
 */
export const Invoice$inboundSchema = (
  data: MercadoPagoPayment,
): Invoice => {
  const rawMeta = data.metadata ?? {};
  const metadata = omitInternalMetadata(rawMeta);

  return {
    id: String(data.id),
    customer: resolveCustomerFromEmail(data.payer?.email),
    subscription_id:
      data.point_of_interaction?.transaction_data?.subscription_id ??
      null,
    billing_mode: data.point_of_interaction?.transaction_data
      ?.subscription_id
      ? 'recurring'
      : 'one_time',
    amount_paid: data.transaction_amount,
    currency: data.currency_id,
    status: 'paid',
    paid_at: data.date_approved ?? data.date_created ?? null,
    line_items: null,
    metadata:
      Object.keys(metadata).length > 0
        ? (metadata as Record<string, string>)
        : null,
    // Mercado Pago-native fields with no PayKit core equivalent.
    custom_fields: {
      payment_method_id: data.payment_method_id ?? null,
      payment_type_id: data.payment_type_id ?? null,
      installments: data.installments ?? null,
    },
  };
};
