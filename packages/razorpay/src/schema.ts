/**
 * Razorpay's error envelope, returned on any non-2xx response, e.g.
 * `{ error: { code: "BAD_REQUEST_ERROR", description: "...", ... } }`
 */
export interface RazorpayErrorResponse {
  error: {
    code: string;
    description: string;
    field: string | null;
    source: string | null;
    step: string | null;
    reason: string | null;
    metadata: Record<string, unknown> | null;
  };
}

/**
 * The shape returned by `POST /orders` and `GET /orders/:id`.
 */
export interface RazorpayOrder {
  id: string;
  entity: 'order';
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  offer_id: string | null;
  status: 'created' | 'attempted' | 'paid';
  attempts: number;
  notes: Record<string, string> | null;
  created_at: number;
}

/**
 * The shape returned by `GET /payments/:id` and `POST /payments/:id/capture`,
 * and embedded as `payload.payment.entity` in webhook events.
 */
export interface RazorpayPayment {
  id: string;
  entity: 'payment';
  amount: number;
  currency: string;
  status:
    | 'created'
    | 'authorized'
    | 'captured'
    | 'refunded'
    | 'failed';
  order_id: string | null;
  invoice_id: string | null;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status: 'null' | 'partial' | 'full' | null;
  captured: boolean;
  description: string | null;
  card_id: string | null;
  bank: string | null;
  wallet: string | null;
  vpa: string | null;
  email: string;
  contact: string | null;
  notes: Record<string, string> | null;
  fee: number | null;
  tax: number | null;
  error_code: string | null;
  error_description: string | null;
  error_source: string | null;
  error_step: string | null;
  error_reason: string | null;
  acquirer_data: Record<string, unknown> | null;
  created_at: number;
}

/**
 * The shape returned by `POST /payments/:id/refund`.
 */
export interface RazorpayRefund {
  id: string;
  entity: 'refund';
  amount: number;
  receipt: string | null;
  currency: string;
  payment_id: string;
  notes: Record<string, string> | null;
  acquirer_data: { arn: string | null } | null;
  created_at: number;
  batch_id: string | null;
  status: 'pending' | 'processed' | 'failed';
  speed_processed: 'normal' | 'optimum' | 'instant' | null;
  speed_requested: 'normal' | 'optimum' | 'instant' | null;
}

export interface RazorpayPaymentLinkCustomer {
  name?: string;
  contact?: string;
  email?: string;
}

export interface RazorpayPaymentLinkPaymentEntry {
  amount: number;
  created_at: number;
  method: string;
  payment_id: string;
  status: string;
}

/**
 * The shape returned by `POST /payment_links/` and `GET /payment_links/:id`.
 * `payments` and `order_id` are only populated once the link has been paid.
 */
export interface RazorpayPaymentLink {
  id: string;
  entity: 'payment_link';
  amount: number;
  currency: string;
  accept_partial: boolean;
  first_min_partial_amount?: number;
  description: string | null;
  reference_id: string | null;
  customer: RazorpayPaymentLinkCustomer | null;
  notify: { sms?: boolean; email?: boolean };
  reminder_enable: boolean;
  notes: Record<string, string> | null;
  status:
    | 'created'
    | 'paid'
    | 'cancelled'
    | 'expired'
    | 'partially_paid';
  short_url: string;
  order_id: string | null;
  expire_by: number | null;
  callback_url: string | null;
  callback_method: string | null;
  payments: RazorpayPaymentLinkPaymentEntry[] | null;
  created_at: number;
}

/**
 * The shape returned by `POST /customers` and `PUT /customers/:id`.
 * There is no delete-customer endpoint on Razorpay's Customers API.
 */
export interface RazorpayCustomer {
  id: string;
  entity: 'customer';
  name: string;
  email: string;
  contact: string | null;
  gstin: string | null;
  notes: Record<string, string> | null;
  created_at: number;
}

/**
 * The shape returned by `POST /plans`.
 */
