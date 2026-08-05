export interface LemonSqueezyResponse<T = any> {
  data: T;
  meta?: any;
  jsonapi?: any;
  links?: any;
}

export interface LemonSqueezyResource<TAttributes = any> {
  type: string;
  id: string;
  attributes: TAttributes;
  relationships?: any;
  links?: any;
}

export interface LemonSqueezyCustomerAttributes {
  store_id: number;
  name: string;
  email: string;
  status: string;
  city?: string;
  region?: string;
  country?: string;
  created_at: string;
  updated_at: string;
  test_mode: boolean;
}

export type LemonSqueezyCustomer = LemonSqueezyResource<LemonSqueezyCustomerAttributes>;

export interface LemonSqueezyCheckoutAttributes {
  store_id: number;
  variant_id: number;
  custom_price: number | null;
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
  checkout_data: {
    email: string;
    name: string;
    billing_address: any[];
    tax_number: string;
    discount_code: string;
    custom: Record<string, unknown>;
    variant_quantities: any[];
  };
  preview: any;
  expires_at: string;
  created_at: string;
  updated_at: string;
  test_mode: boolean;
  url: string;
}

export type LemonSqueezyCheckout = LemonSqueezyResource<LemonSqueezyCheckoutAttributes>;

export interface LemonSqueezyOrderAttributes {
  store_id: number;
  customer_id: number;
  identifier: string;
  order_number: number;
  user_name: string;
  user_email: string;
  currency: string;
  currency_rate: string;
  subtotal: number;
  discount_total: number;
  tax: number;
  total: number;
  setup_fee: number;
  setup_fee_formatted: string;
  tax_inclusive: boolean;
  tax_formatted: string;
  total_formatted: string;
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
  urls: {
    receipt: string;
  };
  created_at: string;
  updated_at: string;
  test_mode: boolean;
  refunded: boolean;
  refunded_at: string | null;
  refunded_amount?: number;
  status: string;
  status_formatted: string;
}

export type LemonSqueezyOrder = LemonSqueezyResource<LemonSqueezyOrderAttributes>;

export interface LemonSqueezySubscriptionAttributes {
  store_id: number;
  customer_id: number;
  order_id: number;
  order_item_id: number;
  product_id: number;
  variant_id: number;
  product_name: string;
  variant_name: string;
  user_name: string;
  user_email: string;
  status: string;
  status_formatted: string;
  card_brand: string;
  card_last_four: string;
  pause: any | null;
  cancelled: boolean;
  trial_ends_at: string | null;
  billing_anchor: number;
  urls: {
    update_payment_method: string;
    customer_portal: string;
  };
  renews_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
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
