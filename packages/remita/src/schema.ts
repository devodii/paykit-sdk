/**
 * Raw types for Remita's "Invoice Generation" API (First Generation /
 * legacy Payment Gateway product), as documented in Remita's official
 * Postman collection ("Remita APIs" -> Accept Payments -> Invoice
 * Generation).
 *
 * This is a Remita Retrieval Reference (RRR) based flow:
 *   1. paymentinit  - generate an RRR against a payer/amount
 *   2. status.reg / orderstatus.reg - check whether the RRR has been paid
 *   3. deactivate.json - cancel an unpaid RRR
 *
 * There is no hosted checkout URL in this API - the payer completes
 * payment against the RRR through Remita's own channels (bank
 * transfer, USSD, card, agent) outside of this integration.
 */

export interface RemitaCustomField {
  name: string;
  value: string;
  type: string;
}

export interface RemitaInvoiceRequest {
  serviceTypeId: string;
  amount: string;
  orderId: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  description: string;
  /** Format: DD/MM/YYYY. Optional. */
  expiryDate?: string;
  /**
   * Custom field names must already be registered against the
   * serviceTypeId on Remita's merchant dashboard before they can be
   * sent here - arbitrary/unregistered names are rejected.
   */
  customFields?: RemitaCustomField[];
}

export interface RemitaInvoiceResponse {
  statuscode: string;
  status: string;
  RRR: string;
}

/**
 * Response shape for both status.reg (by RRR) and orderstatus.reg (by
 * orderId). Notably: no metadata/customFields are echoed back here -
 * Remita's status API does not round-trip anything beyond these
 * fields.
 */
export interface RemitaStatusResponse {
  amount: number;
  RRR: string;
  orderId: string;
  message: string;
  transactiontime: string;
  /** Status code, see Remita's "Response Codes- Check Status" table. */
  status: string;
  paymentDate?: string;
}

export interface RemitaCancelInvoiceRequest {
  rrr: string;
  merchantId: string;
  hash: string;
}

export interface RemitaCancelInvoiceResponse {
  statuscode: string;
  status: string;
}

/**
 * Payload Remita POSTs to the merchant's configured "listening URL"
 * (Administration Menu -> API Keys and Webhooks) when a payment is
 * made against an RRR. The body is a JSON *array* of notifications.
 *
 * There is no signature or hash on this payload - Remita's docs only
 * specify that the merchant must reply with the literal text "Ok" (or
 * "Not Ok" on failure). Treat the URL's secrecy as the only line of
 * defense, and re-verify via the status API before trusting it.
 */
export interface RemitaWebhookNotification {
  rrr: string;
  channel: string | null;
  billerName?: string;
  amount: number;
  transactiondate: string;
  debitdate: string;
  bank?: string;
  branch?: string;
  serviceTypeId: string;
  orderRef: string;
  orderId: string;
  payerName: string;
  payerPhoneNumber: string;
  payerEmail: string;
  type: string;
  customFieldData?: Array<{ DESCRIPTION: string; COLVAL: string }>;
  parentRRRDetails?: Record<string, unknown>;
  chargeFee?: number;
  paymentDescription?: string;
  integratorsEmail?: string;
  integratorsPhonenumber?: string;
}

export interface RemitaRawEvents extends Record<string, any> {
  'remita.notification': RemitaWebhookNotification;
}
