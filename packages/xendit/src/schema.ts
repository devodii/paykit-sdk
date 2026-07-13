/**
 * Xendit's error envelope, returned on any non-2xx response, e.g.
 * `{ error_code: "INVALID_REQUEST", message: "..." }`
 */
export interface XenditErrorResponse {
  error_code: string;
  message: string;
}

export interface XenditInvoiceItem {
  name: string;
  quantity: number;
  price: number;
  category?: string;
}

export interface XenditInvoiceCustomer {
  given_names?: string;
  surname?: string;
  email?: string;
  mobile_number?: string;
}

/**
 * The shape returned by `POST /v2/invoices/` and `GET /v2/invoices/:id`
 * (Xendit's hosted checkout page).
 */
export interface XenditInvoice {
  id: string;
  external_id: string;
  user_id: string;
  status: 'PENDING' | 'PAID' | 'SETTLED' | 'EXPIRED';
  merchant_name?: string;
  amount: number;
  payer_email?: string;
  description?: string;
  paid_amount?: number;
  created: string;
  updated: string;
  currency: string;
  expiry_date: string;
  invoice_url: string;
  paid_at?: string;
  payment_method?: string;
  payment_channel?: string;
  payment_id?: string;
  success_redirect_url?: string;
  failure_redirect_url?: string;
  items?: XenditInvoiceItem[];
  customer?: XenditInvoiceCustomer;
  metadata?: Record<string, unknown> | null;
  recurring_payment_id?: string;
}

/**
 * The shape returned by `POST /customers`, `GET /customers/:id`, and
 * `PATCH /customers/:id`.
 */
export interface XenditCustomer {
  id: string;
  reference_id: string;
  type?: 'INDIVIDUAL' | 'BUSINESS';
  individual_detail?: {
    given_names?: string;
    surname?: string | null;
  } | null;
  email: string | null;
  mobile_number: string | null;
  phone_number?: string | null;
  description?: string | null;
  metadata: Record<string, unknown> | null;
  created: string;
  updated: string;
}

/**
 * Interval unit accepted by the Recurring Plans API - `YEAR` is not
 * supported natively and is translated to `MONTH` with `interval_count: 12`.
 */
export type XenditRecurringInterval = 'DAY' | 'WEEK' | 'MONTH';

export interface XenditRecurringSchedule {
  interval: XenditRecurringInterval;
  interval_count: number;
  total_recurrence?: number | null;
  anchor_date?: string;
  retry_interval?: string;
  retry_interval_count?: number;
  total_retry?: number;
  created?: string;
  updated?: string;
}

export interface XenditPaymentToken {
  payment_token_id: string;
  rank: number;
}

/**
 * The shape returned by `POST /recurring/plans`, `GET /recurring/plans/:id`,
 * and `POST /recurring/plans/:id/deactivate`.
 */
export interface XenditRecurringPlan {
  id: string;
  reference_id: string;
  customer_id: string;
  currency: string;
  amount: number;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'REQUIRES_ACTION';
  country?: string;
  recurring_cycle_count?: number;
  schedule: XenditRecurringSchedule;
  payment_tokens: XenditPaymentToken[];
  immediate_payment?: boolean;
  failed_cycle_action?: 'RESUME' | 'STOP';
  metadata?: Record<string, unknown> | null;
  description?: string | null;
  created: string;
  updated: string;
  actions?: Array<{
    action: string;
    url_type: string;
    url: string;
    method: string;
  }>;
}

/**
 * The shape returned by `POST /refunds` and `GET /refunds/:id`.
 */
export interface XenditRefund {
  id: string;
  payment_id?: string;
  payment_request_id?: string;
  invoice_id?: string;
  amount: number;
  currency: string;
  channel_code?: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  reason?: string;
  reference_id?: string | null;
  failure_code?: string | null;
  metadata?: Record<string, unknown> | null;
  created: string;
  updated: string;
}

/**
 * The Invoice Callback body is the invoice resource itself, sent
 * unwrapped at the top level - there is no separate `event`/`data`
 * envelope for invoice webhooks (unlike Recurring webhooks below).
 */
export type XenditInvoiceCallback = XenditInvoice;

/**
 * Recurring webhooks (unlike invoice callbacks) use a wrapping
 * `{ event, business_id, created, data }` envelope, reflecting a newer
 * generation of Xendit's API.
 */
export interface XenditRecurringCycle {
  id: string;
  reference_id?: string;
  plan_id?: string;
  customer_id?: string;
  cycle_number?: number;
  attempt_count?: number;
  status: 'SCHEDULED' | 'SUCCEEDED' | 'RETRYING' | 'FAILED';
  scheduled_timestamp?: string;
  currency: string;
  amount: number;
  created?: string;
  updated?: string;
  metadata?: Record<string, unknown> | null;
}

export interface XenditRecurringPlanWebhookEvent {
  event: 'recurring.plan.activated' | 'recurring.plan.inactivated';
  business_id: string;
  created: string;
  data: XenditRecurringPlan;
}

export interface XenditRecurringCycleWebhookEvent {
  event:
    | 'recurring.cycle.created'
    | 'recurring.cycle.succeeded'
    | 'recurring.cycle.retrying'
    | 'recurring.cycle.failed';
  business_id: string;
  created: string;
  data: XenditRecurringCycle;
}

export type XenditRecurringWebhookEvent =
  | XenditRecurringPlanWebhookEvent
  | XenditRecurringCycleWebhookEvent;

export type XenditWebhookEvent =
  | XenditInvoiceCallback
  | XenditRecurringWebhookEvent;

export const isXenditRecurringWebhookEvent = (
  event: XenditWebhookEvent,
): event is XenditRecurringWebhookEvent =>
  typeof (event as XenditRecurringWebhookEvent).event === 'string' &&
  (event as XenditRecurringWebhookEvent).event.startsWith(
    'recurring.',
  );

export type XenditRawEvents = {
  'xendit.invoice.pending': XenditInvoiceCallback;
  'xendit.invoice.paid': XenditInvoiceCallback;
  'xendit.invoice.settled': XenditInvoiceCallback;
  'xendit.invoice.expired': XenditInvoiceCallback;
  'xendit.recurring.plan.activated': XenditRecurringPlanWebhookEvent;
  'xendit.recurring.plan.inactivated': XenditRecurringPlanWebhookEvent;
  'xendit.recurring.cycle.created': XenditRecurringCycleWebhookEvent;
  'xendit.recurring.cycle.succeeded': XenditRecurringCycleWebhookEvent;
  'xendit.recurring.cycle.retrying': XenditRecurringCycleWebhookEvent;
  'xendit.recurring.cycle.failed': XenditRecurringCycleWebhookEvent;
};
