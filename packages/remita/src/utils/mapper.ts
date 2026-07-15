import { Payee, Payment, PaykitMetadata } from '@paykit-sdk/core';
import { RemitaStatusResponse } from '../schema';

/** Remita's Invoice Generation API is Naira-only - no currency field appears anywhere in its schema. */
export const REMITA_CURRENCY = 'NGN';

/**
 * Curated from Remita's official "Response Codes- Check Status" table.
 * Remita's own docs state explicitly: "Status code '00' and '01' denote
 * successful transactions". Everything else defaults to pending rather
 * than risk misreporting a transaction that's still in flight as failed.
 */
const SUCCESS_CODES = new Set(['00', '01']);

const FAILURE_CODES = new Set([
  '02', // TRANSACTION_FAILED
  '012', // ABORTED - user aborted transaction
  '013', // INVALID_HASH_VALUE
  '022', // INVALID_REQUEST / INVALID_RRR
  '023', // INVALID_SERVICE_MERCHANT / INVALID_MERCHANT_ORDERID
  '024', // MERCHANT_STATUS_ERROR - inactive merchant
  '026', // UNKNOWN_ORDER
  '029', // INVALID_BANKCODE
  '030', // NO_FUND - insufficient funds
  '031', // NO_ACCOUNT - no funding account
  '033', // INVALID_AUTHTOKEN
  '059', // REJECTED
]);

export const remitaStatusToPaymentStatus = (
  code: string,
): Payment['status'] => {
  if (SUCCESS_CODES.has(code)) return 'succeeded';
  if (FAILURE_CODES.has(code)) return 'failed';
  return 'pending';
};

export interface RemitaPendingPaymentInput {
  rrr: string;
  amount: number;
  customer: Payee | null;
  itemId: string | null;
  metadata: PaykitMetadata;
}

/**
 * Builds the Payment returned synchronously from createPayment, right
 * after Remita generates the RRR. This is the only point where
 * item_id, metadata and customer are available - Remita's status API
 * (status.reg/orderstatus.reg) does not echo any of them back, so
 * Payment$fromStatus below cannot recover them.
 */
export const Payment$fromCreate = (
  input: RemitaPendingPaymentInput,
): Payment => ({
  id: input.rrr,
  amount: input.amount,
  currency: REMITA_CURRENCY,
  customer: input.customer,
  status: 'pending',
  item_id: input.itemId,
  metadata: input.metadata,
  requires_action: true,
  payment_url: null,
});

/**
 * Builds a Payment from Remita's status.reg / orderstatus.reg
 * response. Per Remita's documented response shape, this endpoint
 * returns only { amount, RRR, orderId, message, transactiontime,
 * status, paymentDate? } - no payer email, item_id, or metadata are
 * echoed back, so those fields are always null/empty here regardless
 * of what was passed to createPayment.
 */
export const Payment$fromStatus = (
  data: RemitaStatusResponse,
): Payment => {
  const status = remitaStatusToPaymentStatus(data.status);

  return {
    id: data.RRR,
    amount: data.amount,
    currency: REMITA_CURRENCY,
    customer: null,
    status,
    item_id: null,
    metadata: {},
    requires_action: status === 'pending',
    payment_url: null,
  };
};
