import {
  Customer,
  Checkout,
  Payment,
  Subscription,
  parseCustomerName,
  Payee,
  Refund,
} from '@paykit-sdk/core';
import {
  LemonSqueezyCustomer,
  LemonSqueezyCheckout,
  LemonSqueezyOrder,
  LemonSqueezySubscription,
} from '../schema';

export const Customer$inboundSchema = (
  data: LemonSqueezyCustomer,
): Customer => {
  const attrs = data.attributes;
  const { fullName } = parseCustomerName({
    name: attrs.name,
    email: attrs.email,
  });

  return {
    id: data.id,
    email: attrs.email,
    name: fullName,
    phone: null, // LemonSqueezy doesn't provide phone natively here
    created_at: new Date(attrs.created_at),
    updated_at: attrs.updated_at ? new Date(attrs.updated_at) : null,
    metadata: {},
    custom_fields: {
      store_id: attrs.store_id,
      city: attrs.city,
      region: attrs.region,
      country: attrs.country,
      status: attrs.status,
      test_mode: attrs.test_mode,
    },
  };
};

export const Checkout$inboundSchema = (
  data: LemonSqueezyCheckout,
): Checkout => {
  const attrs = data.attributes;
  return {
    id: data.id,
    payment_url: attrs.url,
    session_type: 'one_time',
    products: [{ id: String(attrs.variant_id || ''), quantity: 1 }],
    currency: 'USD',
    amount: attrs.custom_price || 0,
    customer: null,
    metadata: null,
  };
};

export const Payment$inboundSchema = (
  data: LemonSqueezyOrder,
): Payment => {
  const attrs = data.attributes;

  let status: Payment['status'] = 'pending';
  if (attrs.status === 'paid') status = 'succeeded';
  if (attrs.refunded) status = 'refunded' as Payment['status']; // Core might not have refunded, mapped to succeeded + refund logic

  const customer: Payee | null = attrs.user_email
    ? { email: attrs.user_email }
    : attrs.customer_id
      ? { id: String(attrs.customer_id) }
      : null;

  return {
    id: data.id,
    amount: attrs.total,
    currency: attrs.currency,
    customer,
    status,
    item_id: String(attrs.first_order_item?.id || ''),
    requires_action: false,
    payment_url: attrs.urls?.receipt || null,
    metadata: {},
  };
};

export const Subscription$inboundSchema = (
  data: LemonSqueezySubscription,
): Subscription => {
  const attrs = data.attributes;

  let status: Subscription['status'] = 'active';
  if (attrs.status === 'past_due') status = 'past_due';
  if (attrs.status === 'unpaid') status = 'past_due';
  if (attrs.status === 'cancelled') status = 'canceled';
  if (attrs.status === 'expired') status = 'canceled';

  const customer: Payee | null = attrs.user_email
    ? { email: attrs.user_email }
    : attrs.customer_id
      ? { id: String(attrs.customer_id) }
      : null;

  return {
    id: data.id,
    customer,
    status,
    item_id: String(attrs.variant_id),
    amount: 0,
    currency: 'USD',
    billing_interval: 'month', // LemonSqueezy handles this via variant, assume month if unknown
    current_period_start: new Date(attrs.created_at),
    current_period_end: new Date(
      attrs.renews_at || attrs.ends_at || attrs.updated_at,
    ),
    metadata: null,
    custom_fields: null,
    requires_action: false,
    payment_url: attrs.urls?.update_payment_method || null,
  };
};

export const Refund$inboundSchema = (
  data: LemonSqueezyOrder,
): Refund => {
  const attrs = data.attributes;
  return {
    id: `ref_${data.id}`,
    amount: attrs.refunded_amount || 0,
    currency: attrs.currency,
    reason: null, // LemonSqueezy doesn't expose reason on the order object payload natively
    metadata: null,
  };
};
