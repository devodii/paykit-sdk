export interface PaystackResponse<T = unknown> {
  /**
   * Whether the request was successful
   */
  status: boolean;

  /**
   * The message of the response
   */
  message: string;

  /**
   * The data of the response
   */
  data: T;
}

export interface PaystackWebhookEvent<
  T extends string = string,
  D = Record<string, unknown>,
> {
  event: T;
  data: D;
}

export interface PaystackAuthorization {
  /**
   * The authorization code of the authorization
   */
  authorization_code: string;
  /**
   * The bin of the authorization
   */
  bin: string;
  /**
   * The last 4 digits of the authorization
   */
  last4: string;
  /**
   * The expiration month of the authorization
   */
  exp_month: string;
  /**
   * The expiration year of the authorization
   */
  exp_year: string;
  /**
   * The channel of the authorization
   */
  channel: string;
  /**
   * The type of the card of the authorization
   */
  card_type: string;
  /**
   * The bank of the authorization
   */
  bank: string;
  /**
   * The country code of the authorization
   */
  country_code: string | null;
  /**
   * The brand of the authorization
   */
  brand: string;
  /**
   * Whether the authorization is reusable
   */
  reusable: boolean;
  /**
   * The signature of the authorization
   */
  signature: string;
  /**
   * The account name of the authorization
   */
  account_name?: string | null;
}

export interface PaystackCustomer {
  /**
   * The integration of the customer
   */
  integration: number;
  /**
   * The first name of the customer
   */
  first_name: string | null;
  /**
   * The last name of the customer
   */
  last_name: string | null;
  /**
   * The email of the customer
   */
  email: string;
  /**
   * The phone number of the customer
   */
  phone: string | null;
  /**
   * The metadata of the customer
   */
  metadata: Record<string, unknown> | null;
  /**
   * The domain of the customer
   */
  domain: string;
  /**
   * The customer code of the customer
   */
  customer_code: string;
  /**
   * The risk action of the customer
   */
  risk_action: string;
  /**
   * The id of the customer
   */
  id: number;
  /**
   * The international format phone number of the customer
   */
  international_format_phone?: string | null;
  /**
   * The created at timestamp of the customer
   */
  created_at: string;
  /**
   * The updated at timestamp of the customer
   */
  updated_at: string;
}

export interface PaystackTransaction {
  /**
   * The id of the transaction
   */
  id: number;
  /**
   * The domain of the transaction
   */
  domain: 'test' | 'live';
  /**
   * The status of the transaction
   */
  status:
    | 'success'
    | 'failed'
    | 'pending'
    | 'abandoned'
    | 'reversed'
    | 'queued';
  /**
   * The reference of the transaction
   */
  reference: string;
  /**
   * The receipt number of the transaction
   */
  receipt_number: number | null;
  /**
   * The amount of the transaction
   */
  amount: number;
  /**
   * The message of the transaction
   */
  message: string | null;
  /**
   * The gateway response of the transaction
   */
  gateway_response: string;
  /**
   * The paid at timestamp of the transaction
   */
  paid_at: string | null;
  /**
   * The created at timestamp of the transaction
   */
  created_at: string;
  /**
   * The channel of the transaction e.g `card`
   */
  channel: string;
  /**
   * The currency of the transaction e.g `NGN`
   */
  currency: string;
  /**
   * The IP address of the transaction
   */
  ip_address: string | null;
  /**
   * The metadata of the transaction
   */
  metadata: string;
  /**
   * The fees of the transaction
   */
  fees: number | null;
  /**
   * The customer of the transaction
   */
  customer: Partial<PaystackCustomer>;
  /**
   * The authorization of the transaction
   */
  authorization: PaystackAuthorization | null;
  /**
   * The plan of the transaction
   */
  plan?: PaystackPlan | null;
  /**
   * The subaccount of the transaction
   */
  subaccount?: Record<string, unknown> | null;
}

/**
 * Shape as returned by `unwrap()`, i.e. *after* `_toCamel` has run on
 * Paystack's raw (snake_case) `/transaction/initialize` response.
 */
export interface PaystackInitializeResponse {
  /**
   * The authorization URL of the transaction
   */
  authorizationUrl: string;
  /**
   * The access code of the transaction
   */
  accessCode: string;
  /**
   * The reference of the transaction
   */
  reference: string;
}

