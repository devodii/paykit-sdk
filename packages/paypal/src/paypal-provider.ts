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
  HandleWebhookParams,
  UpdateCheckoutSchema,
  CreateSubscriptionSchema,
  CreatePaymentSchema,
  Payment,
  UpdatePaymentSchema,
  CreateRefundSchema,
  Refund,
  validateRequiredKeys,
  ProviderNotSupportedError,
  ConstraintViolationError,
  ResourceNotFoundError,
  WebhookError,
  NotImplementedError,
  schema,
  AbstractPayKitProvider,
  OperationFailedError,
  createCheckoutSchema,
  ValidationError,
  Schema,
} from '@paykit-sdk/core';
import {
  CheckoutPaymentIntent,
  Client,
  Environment,
  LogLevel,
  OrdersController,
  PaymentsController,
  OrderApplicationContextUserAction,
} from '@paypal/paypal-server-sdk';
import { SubscriptionsController } from './controllers/subscription';
import { WebhookController } from './controllers/webhook';
import { VerifyWebhookStatus } from './schema';
import {
  paykitCheckout$InboundSchema,
  paykitPayment$InboundSchema,
  paykitRefund$InboundSchema,
  paykitPaymentWebhook$InboundSchema,
  paykitPaymentCaptureWebhook$InboundSchema,
  paykitRefundWebhook$InboundSchema,
  paykitSubscriptionWebhook$InboundSchema,
} from './utils/mapper';

const PAYPAL_METADATA_MAX_LENGTH = 127;

export interface PayPalOptions extends PaykitProviderOptions {
  /**
   * The client ID for the PayPal API
   */
  clientId: string;

  /**
   * The client secret for the PayPal API
   */
  clientSecret: string;
}

const paypalOptionsSchema = schema<PayPalOptions>()(
  Schema.object({
    clientId: Schema.string(),
    clientSecret: Schema.string(),
    isSandbox: Schema.boolean(),
    debug: Schema.boolean().optional(),
  }),
);

const providerName = 'paypal';
export class PayPalProvider extends AbstractPayKitProvider implements PayKitProvider {
  readonly providerName = providerName;

  private client: Client;
  private ordersController: OrdersController;
  private paymentsController: PaymentsController;
  private subscriptionsController: SubscriptionsController;
  private webhookController: WebhookController;

