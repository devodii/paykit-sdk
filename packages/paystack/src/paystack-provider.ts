import {
  AbstractPayKitProvider,
  CapturePaymentSchema,
  Checkout,
  CreateCheckoutSchema,
  CreateCustomerParams,
  CreatePaymentSchema,
  CreateRefundSchema,
  CreateSubscriptionSchema,
  Customer,
  HTTPClient,
  InvalidTypeError,
  OperationFailedError,
  PAYKIT_METADATA_KEY,
  PayKitProvider,
  PaykitProviderOptions,
  Payment,
  ProviderMetadataRegistry,
  ProviderNotSupportedError,
  Refund,
  ResourceNotFoundError,
  Subscription,
  UpdateCheckoutSchema,
  UpdateCustomerParams,
  UpdatePaymentSchema,
  UpdateSubscriptionSchema,
  ValidationError,
  WebhookError,
  WebhookEventPayload,
  WebhookHandlerConfig,
  createCheckoutSchema,
  createCustomerSchema,
  createPaymentSchema,
  createRefundSchema,
  isEmailCustomer,
  isIdCustomer,
  parseCustomerName,
  paykitEvent$InboundSchema,
  schema,
  stringifyMetadataValues,
  validateRequiredKeys,
} from '@paykit-sdk/core';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import {
  PaystackCustomer,
  PaystackInitializeResponse,
  PaystackRawEvents,
  PaystackRefund,
  PaystackResponse,
  PaystackSubscription,
  PaystackTransaction,
  PaystackWebhookEvent,
} from './schema';
import {
  Checkout$inboundSchema,
  Customer$inboundSchema,
  Invoice$inboundSchema,
  Payment$inboundSchema,
  Refund$inboundSchema,
  Subscription$inboundSchema,
} from './utils/mapper';

interface PaystackMetadata extends ProviderMetadataRegistry {
  refund: {
    merchant_note: string;
    customer_note: string;
  };
  checkout?: {
    amount?: number;
    currency?: string;
  };
}

export interface PaystackOptions extends PaykitProviderOptions {
  /**
   * Paystack secret key
   */
  secretKey: string;
}

const paystackOptionsSchema = schema<PaystackOptions>()(
  z.object({
    secretKey: z.string(),
    isSandbox: z.boolean(),
    debug: z.boolean().optional(),
  }),
);

const providerName = 'paystack';

