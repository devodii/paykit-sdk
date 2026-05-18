import {
  PayKitProvider,
  Checkout,
  CreateCheckoutSchema,
  CreateCustomerParams,
  Customer,
  UpdateCustomerParams,
  Subscription,
  UpdateSubscriptionSchema,
  paykitEvent$InboundSchema,
  WebhookEventPayload,
  PaykitProviderOptions,
  Invoice,
  invoiceStatusSchema,
  billingModeSchema,
  UpdateCheckoutSchema,
  CreateSubscriptionSchema,
  CreatePaymentSchema,
  Payment,
  UpdatePaymentSchema,
  CreateRefundSchema,
  Refund,
  createSubscriptionSchema,
  createPaymentSchema,
  updatePaymentSchema,
  ValidationError,
  InvalidTypeError,
  updateSubscriptionSchema,
  retrieveSubscriptionSchema,
  retrievePaymentSchema,
  deletePaymentSchema,
  createRefundSchema,
  CapturePaymentSchema,
  capturePaymentSchema,
  AbstractPayKitProvider,
  schema,
  createCustomerSchema,
  WebhookError,
  updateCheckoutSchema,
  ResourceNotFoundError,
  stringifyMetadataValues,
  tryCatchAsync,
  PAYKIT_METADATA_KEY,
  createCheckoutSchema,
  omitInternalMetadata,
  validateRequiredKeys,
  isIdCustomer,
  isEmailCustomer,
  refundReasonMatcher,
  Schema,
  ProviderMetadataRegistry,
  WebhookHandlerConfig,
  parseCustomerName,
} from '@paykit-sdk/core';
import Stripe from 'stripe';
import {
  Checkout$inboundSchema,
  Customer$inboundSchema,
  Invoice$inboundSchema,
  Payment$inboundSchema,
  Refund$inboundSchema,
  Subscription$inboundSchema,
} from '../lib/mapper';

interface StripeMetadata extends ProviderMetadataRegistry {
  customer: Stripe.CustomerCreateParams;
  checkout: Stripe.Checkout.SessionCreateParams;
  payment: Stripe.PaymentIntentCreateParams;
  subscription: Stripe.SubscriptionCreateParams;
  refund: Stripe.RefundCreateParams;
}
export interface StripeOptions
  extends PaykitProviderOptions,
    Stripe.StripeConfig {
  apiKey: string;
}

/** @internal */
const StripeOptions$inboundSchema = schema<
  Pick<StripeOptions, 'apiKey' | 'debug'>
>()(
  Schema.object({
    apiKey: Schema.string(),
    debug: Schema.boolean().optional(),
  }).passthrough(),
);

const providerName = 'stripe';

type StripeRawEvents = {
  [K in Stripe.Event.Type as `stripe.${K}`]: Extract<
    Stripe.Event,
    { type: K }
  >;
};