  constructor(config: PayPalOptions) {
    super(paypalOptionsSchema, config, providerName);

    const { clientId, clientSecret, isSandbox = true, debug } = config;

    const environment = isSandbox ? Environment.Sandbox : Environment.Production;

    this.client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
      },
      timeout: 0,
      environment,
      logging: {
        logLevel: debug ? LogLevel.Info : LogLevel.Error,
        logRequest: { logBody: debug },
        logResponse: { logHeaders: debug },
      },
    });

    this.ordersController = new OrdersController(this.client);
    this.paymentsController = new PaymentsController(this.client);
    this.subscriptionsController = new SubscriptionsController(this.client);
    this.webhookController = new WebhookController(this.client);
  }

  /**
   * Checkout management
   * In PayPal, Order IS the checkout
   */
  createCheckout = async (params: CreateCheckoutSchema): Promise<Checkout> => {
    const { error, data } = createCheckoutSchema.safeParse(params);

    if (error)
      throw ValidationError.fromZodError(error, this.providerName, 'createCheckout');

    const stringifiedMetadata = JSON.stringify(data.metadata);

    if (stringifiedMetadata.length > PAYPAL_METADATA_MAX_LENGTH) {
      throw new ConstraintViolationError('Metadata exceeds maximum length', {
        value: stringifiedMetadata.length,
        limit: PAYPAL_METADATA_MAX_LENGTH,
        provider: this.providerName,
      });
    }

    const {
      currency = 'USD',
      amount = '0',
      itemName = 'Untitled Item',
    } = validateRequiredKeys(
      ['currency', 'amount', 'itemName'],
      data.provider_metadata as Record<string, string>,
      'Missing required parameters in provider_metadata: {keys}',
    );

    // Calculate unit amount from total amount and quantity
    const totalAmount = parseFloat(amount);
    const quantity = data.quantity || 1;
    const unitAmount = (totalAmount / quantity).toFixed(2);

    const orderOptionsBody: Parameters<OrdersController['createOrder']>[0]['body'] = {
      intent: CheckoutPaymentIntent.Capture,
      payer: {
        ...(typeof data.customer === 'string' && { payerId: data.customer }),
        ...(typeof data.customer === 'object' &&
          'email' in data.customer && { emailAddress: data.customer.email }),
      },
      purchaseUnits: [
        {
          amount: {
            currencyCode: currency,
            value: amount,
            breakdown: { itemTotal: { currencyCode: currency, value: amount } },
          },
          customId: stringifiedMetadata,
          items: [
            {
              sku: data.item_id,
              quantity: quantity.toString(),
              name: itemName,
              unitAmount: { currencyCode: currency, value: unitAmount },
            },
          ],
        },
      ],
      applicationContext: {
        userAction: OrderApplicationContextUserAction.PayNow,
        returnUrl: data.success_url,
        cancelUrl: data.cancel_url,
      },
      ...(data.provider_metadata && { ...data.provider_metadata }),
    };

    if (data.billing) {
      orderOptionsBody.purchaseUnits[0].shipping = {
        name: { fullName: data.billing.address.name },
        address: {
          addressLine1: data.billing.address.line1,
          addressLine2: data.billing.address.line2,
          adminArea1: data.billing.address.city,
          adminArea2: data.billing.address.state,
          postalCode: data.billing.address.postal_code,
          countryCode: data.billing.address.country,
        },
        ...(data.billing.address.phone && {
          phoneNumber: {
            nationalNumber: data.billing.address.phone,
            countryCode: data.billing.address.country,
          },
        }),
      };
    }

    try {
      const order = await this.ordersController.createOrder({ body: orderOptionsBody });

      return paykitCheckout$InboundSchema(order.result);
    } catch (error) {
      throw new OperationFailedError('createCheckout', this.providerName, {
        cause: error instanceof Error ? error : new Error('Unknown error'),
      });
    }
  };

  retrieveCheckout = async (id: string): Promise<Checkout> => {
    try {
      const order = await this.ordersController.getOrder({ id });

      if (!order.result) throw new ResourceNotFoundError('Order', id);

      return paykitCheckout$InboundSchema(order.result);
    } catch (error) {
      throw new OperationFailedError('retrieveCheckout', this.providerName, {
        cause: error instanceof Error ? error : new Error('Unknown error'),
      });
    }
  };

  updateCheckout = async (
    id: string,
    params: UpdateCheckoutSchema,
  ): Promise<Checkout> => {
    throw new ProviderNotSupportedError('updateCheckout', this.providerName, {
      reason:
        'PayPal does not support updating orders. Cancel and create a new order instead.',
    });
  };

  deleteCheckout = async (id: string): Promise<null> => {
    throw new ProviderNotSupportedError('deleteCheckout', this.providerName, {
      reason: 'PayPal orders cannot be deleted. They expire automatically.',
    });
  };

  createCustomer = async (params: CreateCustomerParams): Promise<Customer> => {
    throw new ProviderNotSupportedError('createCustomer', this.providerName, {
      reason: 'PayPal does not support creating customers',
      alternative: 'Use Payer information within orders or implement PayPal Vault API',
    });
  };

  updateCustomer = async (
    id: string,
    params: UpdateCustomerParams,
  ): Promise<Customer> => {
    throw new ProviderNotSupportedError('updateCustomer', this.providerName, {
      reason: 'PayPal does not support standalone customer management',
    });
  };

  deleteCustomer = async (id: string): Promise<null> => {
    throw new ProviderNotSupportedError('deleteCustomer', this.providerName, {
      reason: 'PayPal does not support deleting customers',
    });
  };

  retrieveCustomer = async (id: string): Promise<Customer | null> => {
    throw new ProviderNotSupportedError('retrieveCustomer', this.providerName, {
      reason: 'PayPal does not support retrieving customers',
    });
  };

  createSubscription = async (
    params: CreateSubscriptionSchema,
  ): Promise<Subscription> => {
    const subscription = await this.subscriptionsController.createSubscription({
      body: params,
    });
    return subscription as unknown as Subscription;
  };

  cancelSubscription = async (id: string): Promise<Subscription> => {
    const subscription = await this.subscriptionsController.cancelSubscription({
      subscriptionId: id,
      reason: 'Customer requested cancellation',
    });

    return subscription as unknown as Subscription;
  };

  updateSubscription = async (
    id: string,
    params: UpdateSubscriptionSchema,
  ): Promise<Subscription> => {
    const stringifiedMetadata = JSON.stringify(params.metadata);

    if (stringifiedMetadata.length > PAYPAL_METADATA_MAX_LENGTH) {
      throw new ConstraintViolationError('Metadata exceeds maximum length', {
        value: stringifiedMetadata.length,
        limit: PAYPAL_METADATA_MAX_LENGTH,
        provider: this.providerName,
      });
    }
    const subscription = await this.subscriptionsController.updateSubscription({
      subscriptionId: id,
      metadata: params.metadata ?? {},
    });

    return subscription as unknown as Subscription;
  };

  retrieveSubscription = async (id: string): Promise<Subscription> => {
    const subscription = await this.subscriptionsController.retrieveSubscription({
      subscriptionId: id,
    });

    return subscription as unknown as Subscription;
  };

  deleteSubscription = async (id: string): Promise<null> => {
    throw new NotImplementedError('deleteSubscription', 'PayPal', {
      futureSupport: false,
    });
  };

  /**
   * Payment management
   * In PayPal, Order IS the payment
   */
  createPayment = async (params: CreatePaymentSchema): Promise<Payment> => {
    const stringifiedMetadata = JSON.stringify(params.metadata);

    if (stringifiedMetadata.length > PAYPAL_METADATA_MAX_LENGTH) {
      throw new ConstraintViolationError('Metadata exceeds maximum length', {
        value: stringifiedMetadata.length,
        limit: PAYPAL_METADATA_MAX_LENGTH,
        provider: this.providerName,
      });
    }

    const orderOptionsBody: Parameters<OrdersController['createOrder']>[0]['body'] = {
      intent: CheckoutPaymentIntent.Capture,
      payer: {
        ...(typeof params.customer === 'string' && { payerId: params.customer }),
        ...(typeof params.customer === 'object' &&
          'email' in params.customer && { emailAddress: params.customer.email }),
      },
      purchaseUnits: [
        {
          amount: { currencyCode: params.currency, value: params.amount.toString() },
          customId: stringifiedMetadata,
        },
      ],
    };

    if (params.billing) {
      orderOptionsBody.purchaseUnits[0].shipping = {
        name: { fullName: params.billing.address.name },
        address: {
          addressLine1: params.billing.address.line1,
          addressLine2: params.billing.address.line2,
          adminArea1: params.billing.address.city,
          adminArea2: params.billing.address.state,
          postalCode: params.billing.address.postal_code,
          countryCode: params.billing.address.country,
        },
        ...(params.billing.address.phone && {
          phoneNumber: {
            nationalNumber: params.billing.address.phone,
            countryCode: params.billing.address.country,
          },
        }),
      };
    }

    try {
      const order = await this.ordersController.createOrder({ body: orderOptionsBody });

      return paykitPayment$InboundSchema(order.result);
    } catch (error) {
      throw new OperationFailedError('createPayment', this.providerName, {
        cause: error instanceof Error ? error : new Error('Unknown error'),
      });
    }
  };

  updatePayment = async (id: string, params: UpdatePaymentSchema): Promise<Payment> => {
    throw new ProviderNotSupportedError('updatePayment', this.providerName, {
      reason: 'PayPal does not support updating orders.',
    });
  };

  retrievePayment = async (id: string): Promise<Payment | null> => {
    try {
      const order = await this.ordersController.getOrder({ id });

      if (!order.result) throw new ResourceNotFoundError('Order', id);

      return paykitPayment$InboundSchema(order.result);
    } catch (error) {
      throw new OperationFailedError('retrievePayment', this.providerName, {
        cause: error instanceof Error ? error : new Error('Unknown error'),
      });
    }
  };

  deletePayment = async (id: string): Promise<null> => {
    throw new ProviderNotSupportedError('deletePayment', this.providerName, {
      reason: 'PayPal orders cannot be deleted. They expire automatically.',
    });
  };

  capturePayment = async (id: string): Promise<Payment> => {
    try {
      const captured = await this.ordersController.captureOrder({ id });

      if (!captured.result) throw new ResourceNotFoundError('Order', id);

      return paykitPayment$InboundSchema(captured.result);
    } catch (error) {
      throw new OperationFailedError('capturePayment', this.providerName, {
        cause: error instanceof Error ? error : new Error('Unknown error'),
      });
    }
  };

  cancelPayment = async (id: string): Promise<Payment> => {
    // PayPal doesn't have explicit cancel, but you can void authorizations
    throw new ProviderNotSupportedError('cancelPayment', this.providerName, {
      reason:
        'PayPal order cancellation not directly supported. Orders expire automatically.',
    });
  };

  /**
   * Refund management
   */
  createRefund = async (params: CreateRefundSchema): Promise<Refund> => {
    try {
      const order = await this.ordersController.getOrder({ id: params.payment_id });

      if (!order.result) throw new ResourceNotFoundError('Order', params.payment_id);

      const captureIds =
        order.result.purchaseUnits?.[0]?.payments?.captures?.map(c => c.id!) || [];

      if (captureIds.length === 0) {
        throw new ResourceNotFoundError('Capture', params.payment_id, this.providerName);
      }

      const currencyCode = order.result.purchaseUnits?.[0]?.amount?.currencyCode || 'USD';
      const amount = params.amount
        ? params.amount.toString()
        : order.result.purchaseUnits?.[0]?.amount?.value || '0';

      const refund = await this.paymentsController.refundCapturedPayment({
        captureId: captureIds[0],
        body: { amount: { currencyCode, value: amount } },
      });

      if (!refund.result) throw new ResourceNotFoundError('Refund', params.payment_id);

      return paykitRefund$InboundSchema(refund.result);
    } catch (error) {
      throw new OperationFailedError('createRefund', this.providerName, {
        cause: error instanceof Error ? error : new Error('Unknown error'),
      });
    }
  };

  /**
   * Webhook management
   */
  handleWebhook = async (
    params: HandleWebhookParams,
  ): Promise<Array<WebhookEventPayload>> => {
    const { body, headers, webhookSecret: webhookId } = params;

    const { result } = await this.webhookController.verifyWebhook({
      authAlgo: headers.get('paypal-auth-algo') as string,
      certUrl: headers.get('paypal-cert-url') as string,
      transmissionId: headers.get('paypal-transmission-id') as string,
      transmissionSig: headers.get('paypal-transmission-sig') as string,
      transmissionTime: headers.get('paypal-transmission-time') as string,
      webhookId,
      webhookEvent: JSON.parse(body),
    });

    if (result.verification_status !== VerifyWebhookStatus.SUCCESS) {
      throw new WebhookError('Webhook verification failed', {
        provider: this.providerName,
      });
    }

    const event = JSON.parse(body);
    const eventType = event.event_type;

    const webhookHandlers: Record<string, () => Promise<Array<WebhookEventPayload>>> = {
      'CHECKOUT.ORDER.APPROVED': async () => {
        const payment = paykitPaymentWebhook$InboundSchema(
          event.resource as Record<string, unknown>,
        );

        return [
          paykitEvent$InboundSchema<Payment>({
            type: 'payment.created',
            created: Date.now() / 1000,
            id: event.id,
            data: payment,
          }),
        ];
      },

      'CHECKOUT.ORDER.COMPLETED': async () => {
        const payment = paykitPaymentWebhook$InboundSchema(
          event.resource as Record<string, unknown>,
        );

        return [
          paykitEvent$InboundSchema<Payment>({
            type: 'payment.updated',
            created: Date.now() / 1000,
            id: event.id,
            data: payment,
          }),
        ];
      },

      'PAYMENT.CAPTURE.COMPLETED': async () => {
        const payment = paykitPaymentCaptureWebhook$InboundSchema(
          event.resource as Record<string, unknown>,
        );

        return [
          paykitEvent$InboundSchema<Payment>({
            type: 'payment.updated',
            created: Date.now() / 1000,
            id: event.id,
            data: payment,
          }),
        ];
      },

      'PAYMENT.CAPTURE.REFUNDED': async () => {
        const refund = paykitRefundWebhook$InboundSchema(
          event.resource as Record<string, unknown>,
        );

        return [
          paykitEvent$InboundSchema<Refund>({
            type: 'refund.created',
            created: Date.now() / 1000,
            id: event.id,
            data: refund,
          }),
        ];
      },

      'BILLING.SUBSCRIPTION.CREATED': async () => {
        const subscription = paykitSubscriptionWebhook$InboundSchema(
          event.resource as Record<string, unknown>,
        );

        return [
          paykitEvent$InboundSchema<Subscription>({
            type: 'subscription.created',
            created: Date.now() / 1000,
            id: event.id,
            data: subscription,
          }),
        ];
      },

      'BILLING.SUBSCRIPTION.UPDATED': async () => {
        const subscription = paykitSubscriptionWebhook$InboundSchema(
          event.resource as Record<string, unknown>,
        );

        return [
          paykitEvent$InboundSchema<Subscription>({
            type: 'subscription.updated',
            created: Date.now() / 1000,
            id: event.id,
            data: subscription,
          }),
        ];
      },

      'BILLING.SUBSCRIPTION.SUSPENDED': async () => {
        const subscription = paykitSubscriptionWebhook$InboundSchema(
          event.resource as Record<string, unknown>,
        );

        return [
          paykitEvent$InboundSchema<Subscription>({
            type: 'subscription.updated',
            created: Date.now() / 1000,
            id: event.id,
            data: subscription,
          }),
        ];
      },

      'BILLING.SUBSCRIPTION.CANCELLED': async () => {
        const subscription = paykitSubscriptionWebhook$InboundSchema(
          event.resource as Record<string, unknown>,
        );

        return [
          paykitEvent$InboundSchema<Subscription>({
            type: 'subscription.canceled',
            created: Date.now() / 1000,
            id: event.id,
            data: subscription,
          }),
        ];
      },

      'BILLING.SUBSCRIPTION.EXPIRED': async () => {
        const subscription = paykitSubscriptionWebhook$InboundSchema(
          event.resource as Record<string, unknown>,
        );

        return [
          paykitEvent$InboundSchema<Subscription>({
            type: 'subscription.canceled',
            created: Date.now() / 1000,
            id: event.id,
            data: subscription,
          }),
        ];
      },
    };

    const handler = webhookHandlers[eventType];

    if (!handler) {
      throw new WebhookError(`Unhandled event type: ${eventType}`, {
        provider: this.providerName,
      });
    }

    return await handler();
  };
}