export class PaystackProvider
  extends AbstractPayKitProvider
  implements PayKitProvider<PaystackMetadata, null, PaystackRawEvents>
{
  readonly providerName = providerName;
  private readonly _client: HTTPClient;
  private readonly opts: PaystackOptions;
  readonly isSandbox: boolean;

  constructor(opts: PaystackOptions) {
    super(paystackOptionsSchema, opts, providerName);

    this.opts = opts;

    this._client = new HTTPClient({
      baseUrl: 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${opts.secretKey}`,
        'Content-Type': 'application/json',
      },
      retryOptions: {
        max: 3,
        baseDelay: 1000,
        debug: opts.debug ?? false,
      },
    });
    this.isSandbox = opts.isSandbox;
  }

  get _native() {
    return null;
  }

  private _toCamel(obj: any): any {
    if (Array.isArray(obj)) return obj.map(v => this._toCamel(v));
    if (
      obj !== null &&
      typeof obj === 'object' &&
      obj.constructor === Object
    ) {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [
          k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
          this._toCamel(v),
        ]),
      );
    }
    return obj;
  }

  private async unwrap<T>(
    result: {
      ok: boolean;
      value?: PaystackResponse<T>;
      error?: unknown;
    },
    operation: string,
  ): Promise<T> {
    if (!result.ok || !result.value?.status) {
      throw new OperationFailedError(operation, this.providerName, {
        cause: new Error(
          result.value?.message ??
            JSON.stringify(result.error) ??
            'Unknown error',
        ),
      });
    }

    return this._toCamel(result.value.data) as T;
  }

  private async initializeTransaction(params: {
    email: string;
    amount: number;
    currency: string;
    metadata: Record<string, unknown>;
    callbackUrl?: string;
    providerMetadata?: Record<string, unknown>;
  }): Promise<PaystackInitializeResponse> {
    const body = {
      ...params.providerMetadata,
      email: params.email,
      amount: params.amount,
      currency: params.currency.toUpperCase(),
      reference: crypto.randomUUID(),
      ...(params.callbackUrl && { callback_url: params.callbackUrl }),
      metadata: stringifyMetadataValues(params.metadata) as Record<
        string,
        string
      >,
    };

    const response = await this._client.post<
      PaystackResponse<PaystackInitializeResponse>
    >('/transaction/initialize', { body: JSON.stringify(body) });

    return this.unwrap(response, 'initializeTransaction');
  }

  createCheckout = async (
    params: CreateCheckoutSchema<PaystackMetadata['checkout']>,
  ): Promise<Checkout> => {
    const { error, data } = createCheckoutSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createCheckout',
      );
    }

    if (!isEmailCustomer(data.customer)) {
      throw new InvalidTypeError(
        'customer',
        'object with email',
        'string (customer ID)',
        { provider: this.providerName, method: 'createCheckout' },
      );
    }

    const { amount, currency = 'NGN' } = validateRequiredKeys(
      ['amount', 'currency'],
      (data.provider_metadata as Record<string, string>) ?? {},
      'Missing required provider metadata: {keys}',
    );

    const metadata = {
      ...stringifyMetadataValues(data.metadata ?? {}),
      [PAYKIT_METADATA_KEY]: JSON.stringify({
        item_id: data.item_id,
        quantity: data.quantity,
        type: data.session_type,
      }),
    };

    const parsedAmount = parseInt(amount, 10);
    const upperCurrency = currency.toUpperCase();

    const initData = await this.initializeTransaction({
      email: data.customer.email,
      amount: parsedAmount,
      currency: upperCurrency,
      metadata,
      callbackUrl: data.success_url,
      providerMetadata: data.provider_metadata,
    });

    const rawCustomer = await this._client.get<
      PaystackResponse<PaystackCustomer>
    >(`/customer/${encodeURIComponent(data.customer.email)}`);

    return Checkout$inboundSchema(initData, {
      amount: parsedAmount,
      currency: upperCurrency,
      customer: await this.unwrap(rawCustomer, 'createCheckout'),
      metadata: JSON.stringify(metadata),
    } satisfies Partial<PaystackTransaction>);
  };

  retrieveCheckout = async (id: string): Promise<Checkout | null> => {
    const response = await this._client.get<
      PaystackResponse<PaystackTransaction>
    >(`/transaction/verify/${encodeURIComponent(id)}`);

    if (!response.ok || !response.value?.data) return null;

    const txn = response.value.data;

    return Checkout$inboundSchema(
      {
        authorizationUrl: '',
        accessCode: '',
        reference: txn.reference,
      },
      txn,
    );
  };

  updateCheckout = async (
    _id: string,
    _params: UpdateCheckoutSchema<PaystackMetadata['checkout']>,
  ): Promise<Checkout> => {
    throw new ProviderNotSupportedError(
      'updateCheckout',
      'Paystack',
      {
        reason:
          'Paystack does not support updating checkout sessions',
        alternative: 'Create a new checkout session instead',
      },
    );
  };

  deleteCheckout = async (_id: string): Promise<null> => {
    throw new ProviderNotSupportedError(
      'deleteCheckout',
      'Paystack',
      {
        reason:
          'Paystack does not support deleting checkout sessions',
      },
    );
  };

  createCustomer = async (
    params: CreateCustomerParams<PaystackMetadata['customer']>,
  ): Promise<Customer> => {
    const { error, data } = createCustomerSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createCustomer',
      );
    }

    const { firstName, lastName } = parseCustomerName({
      name: data.name,
      email: data.email,
    });

    const body = {
      email: data.email,
      first_name: firstName,
      last_name: lastName || undefined,
      phone: data.phone || undefined,
      metadata: data.metadata ?? {},
      ...data.provider_metadata,
    };

    const response = await this._client.post<
      PaystackResponse<PaystackCustomer>
    >('/customer', { body: JSON.stringify(body) });

    const customer = await this.unwrap(response, 'createCustomer');

    return Customer$inboundSchema(customer);
  };

  retrieveCustomer = async (id: string): Promise<Customer | null> => {
    const response = await this._client.get<
      PaystackResponse<PaystackCustomer>
    >(`/customer/${encodeURIComponent(id)}`);

    if (!response.ok || !response.value?.data) return null;

    return Customer$inboundSchema(response.value.data);
  };

  updateCustomer = async (
    id: string,
    params: UpdateCustomerParams<PaystackMetadata['customer']>,
  ): Promise<Customer> => {
    const body: Record<string, unknown> = {
      ...params.provider_metadata,
    };

    if (params.email) body.email = params.email;
    if (params.phone) body.phone = params.phone;
    if (params.metadata) body.metadata = params.metadata;

    if (params.name) {
      const { firstName, lastName } = parseCustomerName({
        name: params.name,
        email: id,
      });

      body.first_name = firstName;
      body.last_name = lastName || undefined;
    }

    const response = await this._client.put<
      PaystackResponse<PaystackCustomer>
    >(`/customer/${encodeURIComponent(id)}`, {
      body: JSON.stringify(body),
    });

    const customer = await this.unwrap(response, 'updateCustomer');

    return Customer$inboundSchema(customer);
  };

  deleteCustomer = async (_id: string): Promise<null> => {
    throw new ProviderNotSupportedError(
      'deleteCustomer',
      'Paystack',
      {
        reason: 'Paystack does not support deleting customers',
      },
    );
  };

  createSubscription = async (
    params: CreateSubscriptionSchema<
      PaystackMetadata['subscription']
    >,
  ): Promise<Subscription> => {
    const customerValue = isEmailCustomer(params.customer)
      ? params.customer.email
      : isIdCustomer(params.customer)
        ? String(params.customer.id)
        : null;

    if (!customerValue) {
      throw new InvalidTypeError(
        'customer',
        'object with email or id',
        typeof params.customer,
        { provider: this.providerName, method: 'createSubscription' },
      );
    }

    const body = {
      customer: customerValue,
      plan: params.item_id,
      start_date: new Date().toISOString(),
      metadata: params.metadata ?? {},
      ...params.provider_metadata,
    };

    const response = await this._client.post<
      PaystackResponse<PaystackSubscription>
    >('/subscription', { body: JSON.stringify(body) });

    const subscription = await this.unwrap(
      response,
      'createSubscription',
    );

    return Subscription$inboundSchema(subscription);
  };

  retrieveSubscription = async (
    id: string,
  ): Promise<Subscription | null> => {
    const response = await this._client.get<
      PaystackResponse<PaystackSubscription>
    >(`/subscription/${encodeURIComponent(id)}`);

    if (!response.ok || !response.value?.data) return null;

    return Subscription$inboundSchema(response.value.data);
  };

  updateSubscription = async (
    _id: string,
    _params: UpdateSubscriptionSchema<
      PaystackMetadata['subscription']
    >,
  ): Promise<Subscription> => {
    throw new ProviderNotSupportedError(
      'updateSubscription',
      'Paystack',
      {
        reason:
          'Paystack does not support directly updating subscriptions',
        alternative:
          'Cancel and create a new subscription with the desired plan',
      },
    );
  };

  cancelSubscription = async (id: string): Promise<Subscription> => {
    const existing = await this.retrieveSubscription(id);

    if (!existing) {
      throw new ResourceNotFoundError(
        'subscription',
        id,
        this.providerName,
      );
    }

    const subResponse = await this._client.get<
      PaystackResponse<PaystackSubscription>
    >(`/subscription/${encodeURIComponent(id)}`);

    const rawSub = await this.unwrap(
      subResponse,
      'cancelSubscription',
    );

    const body = {
      code: rawSub.subscription_code,
      token: rawSub.email_token,
    };

    await this._client.post<PaystackResponse<boolean>>(
      '/subscription/disable',
      { body: JSON.stringify(body) },
    );

    return { ...existing, status: 'canceled' };
  };

  deleteSubscription = async (_id: string): Promise<null> => {
    throw new ProviderNotSupportedError(
      'deleteSubscription',
      'Paystack',
      {
        reason: 'Paystack does not support deleting subscriptions',
        alternative:
          'Cancel the subscription instead using cancelSubscription',
      },
    );
  };

  createPayment = async (
    params: CreatePaymentSchema<PaystackMetadata['payment']>,
  ): Promise<Payment> => {
    const { error, data } = createPaymentSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createPayment',
      );
    }

    let email: string;

    if (isEmailCustomer(data.customer)) {
      email = data.customer.email;
    } else if (isIdCustomer(data.customer)) {
      const customer = await this.retrieveCustomer(
        String(data.customer.id),
      );

      if (!customer) {
        throw new ResourceNotFoundError(
          'customer',
          String(data.customer.id),
          this.providerName,
        );
      }

      email = customer.email;
    } else {
      throw new InvalidTypeError(
        'customer',
        'object with email or id',
        typeof data.customer,
        { provider: this.providerName, method: 'createPayment' },
      );
    }

    const metadata = {
      ...(stringifyMetadataValues(data.metadata ?? {}) as Record<
        string,
        string
      >),
      [PAYKIT_METADATA_KEY]: JSON.stringify({
        item_id: data.item_id,
      }),
    };

    if (this.opts.debug) {
      console.info('[Paystack] Initializing transaction', {
        email,
        amount: data.amount,
      });
    }

    const initData = await this.initializeTransaction({
      email,
      amount: data.amount,
      currency: data.currency,
      metadata,
      providerMetadata: data.provider_metadata,
    });

    return {
      id: initData.reference,
      amount: data.amount,
      currency: data.currency,
      customer: { email },
      status: 'pending',
      metadata: stringifyMetadataValues(
        data.metadata ?? {},
      ) as Record<string, string>,
      item_id: data.item_id ?? null,
      requires_action: true,
      payment_url: initData.authorizationUrl,
    };
  };

  retrievePayment = async (id: string): Promise<Payment | null> => {
    const response = await this._client.get<
      PaystackResponse<PaystackTransaction>
    >(`/transaction/verify/${encodeURIComponent(id)}`);

    if (!response.ok || !response.value?.data) return null;

    return Payment$inboundSchema(response.value.data);
  };

  updatePayment = async (
    _id: string,
    _params: UpdatePaymentSchema<PaystackMetadata['payment']>,
  ): Promise<Payment> => {
    throw new ProviderNotSupportedError('updatePayment', 'Paystack', {
      reason:
        'Paystack does not support updating transactions after initialization',
    });
  };

  deletePayment = async (_id: string): Promise<null> => {
    throw new ProviderNotSupportedError('deletePayment', 'Paystack', {
      reason: 'Paystack does not support deleting transactions',
    });
  };

  capturePayment = async (
    _id: string,
    _params: CapturePaymentSchema,
  ): Promise<Payment> => {
    throw new ProviderNotSupportedError(
      'capturePayment',
      'Paystack',
      {
        reason:
          'Paystack transactions are charged immediately and do not support manual capture',
      },
    );
  };

  cancelPayment = async (_id: string): Promise<Payment> => {
    throw new ProviderNotSupportedError('cancelPayment', 'Paystack', {
      reason: 'Paystack does not support canceling transactions',
    });
  };

  createRefund = async (
    params: CreateRefundSchema<PaystackMetadata['refund']>,
  ): Promise<Refund> => {
    const { error, data } = createRefundSchema.safeParse(params);

    if (error) {
      throw ValidationError.fromZodError(
        error,
        this.providerName,
        'createRefund',
      );
    }

    const body: Record<string, unknown> = {
      transaction: data.payment_id,
      ...(data.amount && { amount: data.amount }),
      ...(data.reason && { merchant_note: data.reason }),
      ...(data.provider_metadata && { ...data.provider_metadata }),
    };

    const response = await this._client.post<
      PaystackResponse<PaystackRefund>
    >('/refund', { body: JSON.stringify(body) });

    const refund = await this.unwrap(response, 'createRefund');

    return Refund$inboundSchema(refund, 'NGN');
  };

  handleWebhook = async (
    payload: WebhookHandlerConfig,
    webhookSecret: string | null,
  ): Promise<Array<WebhookEventPayload<PaystackRawEvents>>> => {
    if (!webhookSecret) {
      throw new WebhookError(
        'webhookSecret is required for Paystack webhook verification',
        { provider: this.providerName },
      );
    }

    const { body, headersAsObject } = payload;

    const signature = headersAsObject['x-paystack-signature'];

    if (!signature) {
      throw new WebhookError('Missing x-paystack-signature header', {
        provider: this.providerName,
      });
    }

    const expectedSignature = createHmac('sha512', webhookSecret)
      .update(body)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const receivedBuf = Buffer.from(signature, 'hex');

    if (
      expectedBuf.length !== receivedBuf.length ||
      !timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      throw new WebhookError('Invalid Paystack webhook signature', {
        provider: this.providerName,
      });
    }

    let event: PaystackWebhookEvent;

    try {
      event = JSON.parse(body) as PaystackWebhookEvent;
    } catch {
      throw new WebhookError(
        'Invalid webhook payload: not valid JSON',
        {
          provider: this.providerName,
        },
      );
    }

    const results: Array<WebhookEventPayload<PaystackRawEvents>> = [];

    results.push({
      id: `paystack:${event.event}:${crypto.randomUUID()}`,
      type: `paystack.${event.event}`,
      created: Math.floor(Date.now() / 1000),
      data: event.data as any,
      is_raw: true,
    });

    const standardEvents = this.mapToStandardEvents(event);

    if (standardEvents) results.push(...standardEvents);

    return results;
  };

  private mapToStandardEvents = (
    event: PaystackWebhookEvent,
  ): Array<WebhookEventPayload> | null => {
    const created = Math.floor(Date.now() / 1000);
    const id = `paykit:${event.event}:${crypto.randomUUID()}`;

    switch (event.event) {
      case 'charge.success': {
        const txn = event.data as unknown as PaystackTransaction;
        const payment = Payment$inboundSchema(txn);
        const invoice = Invoice$inboundSchema(txn);

        return [
          paykitEvent$InboundSchema({
            type: 'payment.updated',
            created,
            id,
            data: payment,
          }),
          paykitEvent$InboundSchema({
            type: 'invoice.generated',
            created,
            id: `${id}-invoice`,
            data: invoice,
          }),
        ];
      }

      case 'charge.failed': {
        const txn = event.data as unknown as PaystackTransaction;
        const payment = Payment$inboundSchema(txn);

        return [
          paykitEvent$InboundSchema({
            type: 'payment.failed',
            created,
            id,
            data: payment,
          }),
        ];
      }

      case 'customer.create': {
        const customerData =
          event.data as unknown as PaystackCustomer;
        const customer = Customer$inboundSchema(customerData);

        return [
          paykitEvent$InboundSchema({
            type: 'customer.created',
            created,
            id,
            data: customer,
          }),
        ];
      }

      case 'customeridentification.success':
      case 'customeridentification.failed': {
        const customerData =
          event.data as unknown as PaystackCustomer;
        const customer = Customer$inboundSchema(customerData);

        return [
          paykitEvent$InboundSchema({
            type: 'customer.updated',
            created,
            id,
            data: customer,
          }),
        ];
      }

      case 'subscription.create': {
        const subData = event.data as unknown as PaystackSubscription;
        const subscription = Subscription$inboundSchema(subData);

        return [
          paykitEvent$InboundSchema({
            type: 'subscription.created',
            created,
            id,
            data: subscription,
          }),
        ];
      }

      case 'subscription.not_renew':
      case 'subscription.disable': {
        return [
          paykitEvent$InboundSchema({
            type: 'subscription.canceled',
            created,
            id,
            data: null,
          }),
        ];
      }

      case 'invoice.create':
      case 'invoice.update': {
        const invoiceData = event.data as {
          transaction?: PaystackTransaction;
        };
        if (!invoiceData.transaction) return null;

        const payment = Payment$inboundSchema(
          invoiceData.transaction,
        );

        return [
          paykitEvent$InboundSchema({
            type: 'payment.created',
            created,
            id,
            data: payment,
          }),
        ];
      }

      case 'invoice.payment_failed': {
        const invoiceData = event.data as {
          transaction?: PaystackTransaction;
        };
        if (!invoiceData.transaction) return null;

        const payment = Payment$inboundSchema(
          invoiceData.transaction,
        );

        return [
          paykitEvent$InboundSchema({
            type: 'payment.failed',
            created,
            id,
            data: { ...payment, status: 'failed' as const },
          }),
        ];
      }

      case 'refund.pending':
      case 'refund.processed':
      case 'refund.failed': {
        const refundData = event.data as unknown as PaystackRefund;
        const refund = Refund$inboundSchema(refundData, 'NGN');

        return [
          paykitEvent$InboundSchema({
            type: 'refund.created',
            created,
            id,
            data: refund,
          }),
        ];
      }

      default:
        if (this.opts.debug) {
          console.info(
            `[Paystack] No standard mapping for event: ${event.event}. Available as raw event.`,
          );
        }
        return null;
    }
  };
}
