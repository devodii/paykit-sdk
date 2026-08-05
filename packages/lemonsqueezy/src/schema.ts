export interface LemonSqueezyResponse<T = any> {
  data: T;
  meta?: unknown;
  jsonapi?: unknown;
  links?: unknown;
}

export interface LemonSqueezyResource<TAttributes = any> {
  type: string;
  id: string;
  attributes: TAttributes;
  relationships?: unknown;
  links?: unknown;
}

export interface LemonSqueezyCustomerAttributes {
  /**
   * The store id of the customer
   */
  store_id: number;
  /**
   * The name of the customer
   */
  name: string;
  /**
   * The email of the customer
   */
  email: string;
  /**
   * The status of the customer
   */
  status: string;
  /**
   * The city of the customer
   */
  city?: string;
  /**
   * The region of the customer
   */
  region?: string;
  /**
   * The country of the customer
   */
  country?: string;
  /**
   * The created at of the customer
   */
  created_at: string;
  /**
   * The updated at of the customer
   */
  updated_at: string;
  /**
   * The test mode of the customer
   */
  test_mode: boolean;
}

export type LemonSqueezyCustomer = LemonSqueezyResource<LemonSqueezyCustomerAttributes>;

export interface LemonSqueezyCheckoutAttributes {
  /**
   * The store id of the checkout
   */
  store_id: number;
  /**
   * The variant id of the checkout
   */
  variant_id: number;
  /**
   * The custom price of the checkout
   */
  custom_price: number | null;
  /**
   * The product options of the checkout
   */
  product_options: {
    name: string;
    description: string;
    media: string[];
    redirect_url: string;
    receipt_button_text: string;
    receipt_link_url: string;
    receipt_thank_you_note: string;
    enabled_variants: number[];
  };
  /**
   * The checkout options of the checkout
   */
  checkout_options: {
    embed: boolean;
    media: boolean;
    logo: boolean;
    desc: boolean;
    discount: boolean;
    dark: boolean;
    subscription_preview: boolean;
    button_color: string;
  };
  /**
   * The checkout data of the checkout
   */
  checkout_data: {
    email: string;
    name: string;
    billing_address: any[];
    tax_number: string;
    discount_code: string;
    custom: Record<string, unknown>;
    variant_quantities: any[];
  };
  /**
   * The preview of the checkout
   */
  preview: any;
  /**
   * The expires at of the checkout
   */
  expires_at: string;
  /**
   * The created at of the checkout
   */
  created_at: string;
  /**
   * The updated at of the checkout
   */
  updated_at: string;
  /**
   * The test mode of the checkout
   */
  test_mode: boolean;
  /**
   * The url of the checkout
   */
  url: string;
}

export type LemonSqueezyCheckout = LemonSqueezyResource<LemonSqueezyCheckoutAttributes>;

export interface LemonSqueezyOrderAttributes {
  /**
   * The store id of the order
   */
  store_id: number;
  /**
   * The customer id of the order
   */
  customer_id: number;
  /**
   * The identifier of the order
   */
  identifier: string;
  /**
   * The order number of the order
   */
  order_number: number;
  /**
   * The user name of the order
   */
  user_name: string;
  /**
   * The user email of the order
   */
  user_email: string;
  /**
   * The currency of the order
   */
  currency: string;
  /**
   * The currency rate of the order
   */
  currency_rate: string;
  /**
   * The subtotal of the order
   */
  subtotal: number;
  /**
   * The discount total of the order
   */
  discount_total: number;
  /**
   * The tax of the order
   */
  tax: number;
  /**
   * The total of the order
   */
  total: number;
  /**
   * The setup fee of the order
   */
  setup_fee: number;
  /**
   * The setup fee formatted of the order
   */
  setup_fee_formatted: string;
  /**
   * The tax inclusive of the order
   */
  tax_inclusive: boolean;
  /**
   * The tax formatted of the order
   */
  tax_formatted: string;
  /**
   * The total formatted of the order
   */
  total_formatted: string;
  /**
   * The first order item of the order
   */
  first_order_item: {
    id: number;
    order_id: number;
    product_id: number;
    variant_id: number;
    price_id: number;
    product_name: string;
    variant_name: string;
    price: number;
    created_at: string;
    updated_at: string;
    test_mode: boolean;
  };
  /**
   * The urls of the order
   */
  urls: {
    receipt: string;
  };
  /**
   * The created at of the order
   */
  created_at: string;
  /**
   * The updated at of the order
   */
  updated_at: string;
  /**
   * The test mode of the order
   */
  test_mode: boolean;
  /**
   * The refunded of the order
   */
  refunded: boolean;
  /**
   * The refunded at of the order
   */
  refunded_at: string | null;
  /**
   * The refunded amount of the order
   */
  refunded_amount?: number;
  /**
   * The status of the order
   */
  status: string;
  /**
   * The status formatted of the order
   */
  status_formatted: string;
}

export type LemonSqueezyOrder = LemonSqueezyResource<LemonSqueezyOrderAttributes>;

export interface LemonSqueezySubscriptionAttributes {
  /**
   * The store id of the subscription
   */
  store_id: number;
  /**
   * The customer id of the subscription
   */
  customer_id: number;
  /**
   * The order id of the subscription
   */
  order_id: number;
  /**
   * The order item id of the subscription
   */
  order_item_id: number;
  /**
   * The product id of the subscription
   */
  product_id: number;
  /**
   * The variant id of the subscription
   */
  variant_id: number;
  /**
   * The product name of the subscription
   */
  product_name: string;
  /**
   * The variant name of the subscription
   */
  variant_name: string;
  /**
   * The user name of the subscription
   */
  user_name: string;
  /**
   * The user email of the subscription
   */
  user_email: string;
  /**
   * The status of the subscription
   */
  status: string;
  /**
   * The status formatted of the subscription
   */
  status_formatted: string;
  /**
   * The card brand of the subscription
   */
  card_brand: string;
  /**
   * The card last four of the subscription
   */
  card_last_four: string;
  /**
   * The pause of the subscription
   */
  pause: any | null;
  /**
   * The cancelled of the subscription
   */
  cancelled: boolean;
  /**
   * The trial ends at of the subscription
   */
  trial_ends_at: string | null;
  /**
   * The billing anchor of the subscription
   */
  billing_anchor: number;
  /**
   * The urls of the subscription
   */
  urls: {
    update_payment_method: string;
    customer_portal: string;
  };
  /**
   * The renews at of the subscription
   */
  renews_at: string;
  /**
   * The ends at of the subscription
   */
  ends_at: string | null;
  /**
   * The created at of the subscription
   */
  created_at: string;
  /**
   * The updated at of the subscription
   */
  updated_at: string;
  /**
   * The test mode of the subscription
   */
  test_mode: boolean;
}

export type LemonSqueezySubscription = LemonSqueezyResource<LemonSqueezySubscriptionAttributes>;

export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: Record<string, unknown>;
  };
  data: LemonSqueezyResource;
}
