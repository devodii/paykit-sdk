import {
  BillingMode,
  Checkout,
  Customer,
  Invoice,
  InvoiceStatus,
  omitInternalMetadata,
  OverrideProps,
  Payee,
  PAYKIT_METADATA_KEY,
  PaymentStatus,
  Refund,
  Subscription,
  SubscriptionBillingInterval,
} from '@paykit-sdk/core';
import { Payment } from '@paykit-sdk/core';
import Stripe from 'stripe';

/**
 * @internal
 */
export const Checkout$inboundSchema = (
  checkout: Stripe.Checkout.Session,
  lineItems: Array<
    OverrideProps<
      Pick<Stripe.LineItem, 'id' | 'quantity'>,
      { quantity: number }
    >
  >,
): Checkout => {
  let customer: Payee | null = null;

  if (typeof checkout.customer === 'string')
    customer = { id: checkout.customer };
  else if (checkout.customer?.id)
    customer = { id: checkout.customer.id };
  else if (checkout.customer_email)
    customer = { email: checkout.customer_email };

  return {
    id: checkout.id,
    customer,
    session_type:
      checkout.mode === 'subscription' ? 'recurring' : 'one_time',
    payment_url: checkout.url!,
    products: lineItems.map(item => ({
      id: item.id,
      quantity: item.quantity,
    })),
    currency: checkout.currency!,
    amount: checkout.amount_total!,
    subscription: null,
    metadata: omitInternalMetadata(checkout.metadata ?? {}),
  };
};

/**
 * @internal
 */
export const Customer$inboundSchema = (
  customer: Stripe.Customer,
): Customer => {
  return {
    id: customer.id,
    email: customer.email ?? '',
    name: customer.name ?? '',
    phone: customer.phone ?? null,
    metadata: omitInternalMetadata(customer.metadata ?? {}),
    created_at: new Date(customer.created * 1000),
    updated_at: null,
    custom_fields: {
      default_payment_method:
        typeof customer.invoice_settings?.default_payment_method ===
        'string'
          ? customer.invoice_settings.default_payment_method
          : (customer.invoice_settings?.default_payment_method?.id ??
            null),
      balance: customer.balance,
      currency: customer.currency ?? null,
      delinquent: customer.delinquent ?? false,
    },
  };
};

/**
 * @internal
 */
export const Subscription$inboundSchema = (
  subscription: Stripe.Subscription,
): Subscription => {
  const subscriptionStatusMap: Record<
    Stripe.Subscription.Status,
    Subscription['status']
  > = {
    active: 'active',
    trialing: 'trialing',
    incomplete_expired: 'expired',
    incomplete: 'past_due',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    paused: 'past_due',
  };

  const status =
    subscriptionStatusMap[subscription.status] ?? 'pending';

  const metadata = omitInternalMetadata(subscription.metadata ?? {});

  return {
    id: subscription.id,
    status,
    customer:
      typeof subscription.customer === 'string'
        ? { id: subscription.customer }
        : subscription.customer?.id
          ? { id: subscription.customer.id }
          : null,
    amount: subscription.items.data[0].price.unit_amount!,
    currency: subscription.items.data[0].price.currency!,
    item_id: subscription.items.data[0].id,
    billing_interval: subscription.items.data[0].price.recurring
      ?.interval as SubscriptionBillingInterval,
    current_period_start: new Date(subscription.start_date),
    current_period_end: new Date(subscription.cancel_at!),
    metadata,
    custom_fields: null,
    requires_action: false,
    payment_url: null,
  };
};

/**
 * @internal
 */
type InvoicePayload = Stripe.Invoice & { billingMode: BillingMode };

/**
 * @internal
 */
export const Invoice$inboundSchema = (
  invoice: InvoicePayload,
): Invoice => {
  const status = ((): InvoiceStatus => {
    if (invoice.status == 'paid') return 'paid';
    if (
      ['draft', 'open', 'uncollectible', 'void'].includes(
        invoice.status as string,
      )
    )
      return 'open';
    throw new Error(`Unknown status: ${invoice.status}`);
  })();

  const customerId = (() => {
    if (typeof invoice.customer === 'string') return invoice.customer;
    if (invoice.customer?.id) return invoice.customer.id;
    throw new Error(
      `Unknown customer ID: ${String(invoice.customer)}`,
    );
  })();

  return {
    id: invoice.id!,
    currency: invoice.currency,
    customer: { id: customerId },
    billing_mode: invoice.billingMode,
    amount_paid: invoice.amount_paid,
    line_items: invoice.lines.data.map(line => ({
      id: line.id!,
      quantity: line.quantity!,
    })),
    subscription_id:
      invoice.parent?.subscription_details?.subscription?.toString() ??
      null,
    status,
    paid_at: new Date(invoice.created * 1000).toISOString(),
    metadata: omitInternalMetadata(invoice.metadata ?? {}),
    custom_fields:
      invoice.custom_fields?.reduce(
        (acc, field) => {
          acc[field.name] = field.value;
          return acc;
        },
        {} as Record<string, unknown>,
      ) ?? null,
  };
};

/**
 * @internal
 */
export const Payment$inboundSchema = (
  intent: Stripe.PaymentIntent,
): Payment => {
  const itemId = JSON.parse(
    intent.metadata?.[PAYKIT_METADATA_KEY] ?? '{}',
  ).itemId;

  const statusMap: Record<
    Stripe.PaymentIntent.Status,
    PaymentStatus
  > = {
    requires_payment_method: 'pending',
    requires_confirmation: 'pending',
    requires_action: 'requires_action',
    requires_capture: 'requires_capture',
    succeeded: 'succeeded',
    canceled: 'canceled',
    processing: 'processing',
  };

  const status = statusMap[intent.status];

  const requiresAction =
    intent.status === 'requires_action' ||
    intent.status === 'requires_confirmation';

  return {
    id: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    customer: intent.customer
      ? { id: intent.customer as string }
      : null,
    status,
    metadata: omitInternalMetadata(intent.metadata ?? {}),
    item_id: itemId,
    requires_action: requiresAction,
    payment_url: intent.next_action?.redirect_to_url?.url ?? null,
  };
};

/**
 * @internal
 */
export const Refund$inboundSchema = (
  refund: Stripe.Refund,
): Refund => {
  return {
    id: refund.id,
    amount: refund.amount,
    currency: refund.currency,
    reason: refund.reason,
    metadata: omitInternalMetadata(refund.metadata ?? {}),
  };
};
