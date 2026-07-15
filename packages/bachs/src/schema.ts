/**
 * Raw types for the Bachs API, sourced directly from Bachs' official
 * OpenAPI spec (https://docs.bachs.io/docs/openapi/openapi.json).
 *
 * Bachs has no direct "create payment" endpoint - every payment
 * originates from a checkout session (POST /v1/checkout-sessions).
 * The checkout session IS the resource; the "charge" it produces is a
 * nested sub-resource that only exists once the customer completes
 * payment (`checkout.charge` is `null` until then).
 */

export type BachsChargeStatus =
  | 'created'
  | 'processing'
  | 'succeeded'
  | 'accepted'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded'
  | 'underpaid'
  | 'overpaid';

export type BachsCheckoutStatus =
  | 'OPEN'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED';

export type BachsSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'paused';

export type BachsRefundStatus = 'processing' | 'success' | 'failed';

export interface BachsProductItemRequest {
  product_id: string;
  quantity?: number;
  /** Custom amount override, only meaningful for CUSTOM-priced products. */
  amount?: string;
}

export interface BachsNewCustomerRequest {
  email: string;
  name: string;
  phone_number?: string | null;
}

export interface BachsExistingCustomerRequest {
  customer_id: string;
}

export interface BachsCreateCheckoutSessionRequest {
  customer: BachsNewCustomerRequest | BachsExistingCustomerRequest;
  /** Mutually exclusive with product_collection_id. */
  product_cart?: BachsProductItemRequest[];
  /** Mutually exclusive with product_cart. */
  product_collection_id?: string;
  success_url: string;
  cancel_url?: string | null;
  billing_currency?: string | null;
  allowed_payment_method_types?: Array<
    'card' | 'crypto' | 'bank_transfer' | 'mobile_money'
  > | null;
  reference?: string | null;
  metadata?: Record<string, unknown> | null;
  expires_in_minutes?: number;
}

export interface BachsCreateCheckoutSessionResponse {
  checkout_id: string;
  checkout_url: string;
  status: BachsCheckoutStatus;
  expires_at: string;
  created_at: string;
}

export interface BachsResolvedProductItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_amount: string;
  currency: string;
  price_type: 'fixed' | 'free' | 'custom';
  minimum_amount?: string | null;
  maximum_amount?: string | null;
  line_total: string;
}

export interface BachsCheckoutCustomer {
  id: string | null;
  email: string;
  name: string | null;
}

export interface BachsCheckoutRecurring {
  interval: 'day' | 'week' | 'month' | 'year';
  interval_count?: number;
}

export interface BachsPaymentProductItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_amount: string;
  currency: string;
  line_total: string;
}

export interface BachsPaymentInvoiceInfo {
  invoice_id: string;
  number?: string | null;
  subscription_id?: string | null;
  period_start?: string;
  period_end?: string;
  kind?: 'cycle' | 'proration';
}