export interface PaystackRefund {
  id: number;
  /**
   * The transaction of the refund
   */
  transaction: number;
  /**
   * The amount of the refund
   */
  amount: number;
  /**
   * The deducted amount of the refund
   */
  deducted_amount: number | null;
  /**
   * The currency of the refund e.g `NGN`
   */
  currency: string;
  /**
   * The channel of the refund e.g `card`
   */
  channel: string;
  /**
   * Whether the refund is fully deducted
   */
  fully_deducted: boolean | null;
  /**
   * The refunded at timestamp of the refund
   */
  refunded_at: string | null;
  /**
   * The expected at timestamp of the refund
   */
  expected_at: string;
  /**
   * The customer note of the refund
   */
  customer_note: string;
  /**
   * The merchant note of the refund
   */
  merchant_note: string;
  /**
   * The created at timestamp of the refund
   */
  created_at: string;
  /**
   * The updated at timestamp of the refund
   */
  updated_at: string;
  /**
   * The status of the refund
   */
  status:
    | 'pending'
    | 'processing'
    | 'processed'
    | 'failed'
    | 'declined'
    | 'needs-attention';
}

export interface PaystackPlan {
  /**
   * The id of the plan
   */
  id: number;
  /**
   * The code of the plan
   */
  plan_code: string;
  /**
   * The name of the plan
   */
  name: string;
  /**
   * The description of the plan
   */
  description?: string | null;
  /**
   * The amount of the plan
   */
  amount: number;
  /**
   * The currency of the plan e.g `NGN`
   */
  currency: string;
  /**
   * The interval of the plan
   */
  interval:
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'quarterly'
    | 'biannually'
    | 'annually';
  /**
   * Whether to send invoices for the plan
   */
  send_invoices?: boolean;
  /**
   * Whether to send SMS for the plan
   */
  send_sms?: boolean;
  /**
   * Whether to use a hosted page for the plan
   */
  hosted_page?: boolean;
  /**
   * The URL of the hosted page for the plan
   */
  hosted_page_url?: string | null;
  /**
   * The summary of the hosted page for the plan
   */
  hosted_page_summary?: string | null;
}

