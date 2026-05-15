import {
  Checkout,
  Payment,
  Refund,
  omitInternalMetadata,
  parseJSON,
  StandardWebhookEventType,
  PAYKIT_METADATA_KEY,
  Schema,
} from '@paykit-sdk/core';

export const monnifyToPaykitEventMap: Record<
  string,
  | string
  | null
  | ((eventData: Record<string, unknown>) => StandardWebhookEventType)
> = {
  CUSTOMER_CREATED: null,
  CUSTOMER_UPDATED: null,
  CUSTOMER_DELETED: null,

  // Subscription (Direct Debit Mandates)
  MANDATE_UPDATE: (eventData: Record<string, unknown>) => {
    const status = eventData.mandateStatus;

    if (status === 'ACTIVE' || status === 'PENDING') {
      return 'subscription.created';
    }

    if (status === 'CANCELLED') {
      return 'subscription.canceled';
    }

    return 'subscription.updated'; // catch-all for mandate changes
  },

  SUCCESSFUL_TRANSACTION: 'payment.created',

  REJECTED_PAYMENT: 'payment.updated',

  SETTLEMENT: 'payment.updated',

  SUCCESSFUL_REFUND: 'refund.created',
  FAILED_REFUND: 'refund.created',

  // Disbursements → could map to payout.*, but Paykit does not support payouts yet
  SUCCESSFUL_DISBURSEMENT: null,
  FAILED_DISBURSEMENT: null,
  REVERSED_DISBURSEMENT: null,

  // Offline payments also count as payment.created
  SUCCESSFUL_TRANSACTION_OFFLINE: 'payment.created',
};

/**
 * @internal
 */
export const Checkout$inboundSchema = (
  data: Record<string, any>,
): Checkout => {
  const metadataObj = (data.metaData || {}) as Record<string, unknown>;
  const paykitMetadata = metadataObj[PAYKIT_METADATA_KEY];

  let parsed = null;

  if (typeof paykitMetadata === 'string') {
    parsed = parseJSON(
      paykitMetadata,
      Schema.object({
        item: Schema.string(),
        qty: Schema.number().or(Schema.string()),
      }),
    );
  }

  const metadata = omitInternalMetadata(metadataObj);
  const email = data?.customerEmail || data?.customer?.email;

  return {
    id: data.transactionReference || data.paymentReference || '',
    amount: data.amountPaid || data.amount || 0,
    currency: data.currencyCode || data.currency || 'NGN',
    customer: email ? { email } : null,
    payment_url: data.checkoutUrl || null,
    metadata,
    session_type: 'one_time',
    products: [
      {
        id: parsed?.item ?? '',
        quantity: parseInt(parsed?.qty?.toString() ?? '1'),
      },
    ],
  };
};

/**
 * @internal
 */
export const Payment$inboundSchema = (
  data: Record<string, any>,
): Payment => {
  const metadataObj = (data.metaData || {}) as Record<string, unknown>;
  const paykitMetadata = metadataObj[PAYKIT_METADATA_KEY];

  let parsed = null;

  if (typeof paykitMetadata === 'string') {
    parsed = parseJSON(
      paykitMetadata,
      Schema.object({ item: Schema.string().optional() }),
    );
  }

  const metadata = omitInternalMetadata(metadataObj);

  const statusMap: Record<string, Payment['status']> = {
    PAID: 'succeeded',
    OVERPAID: 'succeeded',
    PARTIALLY_PAID: 'processing',
    PENDING: 'pending',
    FAILED: 'failed',
    CANCELLED: 'canceled',
    REVERSED: 'canceled',
    EXPIRED: 'failed',
  };

  const paymentStatus = data.paymentStatus || data.status || 'PENDING';
  const status = statusMap[paymentStatus] || 'pending';
  const requiresAction = status === 'pending' || status === 'processing';
  const email = data?.customerEmail || data?.customer?.email;

  return {
    id: data.transactionReference || data.paymentReference || '',
    amount: data.amountPaid || data.amount || 0,
    currency: data.currencyCode || data.currency || 'NGN',
    customer: email ? { email } : null,
    status,
    item_id: parsed?.item ?? null,
    metadata,
    requires_action: requiresAction,
    payment_url: null,
  };
};

/**
 * @internal
 */
export const Refund$inboundSchema = (
  data: Record<string, any>,
): Refund => {
  const metadata = omitInternalMetadata(data.metaData ?? {});

  return {
    id:
      data.transactionReference || data.refundReference || crypto.randomUUID(),
    amount: data.amountRefunded || data.amount || 0,
    currency: data.currencyCode || data.currency || 'NGN',
    reason: data.refundReason || data.reason || null,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
};