/** The charge produced once a checkout session's payment is attempted. */
export interface BachsPaymentResponse {
  payment_id: string;
  reference?: string | null;
  billing_reason?:
    | 'purchase'
    | 'subscription_create'
    | 'subscription_cycle'
    | 'subscription_update';
  checkout_id?: string | null;
  status: BachsChargeStatus;
  is_refundable?: boolean | null;
  amount: string;
  amount_paid?: string | null;
  amount_remaining?: string | null;
  currency: string;
  narration?: string | null;
  meta?: Record<string, unknown> | null;
  customer?: { name: string | null; email: string | null } | null;
  line_items?: BachsPaymentProductItem[] | null;
  subscription_id?: string | null;
  invoice?: BachsPaymentInvoiceInfo | null;
  refunds?: string[] | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

/** GET /v1/checkout-sessions/{checkout_id} */
export interface BachsCheckoutSessionApiResponse {
  checkout_id: string;
  status: BachsCheckoutStatus;
  recurring?: BachsCheckoutRecurring | null;
  payment_status?:
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'succeeded'
    | 'failed'
    | 'canceled'
    | null;
  source_type?: 'API' | 'CHECKOUT_SESSION' | 'PAYMENT_LINK' | null;
  amount: string;
  currency: string;
  reference?: string | null;
  charge?: BachsPaymentResponse | null;
  payment_method?: string | null;
  customer: BachsCheckoutCustomer;
  success_url?: string | null;
  cancel_url?: string | null;
  products?: BachsResolvedProductItem[] | null;
  billing_currency?: string | null;
  session_mode?: 'CART' | 'SELECTION' | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  expires_at?: string | null;
  completed_at?: string | null;
  updated_at: string;
}

export interface BachsCreateCustomerRequest {
  email: string;
  name?: string | null;
  phone_number?: string | null;
  metadata?: Record<string, unknown>;
}

export interface BachsUpdateCustomerRequest {
  email?: string | null;
  name?: string | null;
  phone_number?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface BachsCustomerDetailResponse {
  customer_id: string;
  email: string;
  name?: string | null;
  phone_number?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BachsSubscriptionCadence {
  interval: 'day' | 'week' | 'month' | 'year';
  frequency: number;
}

export interface BachsSubscriptionCatalogProduct {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
  billing_cycle?: BachsSubscriptionCadence | null;
}

export interface BachsSubscriptionItem {
  id: string;
  status?: string;
  quantity: number;
  unit_amount: string;
  currency: string;
  product?: BachsSubscriptionCatalogProduct | null;
}

export interface BachsSubscriptionResponse {
  id: string;
  customer: {
    customer_id: string;
    email: string | null;
    name?: string | null;
  };
  payment_method_id?: string | null;
  status: BachsSubscriptionStatus;
  collection_method?: string;
  currency: string;
  amount: string;
  billing_cycle: BachsSubscriptionCadence;
  quantity: number;
  current_period_start: string;
  current_period_end: string;
  trial_end?: string | null;
  cancel_at_period_end: boolean;
  canceled_at?: string | null;
  created_at: string;
  product?: BachsSubscriptionCatalogProduct | null;
  items: BachsSubscriptionItem[];
}

export interface BachsUpdateSubscriptionRequest {
  product_id?: string;
  trial_end?: string;
  payment_method_id?: string;
  proration_behavior?: 'invoice_now' | 'next_cycle' | 'none';
}

export interface BachsCancelSubscriptionRequest {
  cancel_at_period_end?: boolean;
  reason?: string | null;
}

export interface BachsCreateRefundRequest {
  charge_id: string;
  reference: string;
  amount?: string | null;
  fee_bearer?: 'org' | 'customer' | null;
  reason?: string | null;
  idempotency_key?: string | null;
  refund_address?: string | null;
}

export interface BachsRefundResponse {
  refund_id: string;
  charge_id: string;
  reference: string;
  status: BachsRefundStatus;
  requested_amount: string;
  refunded_amount?: string | null;
  refund_fee_amount?: string;
  fee_bearer?: 'org' | 'customer';
  reason?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface BachsErrorResponse {
  detail: string;
  error_code: string;
  doc_url?: string;
  errors?: Array<{ field: string; message: string; type: string }>;
}

export interface BachsWebhookEnvelope<T = Record<string, unknown>> {
  id: string;
  type: string;
  created_at: string;
  organization_id: string;
  data: T;
}

export interface BachsRawEvents extends Record<string, any> {
  'bachs.collection.succeeded': Record<string, unknown>;
  'bachs.collection.failed': Record<string, unknown>;
  'bachs.collection.abandoned': Record<string, unknown>;
  'bachs.collection.underpaid': Record<string, unknown>;
  'bachs.refund.created': Record<string, unknown>;
  'bachs.refund.paid': Record<string, unknown>;
  'bachs.refund.failed': Record<string, unknown>;
  'bachs.customer.created': Record<string, unknown>;
  'bachs.customer.updated': Record<string, unknown>;
  'bachs.customer.subscription.created': Record<string, unknown>;
  'bachs.customer.subscription.updated': Record<string, unknown>;
  'bachs.customer.subscription.deleted': Record<string, unknown>;
}
