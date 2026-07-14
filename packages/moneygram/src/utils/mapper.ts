import {
  Checkout,
  omitInternalMetadata,
  PAYKIT_METADATA_KEY,
  Payee,
  Payment,
  Refund,
} from '@paykit-sdk/core';
import { MoneyGramTransactionStatus } from '../schema';

/**
 * Normalized shape both `createPayment` (combining the Update + Commit
 * responses) and `retrievePayment` (the Status API response) build before
 * handing off to `Payment$inboundSchema` - MoneyGram doesn't return the
 * same fields from every endpoint, so the provider is responsible for
 * assembling this from whichever response it has.
 */
export interface MoneyGramPaymentSnapshot {
  transactionId: string;
  /**
   * Absent right after a fresh `commit` call - the commit response
   * doesn't echo `transactionStatus` back, but a successful commit always
   * means the transaction was accepted and funded (the "SENT" status).
   */
  transactionStatus?: MoneyGramTransactionStatus;
  amount: number;
  currency: string;
  customer: Payee | null;
  /**
   * MoneyGram's `additionalDetails` dynamic key/value map, echoed back on
   * the Update and Status responses. `PAYKIT_METADATA_KEY` stores
   * `{ item, qty }` for round-tripping `item_id` (and, for checkouts,
   * `products[].quantity`), same convention as the `additional_params`
   * used by GoPay/Comgate.
   */
  additionalDetails?: Record<string, string>;
  requiresAction?: boolean;
}

/**
 * MoneyGram statuses mapped onto PayKit's `Payment.status`.
 *
 * SENT means the transfer was committed, funded, and accepted by
 * MoneyGram - from the sender's point of view the payment has succeeded;
 * everything after that (AVAILABLE / IN_TRANSIT / RECEIVED / DELIVERED) is
 * the payout side completing, not the payment. Those later transitions
 * still surface as `payment.updated` webhook events (see
 * moneygram-provider.ts) so callers can track delivery, but the resource
 * itself stays "succeeded".
 *
 * @see https://developer.moneygram.com/moneygram-developer/docs/transaction-event
 */
export const moneyGramStatusMap: Record<
  MoneyGramTransactionStatus,
  Payment['status']
> = {
  UNFUNDED: 'requires_action',
  SENT: 'succeeded',
  AVAILABLE: 'succeeded',
  IN_TRANSIT: 'succeeded',
  RECEIVED: 'succeeded',
  DELIVERED: 'succeeded',
  PROCESSING: 'processing',
  REJECTED: 'failed',
  REFUNDED: 'canceled',
  CLOSED: 'canceled',
};

/**
 * @internal
 */
export const Payment$inboundSchema = (
  data: MoneyGramPaymentSnapshot,
): Payment => {
  const { item } = JSON.parse(
    data.additionalDetails?.[PAYKIT_METADATA_KEY] ?? '{}',
  );

  const metadata = omitInternalMetadata(data.additionalDetails ?? {});

  const status = data.transactionStatus
    ? moneyGramStatusMap[data.transactionStatus]
    : moneyGramStatusMap.SENT;

  return {
    id: data.transactionId,
    amount: data.amount,
    currency: data.currency,
    customer: data.customer,
    status,
    item_id: item ?? null,
    metadata,
    requires_action:
      data.requiresAction ?? status === 'requires_action',
    payment_url: null,
  };
};

/**
 * @internal
 * MoneyGram has no hosted checkout page - `createCheckout` runs the same
 * Quote -> Update -> Commit flow as `createPayment` (see
 * `MoneyGramProvider.runTransferFlow`), so this shares
 * `MoneyGramPaymentSnapshot` and just adds the checkout-shaped fields.
 * `session_type` is always "one_time" - MoneyGram transfers are never
 * recurring, and `createCheckoutSchema` rejects anything else.
 */
export const Checkout$inboundSchema = (
  data: MoneyGramPaymentSnapshot & { receiptUrl: string | null },
): Checkout => {
  const { item, qty } = JSON.parse(
    data.additionalDetails?.[PAYKIT_METADATA_KEY] ?? '{}',
  );

  const metadata = omitInternalMetadata(data.additionalDetails ?? {});

  return {
    id: data.transactionId,
    customer: data.customer,
    payment_url: data.receiptUrl ?? '',
    metadata,
    session_type: 'one_time',
    products: [{ id: item ?? '', quantity: Number(qty ?? 1) }],
    currency: data.currency,
    amount: data.amount,
  };
};

/**
 * @internal
 */
export const Refund$inboundSchema = (data: {
  refundId: string;
  amount: number;
  currency: string;
  reason: string | null;
  metadata?: Record<string, string>;
}): Refund => ({
  id: data.refundId,
  amount: data.amount,
  currency: data.currency,
  reason: data.reason,
  metadata: data.metadata ?? {},
});
