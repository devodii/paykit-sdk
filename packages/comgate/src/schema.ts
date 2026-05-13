export interface ComgateWebhookResponse {
  /**
   * The transaction ID
   */
  transId: string;

  /**
   * The merchant ID
   */
  merchant: string;

  /**
   * Whether the transaction is in test mode
   */
  test: boolean;

  /**
   * The price
   */
  price: number;

  /**
   * The currency of the payment
   */
  curr: string;

  /**
   * The label of the payment
   */
  label: string;

  /**
   * The reference ID
   */
  refId: string;

  /**
   * The payer ID
   */
  payerId?: string;

  /**
   * The payer name
   */
  payerName?: string;

  /**
   * The payer account of the payment
   */
  payerAcc?: string;

  /**
   * The method of the payment
   */
  method?: string;

  /**
   * The account of the payment
   */
  account?: string;

  /**
   * The email of the payment
   */
  email: string;

  /**
   * The phone of the payment
   */
  phone?: string;

  /**
   * The name of the payment
   */
  name?: string;

  /**
   * The secret of the payment
   */
  secret: string;

  /**
   * The status of the payment
   */
  status: 'PAID' | 'CANCELLED' | 'AUTHORIZED';

  /**
   * The fee of the payment
   */
  fee?: string;

  /**
   * The full name of the payment
   */
  fullName: string;

  /**
   * The billing address city of the payment
   */
  billingAddrCity?: string;

  /**
   * The billing address street of the payment
   */
  billingAddrStreet?: string;

  /**
   * The billing address postal code of the payment
   */
  billingAddrPostalCode?: string;

  /**
   * The billing address country of the payment
   */
  billingAddrCountry?: string;

  /**
   * The delivery of the payment
   */
  delivery?: 'HOME_DELIVERY' | 'PICKUP' | 'ELECTRONIC_DELIVERY';

  /**
   * The home delivery city of the payment
   */
  homeDeliveryCity?: string;

  /**
   * The home delivery street of the payment
   */
  homeDeliveryStreet?: string;

  /**
   * The home delivery postal code of the payment
   */
  homeDeliveryPostalCode?: string;

  /**
   * The home delivery country of the payment
   */
  homeDeliveryCountry?: string;

  /**
   * The category of the payment
   */
  category?: 'PHYSICAL_GOODS_ONLY' | 'OTHER';

  /**
   * The applied fee of the payment
   */
  appliedFee?: number;

  /**
   * The applied fee type of the payment
   */
  appliedFeeType?:
    | 'EU_UNREGULATED'
    | 'NON_EU_BUSINESS'
    | 'NON_EU_CONSUMER'
    | 'EU_CONSUMER';
}

export interface ComgateWebhookStatusResponseBase {
  /**
   * The code of the response
   */
  code: 0 | 1100 | 1200 | 1400 | 1500;

  message: string;
}

export interface ComgateWebhookStatusSuccessResponse
  extends ComgateWebhookStatusResponseBase {
  /**
   * The code of the response
   */
  code: 0;

  /**
   * The merchant of the response
   */
  merchant: string;

  /**
   * String value of `true` or `false`
   */
  test: string;

  /**
   * Price of the product in cents or pennies
   */
  price: number;

  /**
   * Currency code according to ISO 4217
   */
  curr: string;

  /**
   * The label of the product
   */
  label: string;

  /**
   * The reference ID of the product
   */
  refId: string;

  /**
   * The payer ID of the product
   */
  payerId?: string;

  /**
   * The method of the product
   */
  method?: string;

  /**
   * The account of the product
   */
  account?: string;

  /**
   * Payer's contact e-mail
   */
  email: string;

  /**
   * The name of the product
   */
  name?: string;

  /**
   * The phone of the product
   */
  phone?: string;

  /**
   * The transaction ID of the product
   */
  transId: string;

  /**
   * The secret of the product
   */
  secret: string;

  /**
   * The status of the product
   */
  status: 'PAID' | 'CANCELLED' | 'AUTHORIZED' | 'PENDING';

  /**
   * The payer name of the product
   */
  payerName?: string;

  /**
   * The payer account of the product
   */
  payerAcc?: string;

  /**
   * The fee of the product
   */
  fee?: string;

  /**
   * The vs of the product
   */
  vs?: string;

  /**
   * The card valid of the product
   */
  cardValid?: string;

  /**
   * The card number of the product
   */
  cardNumber?: string;

  /**
   * The applied fee of the product
   */
  appliedFee?: number;

  /**
   * The applied fee type of the product
   */
  appliedFeeType?:
    | 'EU_UNREGULATED'
    | 'NON_EU_BUSINESS'
    | 'NON_EU_CONSUMER'
    | 'EU_CONSUMER';

  /**
   * The payment error reason of the product
   */
  paymentErrorReason?: string;
}

export interface ComgateRefundResponse {
  /**
   * The code of the response
   */
  code: 0;

  /**
   * The message of the response
   */
  message: string;
}

export interface ComgatePaymentOperationResponse {
  /**
   * The code of the response
   */
  code: number;

  /**
   * The message of the response
   */
  message: string;

  /**
   * The transaction ID of the response
   */
  transId?: string;

  /**
   * The redirect of the response
   */
  redirect?: string;

  /**
   * The applepay status of the response
   */
  applepay: 'PAID';

  /**
   * The applepay message of the response
   */
  applepayMessage?: string;
}
