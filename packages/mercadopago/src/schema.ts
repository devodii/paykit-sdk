export interface MercadoPagoErrorResponse {
  /**
   * The error message.
   */
  message: string;
  /**
   * The error code.
   */
  error: string;
  /**
   * The HTTP status code.
   */
  status: number;
  /**
   * The cause of the error.
   */
  cause?: Array<{ code: string | number; description: string }>;
}

export interface MercadoPagoItem {
  /**
   * The item ID.
   */
  id: string;
  /**
   * The item title.
   */
  title: string;
  /**
   * The item description.
   */
  description?: string;
  /**
   * The item picture URL.
   */
  picture_url?: string;
  /**
   * The item category ID.
   */
  category_id?: string;
  /**
   * The item quantity.
   */
  quantity: number;
  /**
   * The item currency ID.
   */
  currency_id?: string;
  /**
   * The item unit price.
   */
  unit_price: number;
}

export interface MercadoPagoPayer {
  /**
   * The payer name.
   */
  name?: string;
  /**
   * The payer surname.
   */
  surname?: string;
  /**
   * The payer email.
   */
  email?: string;
  /**
   * The payer phone.
   */
  phone?: { area_code?: string; number?: string };
}

export interface MercadoPagoBackUrls {
  success?: string;
  pending?: string;
  failure?: string;
}

/**
 * The shape returned by `POST /checkout/preferences/` and
 * `GET /checkout/preferences/:id` (Checkout Pro).
 */
export interface MercadoPagoPreference {
  /**
   * The preference ID.
   */
  id: string;
  /**
   * The client ID.
   */
  client_id?: string;
  /**
   * The collector ID.
   */
  collector_id?: number;
  /**
   * The date the preference was created.
   */
  date_created?: string;
  /**
   * The items in the preference.
   */
  items: MercadoPagoItem[];
  /**
   * The payer.
   */
  payer?: MercadoPagoPayer;
  /**
   * The back URLs.
   */
  back_urls?: MercadoPagoBackUrls;
  auto_return?: string;
  /**
   * The external reference.
   */
  external_reference?: string | null;
  /**
   * The notification URL.
   */
  notification_url?: string | null;
  /**
   * The metadata.
   */
  metadata?: Record<string, unknown> | null;
  /** Production Checkout Pro URL. */
  /**
   * The production Checkout Pro URL.
   */
  init_point?: string;
  /**
   * The sandbox Checkout Pro URL.
   */
  sandbox_init_point?: string;
  /**
   * The operation type.
   */
  operation_type?: string;
}

export interface MercadoPagoPaymentMethod {
  /**
   * The payment method ID.
   */
  id?: string;
  /**
   * The payment method type.
   */
  type?: string;
  /**
   * The issuer ID.
   */
  issuer_id?: string;
}

export interface MercadoPagoPaymentPayer {
  /**
   * The payer type.
   */
  type?: string;
  /**
   * The payer ID.
   */
  id?: string;
  /**
   * The payer email.
   */
  email?: string;
  /**
   * The payer first name.
   */
  first_name?: string;
  /**
   * The payer last name.
   */
  last_name?: string;
}