export interface RazorpayPlan {
  id: string;
  entity: 'plan';
  interval: number;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  item: {
    id: string;
    active: boolean;
    name: string;
    description: string | null;
    amount: number;
    unit_amount: number;
    currency: string;
    type: string;
    unit: string | null;
    tax_inclusive: boolean;
    created_at: number;
    updated_at: number;
  };
  notes: Record<string, string> | null;
  created_at: number;
}

/**
 * The shape returned by `POST /subscriptions`. `customer_id`/`customer_email`
 * stay null until the customer completes authorization via `short_url` -
 * a customer can't be attached at creation time, analogous to Payment Links.
 */
export interface RazorpaySubscription {
  id: string;
  entity: 'subscription';
  plan_id: string;
  customer_id: string | null;
  offer_id?: string | null;
  status:
    | 'created'
    | 'authenticated'
    | 'active'
    | 'pending'
    | 'halted'
    | 'cancelled'
    | 'completed'
    | 'expired'
    | 'paused';
  current_start: number | null;
  current_end: number | null;
  ended_at: number | null;
  quantity: number;
  notes: Record<string, string> | null;
  charge_at: number | null;
  start_at: number | null;
  end_at: number | null;
  auth_attempts: number;
  total_count: number;
  paid_count: number;
  customer_notify: boolean;
  created_at: number;
  expire_by: number | null;
  short_url: string;
  has_scheduled_changes: boolean;
  change_scheduled_at: number | null;
  source: string;
  remaining_count: number;
}

export type RazorpayRawEvents = {
  'razorpay.payment.authorized': RazorpayWebhookEvent;
  'razorpay.payment.captured': RazorpayWebhookEvent;
  'razorpay.payment.failed': RazorpayWebhookEvent;
  'razorpay.order.paid': RazorpayWebhookEvent;
  'razorpay.refund.created': RazorpayWebhookEvent;
  'razorpay.refund.processed': RazorpayWebhookEvent;
  'razorpay.payment_link.paid': RazorpayWebhookEvent;
  'razorpay.payment_link.cancelled': RazorpayWebhookEvent;
  'razorpay.payment_link.expired': RazorpayWebhookEvent;
  'razorpay.subscription.authenticated': RazorpayWebhookEvent;
  'razorpay.subscription.activated': RazorpayWebhookEvent;
  'razorpay.subscription.charged': RazorpayWebhookEvent;
  'razorpay.subscription.completed': RazorpayWebhookEvent;
  'razorpay.subscription.updated': RazorpayWebhookEvent;
  'razorpay.subscription.pending': RazorpayWebhookEvent;
  'razorpay.subscription.halted': RazorpayWebhookEvent;
  'razorpay.subscription.paused': RazorpayWebhookEvent;
  'razorpay.subscription.resumed': RazorpayWebhookEvent;
  'razorpay.subscription.cancelled': RazorpayWebhookEvent;
};

type StripRazorpayPrefix<T> = T extends `razorpay.${infer Rest}`
  ? Rest
  : T;

export type RazorpayEventsClean = StripRazorpayPrefix<
  keyof RazorpayRawEvents
>;

export interface RazorpayWebhookEvent {
  entity: 'event';
  /**
   * The ID of the Razorpay account that the webhook is for.
   */
  account_id: string;
  /**
   * The webhook event name.
   */
  event: RazorpayEventsClean;
  /**
   * The resources that the webhook contains.
   */
  contains: string[];
  /**
   * The payload of the webhook.
   */
  payload: {
    /**
     * The payment resource that the webhook contains.
     */
    payment?: { entity: RazorpayPayment };
    /**
     * The order resource that the webhook contains.
     */
    order?: { entity: RazorpayOrder };
    /**
     * The refund resource that the webhook contains.
     */
    refund?: { entity: RazorpayRefund };
    /**
     * The payment link resource that the webhook contains.
     */
    payment_link?: { entity: RazorpayPaymentLink };
    /**
     * The subscription resource that the webhook contains.
     */
    subscription?: { entity: RazorpaySubscription };
  };
  created_at: number;
}
