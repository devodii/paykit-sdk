import {
  CapturePaymentInput,
  CapturePaymentOutput,
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  ProviderWebhookPayload,
  WebhookActionResult,
  CreateAccountHolderInput,
  CreateAccountHolderOutput,
  UpdateAccountHolderInput,
  UpdateAccountHolderOutput,
  DeleteAccountHolderInput,
  DeleteAccountHolderOutput,
} from '@medusajs/framework/types';
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from '@medusajs/framework/utils';
import {
  PayKit,
  PaymentStatus,
  tryCatchAsync,
  validateRequiredKeys,
  providerSchema,
  Payee,
  getURLFromHeaders,
  billingSchema,
  parseCustomerName,
  PAYKIT_METADATA_KEY,
  isIdCustomer,
  isEmailCustomer,
  PaykitMetadata,
  BillingInfo,
} from '@paykit-sdk/core';
import { z } from 'zod';
import { PaymentStatus$inboundSchema } from '../utils/mapper';

const optionsSchema = z.object({
  /**
   * The underlying PayKit provider instance (Stripe, PayPal, etc.)
   */
  provider: providerSchema,

  /**
   * The webhook secret for the provider.
   */
  webhookSecret: z.string().nullable().default(null),

  /**
   * Multiplier applied to the amount before sending to the payment provider.
   * Use this when your provider expects amounts in the smallest currency unit (e.g. cents)
   * but Medusa is passing amounts in the major unit (e.g. euros).
   */
  amountToCentsMultiplier: z.number().min(1).default(1),

  /**
   * Whether to enable debug mode
   */
  debug: z.boolean().optional(),
});

export type PaykitMedusaJSAdapterOptions = z.infer<
  typeof optionsSchema
>;

export class PaykitMedusaJSAdapter extends AbstractPaymentProvider<PaykitMedusaJSAdapterOptions> {
  /**
   * The unique identifier for this payment provider
   * Will be stored as `pp_paykit_{id}` in Medusa
   */
  static identifier = 'paykit';

  protected readonly paykit: PayKit<
    PaykitMedusaJSAdapterOptions['provider']
  >;

  protected readonly options: PaykitMedusaJSAdapterOptions;