export class StripeProvider
  extends AbstractPayKitProvider
  implements PayKitProvider<StripeMetadata, Stripe, StripeRawEvents>
{
  private stripe: Stripe;
  private opts: StripeOptions;

  readonly isSandbox: boolean;

  constructor(opts: StripeOptions) {
    super(StripeOptions$inboundSchema, opts, providerName);

    const { debug = true, apiKey, ...rest } = opts;

    this.stripe = new Stripe(apiKey, rest);
    this.opts = opts;
    this.isSandbox = opts.isSandbox;
  }

  readonly providerName = providerName;

  get _native() {
    return this.stripe;
  }

  createCheckout = async (
    params: CreateCheckoutSchema<StripeMetadata['checkout']>,
  ): Promise<Checkout> => {
    const { error, data } = createCheckoutSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createCheckout',
      );
    }

    const checkoutMetadata = stringifyMetadataValues(
      data.metadata ?? {},
    );

    const checkoutOptions: Stripe.Checkout.SessionCreateParams = {
      ...data.provider_metadata,
      mode:
        data.session_type === 'one_time' ? 'payment' : 'subscription',
      line_items: [{ price: data.item_id, quantity: data.quantity }],
      success_url: data.success_url,
      cancel_url: data.cancel_url,
    };

    if (params.session_type == 'recurring') {
      checkoutOptions.subscription_data = {
        metadata: checkoutMetadata,
      };
    } else if (params.session_type == 'one_time') {
      checkoutOptions.metadata = checkoutMetadata;
      checkoutOptions.payment_intent_data = {
        setup_future_usage: 'off_session',
      };
    }

    if (isIdCustomer(params.customer)) {
      checkoutOptions.customer = String(params.customer.id);
    } else if (isEmailCustomer(params.customer)) {
      checkoutOptions.customer_email = params.customer.email;
    }

    if (params.billing) {
      checkoutOptions.shipping_address_collection = {
        allowed_countries: [
          params.billing.address
            .country as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry,
        ],
      };

      checkoutOptions.shipping_options = [
        {
          shipping_rate: params.billing.carrier,
          shipping_rate_data: {
            display_name: params.billing.carrier ?? '',
            fixed_amount: {
              amount: 0,
              currency: params.billing.currency,
            },
          },
        },
      ];
    }

    const checkout =
      await this.stripe.checkout.sessions.create(checkoutOptions);

    return Checkout$inboundSchema(checkout, [
      { id: params.item_id, quantity: params.quantity },
    ]);
  };

  retrieveCheckout = async (id: string): Promise<Checkout> => {
    const checkout = await this.stripe.checkout.sessions.retrieve(
      id,
      {
        expand: ['line_items'],
      },
    );

    return Checkout$inboundSchema(
      checkout,
      checkout.line_items?.data.map(item => ({
        id: item.price?.id ?? '',
        quantity: item.quantity ?? 0,
      })) ?? [],
    );
  };

  updateCheckout = async (
    id: string,
    params: UpdateCheckoutSchema,
  ): Promise<Checkout> => {
    const { error, data } = updateCheckoutSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'updateCheckout',
      );
    }

    const originalCheckout =
      await this.stripe.checkout.sessions.retrieve(id, {
        expand: ['line_items'],
      });

    if (!originalCheckout) {
      throw new ResourceNotFoundError(
        'checkout',
        id,
        this.providerName,
      );
    }

    const updatedCheckout =
      await this.stripe.checkout.sessions.update(id, {
        ...data,
        metadata: stringifyMetadataValues(data.metadata ?? {}),
      });

    return Checkout$inboundSchema(
      updatedCheckout,
      updatedCheckout.line_items?.data.map(item => ({
        id: item.price?.id ?? '',
        quantity: item.quantity ?? 0,
      })) ?? [],
    );
  };

  deleteCheckout = async (id: string): Promise<null> => {
    await this.stripe.checkout.sessions.expire(id);

    return null;
  };

  /**
   * Customer management
   */
  createCustomer = async (
    params: CreateCustomerParams<StripeMetadata['customer']>,
  ): Promise<Customer> => {
    const { error, data } = createCustomerSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createCustomer',
      );
    }

    const { fullName } = parseCustomerName({
      name: data.name,
      email: data.email,
    });

    const customer = await this.stripe.customers.create({
      ...params,
      phone: params.phone ?? undefined,
      name: fullName,
    });

    return Customer$inboundSchema(customer);
  };

  updateCustomer = async (
    id: string,
    params: UpdateCustomerParams<StripeMetadata['customer']>,
  ): Promise<Customer> => {
    const { provider_metadata, ...rest } = params;

    const customer = await this.stripe.customers.update(id, {
      ...provider_metadata,
      ...rest,
      metadata: stringifyMetadataValues(rest.metadata ?? {}),
      phone: rest.phone ?? undefined,
    });

    return Customer$inboundSchema(customer);
  };

  deleteCustomer = async (id: string): Promise<null> => {
    await this.stripe.customers.del(id);

    return null;
  };

  retrieveCustomer = async (id: string): Promise<Customer | null> => {
    const customer = await this.stripe.customers.retrieve(id);

    if ('deleted' in customer) return null;

    return Customer$inboundSchema(customer);
  };

  createSubscription = async (
    params: CreateSubscriptionSchema<StripeMetadata['subscription']>,
  ): Promise<Subscription> => {
    const { error, data } =
      createSubscriptionSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createSubscription',
      );
    }

    if (
      !isEmailCustomer(data.customer) &&
      !isIdCustomer(data.customer)
    ) {
      throw new InvalidTypeError(
        'customer',
        'object with email or id',
        'object',
        {
          provider: this.providerName,
          method: 'createSubscription',
        },
      );
    }

    if (this.opts.debug) {
      console.info(
        'Creating subscription with default payment method, this can be overridden by passing `default_payment_method` in the provider_metadata e.g pm_xxx',
      );
    }

    const defaultPaymentMethod = data.provider_metadata
      ?.default_payment_method as string | undefined;

    const subscription = await this.stripe.subscriptions.create({
      ...data.provider_metadata,
      ...(defaultPaymentMethod && {
        default_payment_method: defaultPaymentMethod,
      }),
      customer: isIdCustomer(data.customer)
        ? String(data.customer.id)
        : data.customer.email,
      items: [{ price: data.item_id, quantity: data.quantity }],
      metadata: stringifyMetadataValues(data.metadata ?? {}),
      payment_behavior: 'default_incomplete', // customer's default payment method will be used if available
    });

    return Subscription$inboundSchema(subscription);
  };

  cancelSubscription = async (id: string): Promise<Subscription> => {
    const subscription = await this.stripe.subscriptions.cancel(id);

    return Subscription$inboundSchema(subscription);
  };

  updateSubscription = async (
    id: string,
    params: UpdateSubscriptionSchema<StripeMetadata['subscription']>,
  ): Promise<Subscription> => {
    const { error, data } =
      updateSubscriptionSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'updateSubscription',
      );
    }

    const updatedSubscription =
      await this.stripe.subscriptions.update(id, {
        ...(data.provider_metadata && { ...data.provider_metadata }),
        metadata: stringifyMetadataValues(data.metadata ?? {}),
      });

    return Subscription$inboundSchema(updatedSubscription);
  };

  retrieveSubscription = async (
    id: string,
  ): Promise<Subscription> => {
    const { error, data } = retrieveSubscriptionSchema.safeParse({
      id,
    });

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'retrieveSubscription',
      );
    }

    const subscription = await this.stripe.subscriptions.retrieve(
      data.id,
    );

    return Subscription$inboundSchema(subscription);
  };

  deleteSubscription = async (id: string): Promise<null> => {
    const { error, data } = retrieveSubscriptionSchema.safeParse({
      id,
    });

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'deleteSubscription',
      );
    }

    await this.stripe.subscriptions.cancel(data.id);

    return null;
  };

  createPayment = async (
    params: CreatePaymentSchema<StripeMetadata['payment']>,
  ): Promise<Payment> => {
    const { error, data } = createPaymentSchema.safeParse(params);

    if (error)
      throw new ValidationError(error.message.split('\n').join(' '), {
        provider: this.providerName,
        method: 'createPayment',
      });

    const { provider_metadata, customer, capture_method, ...rest } =
      data;

    const createCheckoutSession = async (
      customerEmail?: string,
      customerId?: string,
    ) => {
      const checkoutMetadata = stringifyMetadataValues({
        ...rest.metadata,
        ...(provider_metadata?.metadata ?? {}),
        [PAYKIT_METADATA_KEY]: JSON.stringify({
          itemId: data.item_id ?? null,
        }),
      });

      const { success_url } = validateRequiredKeys(
        ['success_url'],
        provider_metadata as Record<string, string>,
        'The following fields must be present in the provider_metadata of createPayment: {keys}',
      );

      const checkoutOptions: Stripe.Checkout.SessionCreateParams = {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: rest.currency,
              product_data: {
                name: `Payment for ${data.item_id || 'item'}`,
              },
              unit_amount: rest.amount,
            },
            quantity: 1,
          },
        ],
        metadata: checkoutMetadata,
        payment_intent_data: {
          capture_method:
            capture_method as Stripe.PaymentIntentCreateParams.CaptureMethod,
          setup_future_usage: 'off_session',
        },
        success_url: success_url,
      };

      if (customerId) checkoutOptions.customer = customerId;
      else if (customerEmail)
        checkoutOptions.customer_email = customerEmail;

      const checkoutSession =
        await this.stripe.checkout.sessions.create(checkoutOptions);

      return {
        id: checkoutSession.id,
        amount: rest.amount,
        currency: rest.currency,
        customer: customerId
          ? { id: customerId }
          : customerEmail
            ? { email: customerEmail }
            : null,
        status: 'pending' as const,
        metadata: omitInternalMetadata(checkoutMetadata),
        item_id: data.item_id ?? null,
        requires_action: true,
        payment_url: checkoutSession.url,
      };
    };

    let customerId: string;

    if (isEmailCustomer(customer)) {
      const existingCustomers = await this.stripe.customers.list({
        email: customer.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0)
        customerId = existingCustomers.data[0].id;
      else return createCheckoutSession(customer.email);
    } else if (isIdCustomer(customer)) {
      customerId = String(customer.id);
    } else
      throw new InvalidTypeError(
        'customer',
        'object with email or id',
        typeof customer,
        {
          provider: this.providerName,
          method: 'createPayment',
        },
      );

    // For existing customers, check if they have payment methods
    const customerWithDefaultPaymentMethod =
      await this.stripe.customers.retrieve(customerId, {
        expand: ['invoice_settings.default_payment_method'],
      });

    if ('deleted' in customerWithDefaultPaymentMethod) {
      throw new ValidationError('Customer has been deleted', {
        provider: this.providerName,
        method: 'createPayment',
      });
    }

    let defaultPaymentMethod = customerWithDefaultPaymentMethod
      .invoice_settings?.default_payment_method as string | undefined;

    if (!defaultPaymentMethod) {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
      });

      if (paymentMethods.data.length === 0) {
        // Customer exists but has no payment methods, use checkout session
        return createCheckoutSession(undefined, customerId);
      }

      defaultPaymentMethod = paymentMethods.data[0].id;
    }

    // Customer has payment methods - create payment intent
    const paymentMetadata = stringifyMetadataValues({
      ...rest.metadata,
      ...(provider_metadata?.metadata ?? {}),
      [PAYKIT_METADATA_KEY]: JSON.stringify({
        itemId: data.item_id ?? null,
      }),
    });

    const paymentIntentOptions: Stripe.PaymentIntentCreateParams = {
      currency: rest.currency,
      amount: rest.amount,
      metadata: paymentMetadata,
      customer: customerId,
      capture_method:
        capture_method as Stripe.PaymentIntentCreateParams.CaptureMethod,
      confirm: true,
      payment_method: defaultPaymentMethod,
      off_session: true,
    };

    if (data.billing) {
      paymentIntentOptions.shipping = {
        name: data.billing.address.name,
        phone: data.billing.address.phone,
        address: {
          line1: data.billing.address.line1,
          line2: data.billing.address.line2,
          city: data.billing.address.city,
          state: data.billing.address.state,
          postal_code: data.billing.address.postal_code,
          country: data.billing.address.country,
        },
      };
    }

    const payment = await this.stripe.paymentIntents.create(
      paymentIntentOptions,
    );
    return Payment$inboundSchema(payment);
  };

  updatePayment = async (
    id: string,
    params: UpdatePaymentSchema<StripeMetadata['payment']>,
  ): Promise<Payment> => {
    const { error, data } = updatePaymentSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'updatePayment',
      );
    }

    const { provider_metadata, customer, ...rest } = data;

    const payment = await this.stripe.paymentIntents.retrieve(id);

    const paymentOptions: Stripe.PaymentIntentUpdateParams = {
      ...provider_metadata,
      metadata: stringifyMetadataValues({
        ...rest.metadata,
        ...(provider_metadata?.metadata ?? {}),
      }),
    };

    if (
      [
        'requires_payment_method',
        'requires_confirmation',
        'requires_action',
      ].includes(payment.status)
    ) {
      paymentOptions.amount = rest.amount;
      paymentOptions.currency = rest.currency;
    }

    if (isIdCustomer(customer)) {
      paymentOptions.customer = String(customer.id);
    } else if (isEmailCustomer(customer)) {
      paymentOptions.receipt_email = customer.email;
    }

    const updatedPayment = await this.stripe.paymentIntents.update(
      id,
      paymentOptions,
    );

    return Payment$inboundSchema(updatedPayment);
  };

  retrievePayment = async (id: string): Promise<Payment | null> => {
    const { error, data } = retrievePaymentSchema.safeParse({ id });

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'retrievePayment',
      );
    }

    const [payment, paymentError] = await tryCatchAsync(
      this.stripe.paymentIntents.retrieve(data.id),
    );

    if (
      !payment ||
      (paymentError as unknown as Stripe.errors.StripeError)?.code ===
        'resource_missing'
    )
      return null;

    return Payment$inboundSchema(payment);
  };

  deletePayment = async (id: string): Promise<null> => {
    const { error, data } = deletePaymentSchema.safeParse({ id });

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'deletePayment',
      );
    }

    await this.stripe.paymentIntents.cancel(data.id);

    return null;
  };

  capturePayment = async (
    id: string,
    params: CapturePaymentSchema,
  ): Promise<Payment> => {
    const { error, data } = capturePaymentSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'capturePayment',
      );
    }

    const payment = await this.stripe.paymentIntents.capture(id, {
      amount_to_capture: data.amount,
    });

    return Payment$inboundSchema(payment);
  };

  cancelPayment = async (id: string): Promise<Payment> => {
    const canceledPayment =
      await this.stripe.paymentIntents.cancel(id);

    return Payment$inboundSchema(canceledPayment);
  };

  /**
   * Refund management
   */
  createRefund = async (
    params: CreateRefundSchema<StripeMetadata['refund']>,
  ): Promise<Refund> => {
    const { error, data } = createRefundSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createRefund',
      );
    }

    const { provider_metadata, ...rest } = data;

    const reason = refundReasonMatcher(rest.reason ?? '');

    const reasonMap: Record<
      string,
      Stripe.RefundCreateParams.Reason
    > = {
      duplicate: 'duplicate',
      fraudulent: 'fraudulent',
      requested_by_customer: 'requested_by_customer',
      other: 'requested_by_customer',
    };

    const stripeRefundOptions: Stripe.RefundCreateParams = {
      ...provider_metadata,
      reason: reasonMap[reason],
      amount: rest.amount,
      metadata: stringifyMetadataValues(rest.metadata ?? {}),
    };

    if (data.payment_id.startsWith('pi_')) {
      stripeRefundOptions.payment_intent = data.payment_id; // payment intent ID (modern API)
    } else {
      stripeRefundOptions.charge = data.payment_id; // charge ID (legacy API)
    }

    const refund = await this.stripe.refunds.create(
      stripeRefundOptions,
    );

    return Refund$inboundSchema(refund);
  };

  handleWebhook1 = async (
    params: WebhookHandlerConfig,
    webhookSecret: string | null,
  ): Promise<Array<WebhookEventPayload>> => {
    if (!webhookSecret) {
      throw new WebhookError(
        'webhookSecret is required for Stripe webhook verification',
        { provider: this.providerName },
      );
    }

    const { body, headersAsObject } = params;

    const headers = new Headers(headersAsObject);

    const stripeSignature = headers.get('stripe-signature') as string;

    if (!stripeSignature) {
      throw new WebhookError('Missing Stripe signature', {
        provider: this.providerName,
      });
    }

    const event = this.stripe.webhooks.constructEvent(
      body,
      stripeSignature,
      webhookSecret,
    );

    type StripeEventLiteral = typeof event.type;

    const stripePaymentIntentUpdateEventsWithHandlers: Array<StripeEventLiteral> =
      [
        'payment_intent.processing',
        'payment_intent.requires_action',
        'payment_intent.amount_capturable_updated',
        'payment_intent.partially_funded',
      ];

    const webhookHandlers: Partial<
      Record<
        StripeEventLiteral,
        (
          event: Stripe.Event,
        ) => Promise<Array<WebhookEventPayload> | null>
      >
    > = {
      /**
       * Invoice
       */
      'checkout.session.completed': async (event: Stripe.Event) => {
        const data = event.data.object as Stripe.Checkout.Session;

        if (data.mode !== 'payment') return null;

        const customFields = data.custom_fields.reduce(
          (acc, field) => {
            if (field.type == 'dropdown') {
              acc[field.key] = field.dropdown?.value;
            } else if (field.type == 'text') {
              acc[field.key] = field.text?.value;
            } else if (field.type == 'numeric') {
              acc[field.key] = field.numeric?.value;
            }
            return acc;
          },
          {} as Record<string, any>,
        );

        const invoiceData = {
          id: data.id,
          status: invoiceStatusSchema.parse('paid'),
          paid_at: new Date(event.created * 1000).toISOString(),
          amount_paid: data.amount_total ?? 0,
          currency: data.currency ?? '',
          metadata: omitInternalMetadata(data.metadata ?? {}),
          customer: {
            id:
              typeof data.customer === 'string'
                ? data.customer
                : (data.customer?.id ?? ''),
          },
          billing_mode: billingModeSchema.parse('one_time'),
          subscription_id: null,
          custom_fields: customFields ?? null,
          line_items:
            data.line_items?.data.map(item => ({
              id: item.price!.id,
              quantity: item.quantity!,
            })) ?? [],
        };

        const invoice = {
          type: 'invoice.generated' as const,
          created: event.created,
          id: event.id,
          data: invoiceData,
        };

        // Handle consumeble purchase
        return [paykitEvent$InboundSchema<Invoice>(invoice)];
      },

      'invoice.paid': async (event: Stripe.Event) => {
        const data = event.data.object as Stripe.Invoice;

        const relevantBillingReasons = [
          'subscription_create',
          'subscription_cycle',
        ];

        if (
          data.status !== 'paid' &&
          !relevantBillingReasons.includes(data.billing_reason!)
        )
          return null;

        const invoice = {
          type: 'invoice.generated' as const,
          created: event.created,
          id: event.id,
          data: Invoice$inboundSchema({
            ...data,
            billingMode: 'recurring',
          }),
        };

        /**
         * Handle subscription creation and cycle
         */
        return [paykitEvent$InboundSchema<Invoice>(invoice)];
      },

      /**
       * Customer
       */
      'customer.created': async (event: Stripe.Event) => {
        const data = event.data.object as Stripe.Customer;

        const customer = {
          type: 'customer.created' as const,
          created: event.created,
          id: event.id,
          data: Customer$inboundSchema(data),
        };

        return [paykitEvent$InboundSchema<Customer>(customer)];
      },

      'customer.updated': async (event: Stripe.Event) => {
        const data = event.data.object as Stripe.Customer;

        const customer = {
          type: 'customer.updated' as const,
          created: event.created,
          id: event.id,
          data: Customer$inboundSchema(data),
        };

        return [paykitEvent$InboundSchema<Customer>(customer)];
      },

      'customer.deleted': async (event: Stripe.Event) => {
        const customer = {
          type: 'customer.deleted' as const,
          created: event.created,
          id: event.id,
          data: null,
        };

        return [paykitEvent$InboundSchema<null>(customer)];
      },

      /**
       * Subscription
       */
      'customer.subscription.created': async (
        event: Stripe.Event,
      ) => {
        const data = event.data.object as Stripe.Subscription;

        const subscription = Subscription$inboundSchema(data);

        return [
          paykitEvent$InboundSchema<Subscription>({
            type: 'subscription.created',
            created: event.created,
            id: event.id,
            data: subscription,
          }),
        ];
      },

      'customer.subscription.updated': async (
        event: Stripe.Event,
      ) => {
        const data = event.data.object as Stripe.Subscription;

        const subscription = Subscription$inboundSchema(data);

        return [
          paykitEvent$InboundSchema<Subscription>({
            type: 'subscription.updated',
            created: event.created,
            id: event.id,
            data: subscription,
          }),
        ];
      },

      'customer.subscription.deleted': async (
        event: Stripe.Event,
      ) => {
        const subscription = null;

        return [
          paykitEvent$InboundSchema<null>({
            type: 'subscription.canceled',
            created: event.created,
            id: event.id,
            data: subscription,
          }),
        ];
      },

      'payment_intent.created': async (event: Stripe.Event) => {
        const data = event.data.object as Stripe.PaymentIntent;

        const payment = Payment$inboundSchema(data);

        return [
          paykitEvent$InboundSchema<Payment>({
            type: 'payment.created',
            created: event.created,
            id: event.id,
            data: payment,
          }),
        ];
      },

      ...stripePaymentIntentUpdateEventsWithHandlers.map(
        () => async (event: Stripe.Event) => {
          const data = event.data.object as Stripe.PaymentIntent;

          const payment = Payment$inboundSchema(data);

          return [
            paykitEvent$InboundSchema<Payment>({
              type: 'payment.updated',
              created: event.created,
              id: event.id,
              data: payment,
            }),
          ];
        },
      ),

      'payment_intent.canceled': async (event: Stripe.Event) => {
        const data = event.data.object as Stripe.PaymentIntent;

        const payment = Payment$inboundSchema(data);

        return [
          paykitEvent$InboundSchema<Payment>({
            type: 'payment.failed',
            created: event.created,
            id: event.id,
            data: payment,
          }),
        ];
      },

      'refund.created': async (event: Stripe.Event) => {
        const data = event.data.object as Stripe.Refund;

        const refund = Refund$inboundSchema(data);

        return [
          paykitEvent$InboundSchema<Refund>({
            type: 'refund.created',
            created: event.created,
            id: event.id,
            data: refund,
          }),
        ];
      },
    };

    const handler = webhookHandlers[event.type];

    if (!handler)
      throw new WebhookError(`Unhandled event type: ${event.type}`, {
        provider: this.providerName,
      });

    const result = await handler(event);

    if (!result) {
      console.log(
        `Skipping event ${event.type} for provider: ${this.providerName} as no action needed`,
      );

      return [];
    }

    return result;
  };

  handleWebhook = async (
    params: WebhookHandlerConfig,
    webhookSecret: string | null,
  ): Promise<Array<WebhookEventPayload<StripeRawEvents>>> => {
    if (!webhookSecret) {
      throw new WebhookError(
        'webhookSecret is required for Stripe webhook verification',
        { provider: this.providerName },
      );
    }

    const { body, headersAsObject } = params;

    const stripeSignature = headersAsObject[
      'stripe-signature'
    ] as string;

    if (!stripeSignature) {
      throw new WebhookError('Missing Stripe signature', {
        provider: this.providerName,
      });
    }

    const event = this.stripe.webhooks.constructEvent(
      body,
      stripeSignature,
      webhookSecret,
    );

    const results: Array<WebhookEventPayload<StripeRawEvents>> = [];

    results.push({
      id: event.id,
      type: `stripe.${event.type}`,
      created: event.created,
      data: event as any,
      is_raw: true,
    });

    const processStandardMapping = async (
      ev: Stripe.Event,
    ): Promise<Array<
      WebhookEventPayload<StripeRawEvents>
    > | null> => {
      switch (ev.type) {
        case 'checkout.session.completed': {
          const data = ev.data.object as Stripe.Checkout.Session;
          if (data.mode !== 'payment') return null;

          const customFields = data.custom_fields.reduce(
            (acc, field) => {
              if (field.type === 'dropdown')
                acc[field.key] = field.dropdown?.value;
              else if (field.type === 'text')
                acc[field.key] = field.text?.value;
              else if (field.type === 'numeric')
                acc[field.key] = field.numeric?.value;
              return acc;
            },
            {} as Record<string, any>,
          );

          const invoiceData = {
            id: data.id,
            status: invoiceStatusSchema.parse('paid'),
            paid_at: new Date(ev.created * 1000).toISOString(),
            amount_paid: data.amount_total ?? 0,
            currency: data.currency ?? '',
            metadata: omitInternalMetadata(data.metadata ?? {}),
            customer: {
              id:
                typeof data.customer === 'string'
                  ? data.customer
                  : (data.customer?.id ?? ''),
            },
            billing_mode: billingModeSchema.parse('one_time'),
            subscription_id: null,
            custom_fields: customFields ?? null,
            line_items:
              data.line_items?.data.map(item => ({
                id: item.price!.id,
                quantity: item.quantity!,
              })) ?? [],
          };

          return [
            paykitEvent$InboundSchema<Invoice>({
              type: 'invoice.generated',
              created: ev.created,
              id: ev.id,
              data: invoiceData,
            }),
          ];
        }

        case 'invoice.paid': {
          const data = ev.data.object as Stripe.Invoice;
          const relevantBillingReasons = [
            'subscription_create',
            'subscription_cycle',
          ];
          if (
            data.status !== 'paid' ||
            !relevantBillingReasons.includes(data.billing_reason!)
          ) {
            return null;
          }
          return [
            paykitEvent$InboundSchema<Invoice>({
              type: 'invoice.generated',
              created: ev.created,
              id: ev.id,
              data: Invoice$inboundSchema({
                ...data,
                billingMode: 'recurring',
              }),
            }),
          ];
        }

        case 'customer.created':
          return [
            paykitEvent$InboundSchema<Customer>({
              type: 'customer.created',
              created: ev.created,
              id: ev.id,
              data: Customer$inboundSchema(
                ev.data.object as Stripe.Customer,
              ),
            }),
          ];

        case 'customer.updated':
          return [
            paykitEvent$InboundSchema<Customer>({
              type: 'customer.updated',
              created: ev.created,
              id: ev.id,
              data: Customer$inboundSchema(
                ev.data.object as Stripe.Customer,
              ),
            }),
          ];

        case 'customer.deleted':
          return [
            paykitEvent$InboundSchema<null>({
              type: 'customer.deleted',
              created: ev.created,
              id: ev.id,
              data: null,
            }),
          ];

        case 'customer.subscription.created':
          return [
            paykitEvent$InboundSchema<Subscription>({
              type: 'subscription.created',
              created: ev.created,
              id: ev.id,
              data: Subscription$inboundSchema(
                ev.data.object as Stripe.Subscription,
              ),
            }),
          ];

        case 'customer.subscription.updated':
          return [
            paykitEvent$InboundSchema<Subscription>({
              type: 'subscription.updated',
              created: ev.created,
              id: ev.id,
              data: Subscription$inboundSchema(
                ev.data.object as Stripe.Subscription,
              ),
            }),
          ];

        case 'customer.subscription.deleted':
          return [
            paykitEvent$InboundSchema<null>({
              type: 'subscription.canceled',
              created: ev.created,
              id: ev.id,
              data: null,
            }),
          ];

        case 'payment_intent.created':
          return [
            paykitEvent$InboundSchema<Payment>({
              type: 'payment.created',
              created: ev.created,
              id: ev.id,
              data: Payment$inboundSchema(
                ev.data.object as Stripe.PaymentIntent,
              ),
            }),
          ];

        case 'payment_intent.succeeded':
          return [
            paykitEvent$InboundSchema<Payment>({
              type: 'payment.succeeded',
              created: ev.created,
              id: ev.id,
              data: Payment$inboundSchema(
                ev.data.object as Stripe.PaymentIntent,
              ),
            }),
          ];

        case 'payment_intent.canceled':
        case 'payment_intent.payment_failed':
          return [
            paykitEvent$InboundSchema<Payment>({
              type: 'payment.failed',
              created: ev.created,
              id: ev.id,
              data: Payment$inboundSchema(
                ev.data.object as Stripe.PaymentIntent,
              ),
            }),
          ];

        case 'payment_intent.processing':
        case 'payment_intent.requires_action':
        case 'payment_intent.amount_capturable_updated':
        case 'payment_intent.partially_funded':
          return [
            paykitEvent$InboundSchema<Payment>({
              type: 'payment.updated',
              created: ev.created,
              id: ev.id,
              data: Payment$inboundSchema(
                ev.data.object as Stripe.PaymentIntent,
              ),
            }),
          ];

        case 'refund.created':
          return [
            paykitEvent$InboundSchema<Refund>({
              type: 'refund.created',
              created: ev.created,
              id: ev.id,
              data: Refund$inboundSchema(
                ev.data.object as Stripe.Refund,
              ),
            }),
          ];

        default:
          return null;
      }
    };

    const standardMappedEvents = await processStandardMapping(event);

    if (standardMappedEvents) {
      results.push(...standardMappedEvents);
    } else {
      if (this.opts.debug) {
        console.info(
          `No standard mapping found for Stripe event: ${event.type}. It is still available as a raw event.`,
        );
      }
    }

    return results;
  };
}
