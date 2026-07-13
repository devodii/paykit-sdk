/**
 * Chapa wraps every response in this envelope, e.g.
 * `{ message: "Refund verified successfully", status: "success", data: {...} }`
 */
export interface ChapaResponse<T = unknown> {
  /**
   * A human readable message describing the result
   */
  message: string;

  /**
   * Whether the request was successful
   */
  status: 'success' | 'failed';

  /**
   * The data of the response
   */
  data: T;
}

export interface ChapaCustomization {
  /**
   * The title shown on the Chapa checkout page
   */
  title: string | null;
  /**
   * The description shown on the Chapa checkout page
   */
  description: string | null;
  /**
   * A logo shown on the Chapa checkout page
   */
  logo?: string | null;
}

/**
 * The shape returned by `GET /transaction/verify/:tx_ref`, and the shape
 * of the `charge.*` webhook payload (minus the `event` key).
 */
export interface ChapaTransaction {
  /**
   * The customer's first name
   */
  first_name: string | null;
  /**
   * The customer's last name
   */
  last_name: string | null;
  /**
   * The customer's email
   */
  email: string | null;
  /**
   * The customer's mobile number
   */
  mobile: string | null;
  /**
   * The currency of the transaction e.g `ETB`
   */
  currency: string;
  /**
   * The amount of the transaction, as a decimal string e.g `"400.00"`
   */
  amount: string;
  /**
   * The fee charged by Chapa, as a decimal string
   */
  charge: string;
  /**
   * The status of the transaction
   */
  status: 'success' | 'failed' | 'pending' | string;
  /**
   * Whether the transaction happened in `test` or `live` mode
   */
  mode: 'test' | 'live';
  /**
   * Chapa's internal reference for the transaction
   */
  reference: string;
  /**
   * The created at timestamp of the transaction
   */
  created_at: string;
  /**
   * The updated at timestamp of the transaction
   */
  updated_at: string;
  /**
   * The channel the transaction was initiated through e.g `API`
   */
  type: string;
  /**
   * The merchant-supplied transaction reference
   */
  tx_ref: string;
  /**
   * The payment channel used e.g `telebirr`, `mpesa`, `card`
   */
  payment_method: string | null;
  /**
   * The checkout customization used for the transaction
   */
  customization: ChapaCustomization | null;
  /**
   * Free-form metadata echoed back from what was sent at initialization
   */
  meta: Record<string, unknown> | null;
}

export interface ChapaInitializeResponse {
  /**
   * The URL to redirect the customer to in order to complete payment
   */
  checkout_url: string;
}

/**
 * The shape returned by `GET /refund/:ref_id/verify`. The create-refund
 * response is assumed to follow the same envelope/shape; fields that
 * aren't confirmed there are backfilled from request-time context in
 * the mapper rather than assumed present.
 */
export interface ChapaRefund {
  /**
   * The refunded amount
   */
  amount: number;
  /**
   * The currency of the refund
   */
  currency: string;
  /**
   * Chapa's internal reference for the refund
   */
  ref_id: string;
  /**
   * The reference of the original payment being refunded
   */
  payment_reference: string;
  /**
   * An optional merchant-supplied reference for the refund
   */
  merchant_reference: string | null;
  /**
   * The status of the refund
   */
  status:
    | 'initiated'
    | 'processing'
    | 'refunded'
    | 'reversed'
    | string;
  /**
   * The created at timestamp of the refund
   */
  created_at: string;
  /**
   * The updated at timestamp of the refund
   */
  updated_at: string;
}

export interface ChapaWebhookTransactionEvent
  extends ChapaTransaction {
  /**
   * e.g `charge.success`. Chapa's docs also show `charge.refunded`,
   * `charge.reversed` and `charge.failed/cancelled`, but only
   * `charge.success` is unambiguously documented as a literal value -
   * the others are handled defensively off the `status` field instead
   * of an exact string match.
   */
  event: string;
}

export interface ChapaWebhookPayoutEvent {
  /**
   * e.g `payout.success`
   */
  event: string;
  type: 'Payout';
  account_name: string;
  account_number: string;
  bank_id: number;
  bank_name: string;
  amount: string;
  charge: string;
  currency: string;
  status: string;
  reference: string;
  chapa_reference: string;
  bank_reference: string;
  created_at: string;
  updated_at: string;
}

export type ChapaWebhookEvent =
  | ChapaWebhookTransactionEvent
  | ChapaWebhookPayoutEvent;

export const isChapaTransactionEvent = (
  event: ChapaWebhookEvent,
): event is ChapaWebhookTransactionEvent =>
  event.event.startsWith('charge.');

export type ChapaRawEvents = {
  'chapa.charge.success': ChapaWebhookTransactionEvent;
  'chapa.charge.failure': ChapaWebhookTransactionEvent;
  'chapa.charge.refunded': ChapaWebhookTransactionEvent;
  'chapa.charge.reversed': ChapaWebhookTransactionEvent;
  'chapa.payout.success': ChapaWebhookPayoutEvent;
  'chapa.payout.failure': ChapaWebhookPayoutEvent;
};