export interface PaystackSubscription {
  /**
   * The id of the subscription
   */
  id: number;
  /**
   * The code of the subscription
   */
  subscription_code: string;
  /**
   * The email token of the subscription
   */
  email_token: string;
  /**
   * The status of the subscription
   */
  status:
    | 'active'
    | 'non-renewing'
    | 'attention'
    | 'completed'
    | 'cancelled';
  /**
   * The amount of the subscription
   */
  amount: number;
  /**
   * The currency of the subscription e.g `NGN`
   */
  currency: string;
  /**
   * The quantity of the subscription
   */
  quantity: number;
  /**
   * The cron expression of the subscription
   */
  cron_expression: string;
  /**
   * The next payment date of the subscription
   */
  next_payment_date: string | null;
  /**
   * The number of open invoices for the subscription
   */
  open_invoices: number;
  /**
   * The invoice limit for the subscription
   */
  invoice_limit: number;
  /**
   * The created at timestamp of the subscription
   */
  createdAt: string;
  /**
   * The updated at timestamp of the subscription
   */
  updatedAt?: string;
  /**
   * The plan of the subscription
   */
  plan: PaystackPlan;
  /**
   * The customer of the subscription
   */
  customer: Partial<PaystackCustomer>;
  /**
   * The authorization of the subscription
   */
  authorization: PaystackAuthorization | null;
  /**
   * The most recent invoice of the subscription
   */
  most_recent_invoice?: PaystackInvoice | null;
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export interface PaystackInvoice {
  id: number;
  /**
   * The domain of the invoice
   */
  domain: 'test' | 'live';
  /**
   * The code of the invoice
   */
  invoice_code: string;
  /**
   * The amount of the invoice
   */
  amount: number;
  /**
   * The start period of the invoice
   */
  period_start: string;
  /**
   * The end period of the invoice
   */
  period_end: string;
  /**
   * The status of the invoice
   */
  status: 'success' | 'failed' | 'pending';
  /**
   * Whether the invoice is paid
   */
  paid: boolean;
  /**
   * The paid at timestamp of the invoice
   */
  paid_at: string | null;
  /**
   * The description of the invoice
   */
  description: string | null;
  /**
   * The authorization of the invoice
   */
  authorization: PaystackAuthorization | null;
  /**
   * The subscription code of the invoice
   */
  subscription: string; // subscription_code
  /**
   * The customer of the invoice
   */
  customer: Partial<PaystackCustomer>;
  /**
   * The transaction of the invoice
   */
  transaction: PaystackTransaction | null;
  /**
   * The created at timestamp of the invoice
   */
  created_at: string;
  /**
   * The updated at timestamp of the invoice
   */
  updated_at: string;
}

export interface PaystackTransferRecipient {
  /**
   * The domain of the transfer recipient
   */
  domain: 'test' | 'live';
  /**
   * The type of the transfer recipient
   */
  type: string;
  /**
   * The currency of the transfer recipient
   */
  currency: string;
  /**
   * The name of the transfer recipient
   */
  name: string;
  /**
   * The details of the transfer recipient
   */
  details: {
    /**
     * The account number of the transfer recipient
     */
    account_number: string;
    /**
     * The account name of the transfer recipient
     */
    account_name: string | null;
    /**
     * The bank code of the transfer recipient
     */
    bank_code: string;
    /**
     * The bank name of the transfer recipient
     */
    bank_name: string;
  };
  /**
   * The description of the transfer recipient
   */
  description: string | null;
  /**
   * The metadata of the transfer recipient
   */
  metadata: Record<string, unknown> | null;
  /**
   * The recipient code of the transfer recipient
   */
  recipient_code: string;
  /**
   * Whether the transfer recipient is active
   */
  active: boolean;
}

export interface PaystackTransfer {
  /**
   * The id of the transfer
   */
  id: number;
  /**
   * The domain of the transfer
   */
  domain: 'test' | 'live';
  /**
   * The amount of the transfer
   */
  amount: number;
  /**
   * The currency of the transfer e.g `NGN`
   */
  currency: string;
  /**
   * The source of the transfer
   */
  source: string;
  /**
   * The source details of the transfer
   */
  source_details: Record<string, unknown> | null;
  /**
   * The reason of the transfer
   */
  reason: string | null;
  /**
   * The reference of the transfer
   */
  reference: string;
  /**
   * The recipient of the transfer
   */
  recipient: PaystackTransferRecipient;
  /**
   * The status of the transfer
   */
  status: 'success' | 'failed' | 'reversed' | 'pending';
  /**
   * The transfer code of the transfer
   */
  transfer_code: string;
  /**
   * The transferred at timestamp of the transfer
   */
  transferred_at: string | null;
  /**
   * The created at timestamp of the transfer
   */
  created_at: string;
  /**
   * The updated at timestamp of the transfer
   */
  updated_at?: string;
}

export interface PaystackPaymentRequest {
  /**
   * The id of the payment request
   */
  id: number;
  /**
   * The domain of the payment request
   */
  domain: 'test' | 'live';
  /**
   * The amount of the payment request
   */
  amount: number;
  /**
   * The currency of the payment request e.g `NGN`
   */
  currency: string;
  /**
   * The due date of the payment request
   */
  due_date: string | null;
  /**
   * Whether the payment request has an invoice
   */
  has_invoice: boolean;
  /**
   * The invoice number of the payment request
   */
  invoice_number: number | null;
  /**
   * The description of the payment request
   */
  description: string | null;
  /**
   * The PDF URL of the payment request
   */
  pdf_url: string | null;
  /**
   * The line items of the payment request
   */
  line_items: Array<{
    /**
     * The name of the line item
     */
    name: string;
    /**
     * The amount of the line item
     */
    amount: number;
    /**
     * The quantity of the line item
     */
    quantity: number;
  }>;
  tax: Array<{
    /**
     * The name of the tax
     */
    name: string;
    /**
     * The amount of the tax
     */
    amount: number;
  }>;
  /**
   * The request code of the payment request
   */
  request_code: string;
  /**
   * The status of the payment request
   */
  status: 'pending' | 'success' | 'failed';
  /**
   * Whether the payment request is paid
   */
  paid: boolean;
  /**
   * The paid at timestamp of the payment request
   */
  paid_at: string | null;
  /**
   * The metadata of the payment request
   */
  metadata: Record<string, unknown> | null;
  /**
   * The customer of the payment request
   */
  customer: Partial<PaystackCustomer>;
  /**
   * The created at timestamp of the payment request
   */
  created_at: string;
  /**
   * The updated at timestamp of the payment request
   */
  updated_at: string;
}

export interface PaystackDVAAssignment {
  /**
   * The id of the customer
   */
  customer_id: number;
  /**
   * The customer code of the customer
   */
  customer_code: string;
  /**
   * The email of the customer
   */
  email: string;
  /**
   * The dedicated account of the customer
   */
  dedicated_account: {
    /**
     * The bank of the dedicated account
     */
    bank: {
      /**
       * The id of the bank
       */
      id: number;
      /**
       * The name of the bank
       */
      name: string;
      /**
       * The slug of the bank
       */
      slug: string;
    };
    /**
     * The account name of the dedicated account
     */
    account_name: string;
    /**
     * The account number of the dedicated account
     */
    account_number: string;
    /**
     * Whether the dedicated account is assigned
     */
    assigned: boolean;
    /**
     * The currency of the dedicated account
     */
    currency: string;
    /**
     * The metadata of the dedicated account
     */
    metadata: Record<string, unknown> | null;
    /**
     * Whether the dedicated account is active
     */
    active: boolean;
    /**
     * The id of the dedicated account
     */
    id: number;
  } | null;
  /**
   * The identification of the customer
   */
  identification: {
    /**
     * The country of the identification
     */
    country: string;
    /**
     * The type of the identification
     */
    type: string;
    /**
     * The BVN of the identification
     */
    bvn?: string;
    /**
     * The account number of the identification
     */
    account_number?: string;
    /**
     * The bank code of the identification
     */
    bank_code?: string;
  } | null;
  /**
   * The reason of the identification
   */
  reason?: string;
}

export interface PaystackCustomerIdentification {
  /**
   * The id of the customer
   */
  customer_id: number;
  /**
   * The customer code of the customer
   */
  customer_code: string;
  /**
   * The email of the customer
   */
  email: string;
  /**
   * The identification of the customer
   */
  identification: {
    /**
     * The country of the identification
     */
    country: string;
    /**
     * The type of the identification
     */
    type: string;
    /**
     * The BVN of the identification
     */
    bvn?: string;
    /**
     * The account number of the identification
     */
    account_number?: string;
    /**
     * The bank code of the identification
     */
    bank_code?: string;
  };
  reason?: string; // present on failed events
}

export interface PaystackDispute {
  /**
   * The id of the dispute
   */
  id: number;
  /**
   * The refund amount of the dispute
   */
  refund_amount: number | null;
  /**
   * The currency of the dispute
   */
  currency: string | null;
  /**
   * The status of the dispute
   */
  status:
    | 'awaiting-merchant-feedback'
    | 'awaiting-bank-feedback'
    | 'pending'
    | 'resolved';
  /**
   * The resolution of the dispute
   */
  resolution: string | null;
  /**
   * The domain of the dispute
   */
  domain: 'test' | 'live';
  /**
   * The transaction of the dispute
   */
  transaction: PaystackTransaction;
  /**
   * The created at timestamp of the dispute
   */
  created_at: string;
  /**
   * The updated at timestamp of the dispute
   */
  updated_at: string;
  /**
   * The due at timestamp of the dispute
   */
  due_at: string | null;
}

export interface PaystackExpiringCard {
  /**
   * The expiry date of the expiring card
   */
  expiry_date: string;
  /**
   * The description of the expiring card
   */
  description: string;
  /**
   * The brand of the expiring card
   */
  brand: string;
  /**
   * The last 4 digits of the expiring card
   */
  last4: string;
  /**
   * The subscription of the expiring card
   */
  subscription: {
    /**
     * The id of the subscription
     */
    id: number;
    /**
     * The subscription code of the subscription
     */
    subscription_code: string;
    /**
     * The amount of the subscription
     */
    amount: number;
    /**
     * The next payment date of the subscription
     */
    next_payment_date: string;
    /**
     * The plan of the subscription
     */
    plan: PaystackPlan;
    /**
     * The customer of the subscription
     */
    customer: Partial<PaystackCustomer>;
  };
}

export type PaystackRawEvents = {
  'paystack.charge.success': PaystackTransaction;
  'paystack.charge.dispute.create': PaystackDispute;
  'paystack.charge.dispute.remind': PaystackDispute;
  'paystack.charge.dispute.resolve': PaystackDispute;
  'paystack.customeridentification.success': PaystackCustomerIdentification;
  'paystack.customeridentification.failed': PaystackCustomerIdentification;
  'paystack.dedicatedaccount.assign.success': PaystackDVAAssignment;
  'paystack.dedicatedaccount.assign.failed': PaystackDVAAssignment;
  'paystack.invoice.create': PaystackInvoice;
  'paystack.invoice.update': PaystackInvoice;
  'paystack.invoice.payment_failed': PaystackInvoice;
  'paystack.paymentrequest.pending': PaystackPaymentRequest;
  'paystack.paymentrequest.success': PaystackPaymentRequest;
  'paystack.refund.failed': PaystackRefund;
  'paystack.refund.pending': PaystackRefund;
  'paystack.refund.processed': PaystackRefund;
  'paystack.refund.processing': PaystackRefund;
  'paystack.subscription.create': PaystackSubscription;
  'paystack.subscription.enable': PaystackSubscription;
  'paystack.subscription.disable': PaystackSubscription;
  'paystack.subscription.not_renew': PaystackSubscription;
  'paystack.subscription.expiring_cards': PaystackExpiringCard[];
  'paystack.transfer.success': PaystackTransfer;
  'paystack.transfer.failed': PaystackTransfer;
  'paystack.transfer.reversed': PaystackTransfer;
};