  static validateOptions(options: Record<string, any>): void | never {
    const { error } = optionsSchema.safeParse(options);

    if (error) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        error.message,
      );
    }

    return;
  }

  /**
   * @param cradle - Medusa's dependency injection container
   * @param options - PayKit provider configuration
   */
  constructor(
    cradle: Record<string, unknown>,
    options: PaykitMedusaJSAdapterOptions,
  ) {
    super(cradle, options);
    this.options = options;
    this.paykit = new PayKit(options.provider);

    if (this.options.debug) {
      console.info(
        `[PayKit] Initialized with provider: ${this.paykit.providerName}`,
      );
    }
  }

  private async exec<T>(
    promise: Promise<T>,
    context: string,
    options?: { allowUnsupported?: boolean },
  ): Promise<T | null> {
    const [result, error] = await tryCatchAsync(promise);

    if (error) {
      if (
        options?.allowUnsupported &&
        error.name === 'ProviderNotSupportedError'
      ) {
        if (this.options.debug) {
          console.warn(
            `[PayKit ${context}] Operation not supported by ${this.paykit.providerName}.`,
          );
        }
        return null;
      }

      throw new MedusaError(
        MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
        `[PayKit ${context}] ${error.message}`,
      );
    }

    return result!;
  }

  initiatePayment = async ({
    context,
    amount,
    currency_code,
    data,
  }: InitiatePaymentInput): Promise<InitiatePaymentOutput> => {
    if (this.options.debug) {
      console.info('[PayKit] Initiating payment', {
        context,
        amount: Number(amount) * this.options.amountToCentsMultiplier,
        currency_code,
        data,
      });
    }

    const hasProviderCustomer = !!context?.account_holder?.data?.id;

    let customer: Payee | null = null;

    if (context?.account_holder?.data?.id) {
      customer = { id: context.account_holder.data.id as string };
    } else if (context?.customer?.email) {
      customer = { email: context.customer.email as string };
    } else if (data?.email) {
      customer = { email: data.email as string };
    }

    if (
      !customer ||
      (!isIdCustomer(customer) && !isEmailCustomer(customer))
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Customer ID (account_holder) or Email (context.customer or data.email) required',
      );
    }

    if (!hasProviderCustomer && isEmailCustomer(customer)) {
      const { fullName } = parseCustomerName({
        name: `${context?.customer?.first_name ?? ''} ${context?.customer?.last_name ?? ''}`.trim(),
        email: customer.email,
      });

      const billingInfo = billingSchema.safeParse(data?.billing);

      if (data?.billing && !billingInfo.success) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid billing information, ${billingInfo.error.message} `,
        );
      }

      const created = await this.exec(
        this.paykit.customers.create({
          email: customer.email,
          name: fullName,
          phone: (data?.phone as string) ?? null,
          billing: billingInfo.data ?? null,
          metadata: {
            [PAYKIT_METADATA_KEY]: JSON.stringify({
              source: 'medusa-paykit-adapter',
            }),
          },
        }),
        'Customer Creation',
        { allowUnsupported: true },
      );

      if (created) {
        customer = {
          ...('id' in created ? { id: created.id } : {}),
          ...('email' in created ? { email: created.email } : {}),
        } as Payee;
      }
    }

    const payment = await this.exec(
      this.paykit.payments.create({
        amount: Number(amount) * this.options.amountToCentsMultiplier,
        currency: currency_code.toUpperCase(),
        customer,
        item_id: (data?.item_id as string) ?? null,
        capture_method: 'manual',
        metadata: {
          ...(data?.metadata as Record<string, unknown>),
          session_id: data?.session_id,
        },
        ...(data?.billing
          ? { billing: data.billing as BillingInfo }
          : {}),
        provider_metadata: data?.provider_metadata,
      }),
      'Initiate',
    );

    return {
      id: payment!.id,
      status: payment!.requires_action
        ? PaymentSessionStatus.REQUIRES_MORE
        : PaymentStatus$inboundSchema(payment!.status),
      data: { ...payment!, payment_url: payment!.payment_url },
    };
  };

  capturePayment = async (
    input: CapturePaymentInput,
  ): Promise<CapturePaymentOutput> => {
    if (this.options.debug) {
      console.info('[PayKit] Capturing payment', input);
    }

    const { id: paymentId, amount } = validateRequiredKeys(
      ['id', 'amount'],
      (input.data as Record<string, string>) ?? {},
      'Missing required fields: {keys}',
      message =>
        new MedusaError(MedusaError.Types.INVALID_DATA, message),
    );

    const data = await this.exec(
      this.paykit.payments.capture(paymentId, {
        amount: Number(amount) * this.options.amountToCentsMultiplier,
      }),
      'Capture',
    );
    return {
      data: data as unknown as Record<string, unknown>,
    };
  };

  authorizePayment = async (
    input: AuthorizePaymentInput,
  ): Promise<AuthorizePaymentOutput> => {
    const { id: paymentId } = validateRequiredKeys(
      ['id'],
      (input.data as Record<string, string>) ?? {},
      'Missing required fields: {keys}',
      message =>
        new MedusaError(MedusaError.Types.INVALID_DATA, message),
    );

    const payment = await this.exec(
      this.paykit.payments.retrieve(paymentId),
      'Authorize',
    );

    if (!payment) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        'Payment not found',
      );
    }

    const resolvedStatus = (() => {
      if (payment.requires_action)
        return PaymentSessionStatus.REQUIRES_MORE;
      if (payment.status === 'succeeded')
        return PaymentSessionStatus.AUTHORIZED;
      return PaymentStatus$inboundSchema(payment.status);
    })();

    return {
      status: resolvedStatus,
      data: payment as unknown as Record<string, unknown>,
    };
  };

  cancelPayment = async (
    input: CancelPaymentInput,
  ): Promise<CancelPaymentOutput> => {
    if (this.options.debug) {
      console.info('[PayKit] Canceling payment', input);
    }

    const { id: paymentId } = validateRequiredKeys(
      ['id'],
      (input.data as Record<string, string>) ?? {},
      'Missing required fields: {keys}',
      message =>
        new MedusaError(MedusaError.Types.INVALID_DATA, message),
    );

    const data = await this.exec(
      this.paykit.payments.cancel(paymentId),
      'Cancel',
    );

    return { data: data as unknown as Record<string, unknown> };
  };

  deletePayment = async (
    input: DeletePaymentInput,
  ): Promise<DeletePaymentOutput> => {
    if (this.options.debug) {
      console.info(
        '[PayKit] Deleting payment (attempting cancel)',
        input,
      );
    }

    const paymentId = (input.data as Record<string, string>)?.id;

    if (!paymentId) {
      return {};
    }

    const data = await this.exec(
      this.paykit.payments.cancel(paymentId),
      'Cancel',
      { allowUnsupported: true },
    );

    return { data: data as unknown as Record<string, unknown> };
  };

  getPaymentStatus = async (
    input: GetPaymentStatusInput,
  ): Promise<GetPaymentStatusOutput> => {
    const { id: paymentId } = validateRequiredKeys(
      ['id'],
      (input.data as Record<string, string>) ?? {},
      'Missing required fields: {keys}',
      message =>
        new MedusaError(MedusaError.Types.INVALID_DATA, message),
    );

    const payment = await this.exec(
      this.paykit.payments.retrieve(paymentId),
      'Status',
    );

    if (!payment)
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        'Payment not found',
      );

    return {
      status: PaymentStatus$inboundSchema(payment.status),
      data: payment as unknown as Record<string, unknown>,
    };
  };

  refundPayment = async (
    input: RefundPaymentInput,
  ): Promise<RefundPaymentOutput> => {
    if (this.options.debug) {
      console.info('[PayKit] Refunding payment', input);
    }

    const { id: paymentId, reason = 'customer_request' } =
      validateRequiredKeys(
        ['id', 'reason'],
        (input.data as Record<string, string>) ?? {},
        'Missing required fields: {keys}',
        message =>
          new MedusaError(MedusaError.Types.INVALID_DATA, message),
      );

    const refund = await this.exec(
      this.paykit.refunds.create({
        payment_id: paymentId,
        amount:
          Number(input.amount) * this.options.amountToCentsMultiplier,
        reason,
        metadata:
          (input.data?.metadata as unknown as PaykitMetadata) ?? null,
        provider_metadata:
          (input.data?.provider_metadata as unknown as Record<
            string,
            unknown
          >) ?? undefined,
      }),
      'Refund',
    );

    return { data: refund as unknown as Record<string, unknown> };
  };

  retrievePayment = async (
    input: RetrievePaymentInput,
  ): Promise<RetrievePaymentOutput> => {
    if (this.options.debug) {
      console.info('[PayKit] Retrieving payment', input);
    }

    const { id: paymentId } = validateRequiredKeys(
      ['id'],
      (input.data as Record<string, string>) ?? {},
      'Missing required fields: {keys}',
      message =>
        new MedusaError(MedusaError.Types.INVALID_DATA, message),
    );

    const payment = await this.exec(
      this.paykit.payments.retrieve(paymentId),
      'Retrieve',
    );

    return { data: payment as unknown as Record<string, unknown> };
  };

  updatePayment = async (
    input: UpdatePaymentInput,
  ): Promise<UpdatePaymentOutput> => {
    if (this.options.debug) {
      console.info('[PayKit] Updating payment', input);
    }

    const {
      amount,
      id: paymentId,
      currency_code: currencyCode,
    } = validateRequiredKeys(
      ['amount', 'currency_code', 'id'],
      (input.data as unknown as Record<string, string>) ?? {},
      'Missing required fields: {keys}',
      message =>
        new MedusaError(MedusaError.Types.INVALID_DATA, message),
    );

    const data = await this.exec(
      this.paykit.payments.update(paymentId, {
        amount: Number(amount) * this.options.amountToCentsMultiplier,
        currency: currencyCode.toUpperCase(),
        provider_metadata: input.data
          ?.provider_metadata as unknown as Record<string, unknown>,
      }),
      'Update',
    );

    return { data: data as unknown as Record<string, unknown> };
  };

  getWebhookActionAndData = async (
    payload: ProviderWebhookPayload['payload'],
  ): Promise<WebhookActionResult> => {
    if (this.options.debug) {
      console.info(
        '[PayKit] Resolving webhook action and data',
        payload,
      );
    }

    const { rawData, headers } = payload;

    const body = Buffer.isBuffer(rawData)
      ? rawData.toString('utf8')
      : rawData;

    const headersMap = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k, String(v)]),
    );

    let result: WebhookActionResult = {
      action: PaymentActions.NOT_SUPPORTED,
    };

    const statusMap: Record<PaymentStatus, PaymentActions> = {
      pending: PaymentActions.PENDING,
      processing: PaymentActions.PENDING,
      requires_action: PaymentActions.REQUIRES_MORE,
      requires_capture: PaymentActions.AUTHORIZED,
      succeeded: PaymentActions.SUCCESSFUL,
      failed: PaymentActions.FAILED,
      canceled: PaymentActions.CANCELED,
    };

    const webhook = this.paykit.webhooks
      .setup({ webhookSecret: this.options.webhookSecret })
      .on('payment.created', async event => {
        result = {
          action: statusMap[event?.data?.status ?? 'pending'],
          data: {
            session_id: event.data?.metadata?.session_id as string,
            amount: event.data?.amount
              ? event.data?.amount *
                this.options.amountToCentsMultiplier
              : 0,
          },
        };
      })
      .on('payment.updated', async event => {
        result = {
          action: statusMap[event?.data?.status ?? 'pending'],
          data: {
            session_id: event.data?.metadata?.session_id as string,
            amount: event.data?.amount
              ? event.data?.amount *
                this.options.amountToCentsMultiplier
              : 0,
          },
        };
      })
      .on('payment.failed', async event => {
        result = {
          action: PaymentActions.CANCELED,
          data: {
            amount: event.data?.amount
              ? event.data?.amount *
                this.options.amountToCentsMultiplier
              : 0,
            session_id: event.data?.metadata?.session_id as string,
          },
        };
      });

    await webhook.handle({
      body,
      headersAsObject: headersMap,
      fullUrl: getURLFromHeaders(headersMap),
    });

    return result;
  };

  createAccountHolder = async ({
    context,
    data,
  }: CreateAccountHolderInput): Promise<CreateAccountHolderOutput> => {
    if (context.account_holder?.data?.id) {
      return { id: context.account_holder.data.id as string };
    }

    if (this.options.debug) {
      console.info('[PayKit] Creating account holder', context, data);
    }

    const { fullName } = parseCustomerName({
      email: context.customer?.email as string,
    });

    const billingInfo = billingSchema.safeParse(data?.billing);

    if (data?.billing && !billingInfo.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Invalid billing information, ${billingInfo.error.message} `,
      );
    }

    const res = await this.exec(
      this.paykit.customers.create({
        email: context.customer?.email as string,
        name: fullName,
        phone: context.customer?.phone ?? null,
        billing: billingInfo.data ?? null,
      }),
      'Create Account Holder',
      { allowUnsupported: true },
    );

    // @ts-expect-error
    if (!res) return {};

    return {
      id: res.id,
      data: res as unknown as Record<string, unknown>,
    };
  };

  updateAccountHolder = async ({
    context,
    data,
  }: UpdateAccountHolderInput): Promise<UpdateAccountHolderOutput> => {
    if (this.options.debug) {
      console.info('[PayKit] Updating account holder', context, data);
    }

    const { account_holder, customer } = context;

    if (!account_holder.data?.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Account holder not found in context',
      );
    }

    if (!customer) return {};

    const res = await this.exec(
      this.paykit.customers.update(account_holder.data.id as string, {
        ...(data?.billing != null
          ? {
              billing:
                billingSchema.safeParse(data.billing).data ?? null,
            }
          : {}),
        ...(data?.email != null
          ? { email: data.email as string }
          : {}),
        ...(data?.name != null ? { name: data.name as string } : {}),
        ...(data?.phone != null
          ? { phone: data.phone as string }
          : {}),
        ...(data?.metadata != null
          ? {
              metadata: data.metadata as unknown as Record<
                string,
                string
              >,
            }
          : {}),
        ...(data?.provider_metadata != null
          ? {
              provider_metadata:
                data.provider_metadata as unknown as Record<
                  string,
                  unknown
                >,
            }
          : {}),
      }),
      'Update Account Holder',
    );

    return { data: res as unknown as Record<string, unknown> };
  };

  deleteAccountHolder = async ({
    context,
    data,
  }: DeleteAccountHolderInput): Promise<DeleteAccountHolderOutput> => {
    if (this.options.debug) {
      console.info('[PayKit] Deleting account holder', context, data);
    }

    const { account_holder } = context;

    if (!account_holder.data?.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Account holder not found in context',
      );
    }

    const res = await this.exec(
      this.paykit.customers.delete(account_holder.data.id as string),
      'Delete Account Holder',
    );

    return { data: res as unknown as Record<string, unknown> };
  };
}