export interface MercadoPagoPayment {
  /**
   * The payment ID.
   */
  id: number;
  /**
   * The date the payment was created.
   */
  date_created?: string;
  /**
   * The date the payment was approved.
   */
  date_approved?: string | null;
  /**
   * The date the payment was last updated.
   */
  date_last_updated?: string;
  /**
   * The date the payment was released.
   */
  money_release_date?: string;
  /**
   * The operation type.
   */
  operation_type?: string;
  /**
   * The payment method ID.
   */
  payment_method_id?: string;
  /**
   * The payment type ID.
   */
  payment_type_id?: string;
  /**
   * The payment method.
   */
  payment_method?: MercadoPagoPaymentMethod;
  /**
   * The status of the payment.
   */
  status: string;
  /**
   * The status detail of the payment.
   */
  status_detail?: string;
  /**
   * The currency ID of the payment.
   */
  currency_id: string;
  /**
   * The description of the payment.
   */
  description?: string | null;
  /**
   * Whether the payment is in live mode.
   */
  live_mode?: boolean;
  /**
   * The external reference of the payment.
   */
  external_reference?: string | null;
  /**
   * The transaction amount of the payment.
   */
  transaction_amount: number;
  /**
   * The transaction amount refunded of the payment.
   */
  transaction_amount_refunded?: number;
  /**
   * The installments of the payment.
   */
  installments?: number;
  /**
   * Whether the payment was captured.
   */
  captured?: boolean;
  /**
   * Whether the payment is in binary mode.
   */
  binary_mode?: boolean;
  /**
   * The notification URL of the payment.
   */
  notification_url?: string | null;
  /**
   * The payer of the payment.
   */
  payer?: MercadoPagoPaymentPayer;
  /**
   * The metadata of the payment.
   */
  metadata?: Record<string, unknown> | null;
  /**
   * The refunds of the payment.
   */
  refunds?: MercadoPagoRefund[];
  /**
   * The order of the payment.
   */
  order?: { id?: number; type?: string };
  /**
   * The point of interaction of the payment.
   */
  point_of_interaction?: {
    /**
     * The type of the point of interaction.
     */
    type?: string;
    /**
     * The transaction data of the point of interaction.
     */
    transaction_data?: {
      /**
       * The subscription ID of the transaction data.
       */
      subscription_id?: string;
    };
  };
}

/**
 * The shape returned by `POST /v1/payments/:id/refunds` and
 * `GET /v1/payments/:id/refunds/:refund_id`.
 */
export interface MercadoPagoRefund {
  /**
   * The refund ID.
   */
  id: number;
  /**
   * The payment ID.
   */
  payment_id: number;
  /**
   * The refund amount.
   */
  amount: number;
  /**
   * The refund metadata.
   */
  metadata?: Record<string, unknown> | null;
  /**
   * The refund source.
   */
  source?: { id: string; name: string; type: string };
  /**
   * The date the refund was created.
   */
  date_created?: string;
  /**
   * The status of the refund.
   */
  status?: string;
  /**
   * The reason for the refund.
   */
  reason?: string | null;
}

/**
 * The shape returned by `POST /v1/customers`, `GET /v1/customers/:id`,
 * and `PUT /v1/customers/:id`.
 */
export interface MercadoPagoCustomer {
  /**
   * The customer ID.
   */
  id: string;
  /**
   * The customer email.
   */
  email: string;
  /**
   * The customer first name.
   */
  first_name?: string | null;
  /**
   * The customer last name.
   */
  last_name?: string | null;
  /**
   * The customer phone.
   */
  phone?: { area_code?: string; number?: string } | null;
  /**
   * The customer identification.
   */
  identification?: { type?: string; number?: string } | null;
  /**
   * The customer default address.
   */
  default_address?: string | null;
  /**
   * The date the customer was registered.
   */
  date_registered?: string | null;
  /**
   * The customer description.
   */
  description?: string | null;
  /**
   * The date the customer was created.
   */
  date_created?: string;
  /**
   * The date the customer was last updated.
   */
  date_last_updated?: string;
  /**
   * The customer default card.
   */
  default_card?: string | null;
  /**
   * Whether the customer is in live mode.
   */
  live_mode?: boolean;
  /**
   * The customer metadata.
   */
  metadata?: Record<string, unknown> | null;
}

export interface MercadoPagoAutoRecurring {
  /**
   * The frequency.
   */
  frequency: number;
  /**
   * The frequency type.
   */
  frequency_type: string;
  /**
   * The transaction amount.
   */
  transaction_amount?: number;
  /**
   * The currency ID.
   */
  currency_id: string;
  /**
   * The free trial.
   */
  free_trial?: { frequency: number; frequency_type: string } | null;
  /**
   * The start date.
   */
  start_date?: string;
  /**
   * The end date.
   */
  end_date?: string;
}

export interface MercadoPagoPreApproval {
  /**
   * The preapproval ID.
   */
  id: string;
  /**
   * The payer ID.
   */
  payer_id?: number;
  /**
   * The payer email.
   */
  payer_email?: string;
  /**
   * The collector ID.
   */
  collector_id?: number;
  /**
   * The application ID.
   */
  application_id?: number;
  /**
   * The status of the preapproval.
   */
  status: string;
  /**
   * The reason for the preapproval.
   */
  reason?: string;
  /**
   * The external reference.
   */
  external_reference?: string | null;
  /**
   * The date the preapproval was created.
   */
  date_created?: string;
  /**
   * The date the preapproval was last modified.
   */
  last_modified?: string;
  /**
   * The production Checkout Pro URL.
   */
  init_point?: string;
  /**
   * The sandbox Checkout Pro URL.
   */
  sandbox_init_point?: string;
  /**
   * The auto recurring.
   */
  auto_recurring: MercadoPagoAutoRecurring;
  /**
   * The payment method ID.
   */
  payment_method_id?: string | null;
  /**
   * The first invoice offset.
   */
  first_invoice_offset?: number | null;
  /**
   * The back URL.
   */
  back_url?: string;
  /**
   * The next payment date.
   */
  next_payment_date?: string;
  /**
   * The preapproval plan ID.
   */
  preapproval_plan_id?: string;
}

export interface MercadoPagoAuthorizedPayment {
  /**
   * The authorized payment ID.
   */
  id: number;
  /**
   * The type of the authorized payment.
   */
  type: string;
  /**
   * The date the authorized payment was created.
   */
  date_created?: string;
  /**
   * The date the authorized payment was last modified.
   */
  last_modified?: string;
  /**
   * The preapproval ID.
   */
  preapproval_id: string;
  /**
   * The reason for the authorized payment.
   */
  reason?: string;
  /**
   * The external reference.
   */
  external_reference?: string | number | null;
  /**
   * The currency ID.
   */
  currency_id: string;
  /**
   * The transaction amount.
   */
  transaction_amount: string | number;
  /**
   * The date the authorized payment was debited.
   */
  debit_date?: string;
  /**
   * The retry attempt.
   */
  retry_attempt?: number;
  /**
   * The status of the authorized payment.
   */
  status: string;
  /**
   * Whether the authorized payment was summarized.
   */
  summarized?: string;
  /**
   * The payment of the authorized payment.
   */
  payment?: { id: number; status: string; status_detail?: string };
}

export type MercadoPagoRawEvents = {
  'mercadopago.payment.created': MercadoPagoWebhookEvent;
  'mercadopago.payment.updated': MercadoPagoWebhookEvent;
  'mercadopago.subscription_preapproval.created': MercadoPagoWebhookEvent;
  'mercadopago.subscription_preapproval.updated': MercadoPagoWebhookEvent;
  'mercadopago.subscription_authorized_payment.created': MercadoPagoWebhookEvent;
  'mercadopago.subscription_authorized_payment.updated': MercadoPagoWebhookEvent;
};

type StripMercadoPagoPrefix<T> = T extends `mercadopago.${infer Rest}`
  ? Rest
  : T;

type MercadoPagoAction =
  | StripMercadoPagoPrefix<keyof MercadoPagoRawEvents>
  | (string & {});

export interface MercadoPagoWebhookEvent {
  id: number;
  /**
   * Whether the webhook event is in live mode.
   */
  live_mode: boolean;
  /**
   * The notification topic
   */
  type:
    | 'payment'
    | 'subscription_preapproval'
    | 'subscription_preapproval_plan'
    | 'subscription_authorized_payment'
    | (string & {});
  /**
   * The date the webhook event was created.
   */
  date_created: string;
  /**
   * The user ID.
   */
  user_id: number;
  /**
   * The API version.
   */
  api_version: string;
  /**
   * The specific action within `type`, e.g. `payment.created`.
   */
  action: MercadoPagoAction;
  /**
   * The data of the webhook event.
   */
  data: { id: string };
}
