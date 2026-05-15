import {
  Invoice,
  Payment,
  Refund,
  Subscription,
  PAYKIT_METADATA_KEY,
  omitInternalMetadata,
  Checkout,
} from '@paykit-sdk/core';
import { GoPayPaymentBaseResponse, GoPaySubscriptionResponse } from '../schema';

/**
 * Decodes HTML entities that GoPay returns for JSON strings
 * GoPay HTML-encodes values containing special characters (quotes, etc.)
 */
export const decodeHtmlEntities = (str: string): string => {
  return str
    .replace(/&#34;/g, '"') // HTML entity for double quote
    .replace(/&#39;/g, "'") // HTML entity for single quote
    .replace(/&quot;/g, '"') // Alternative quote encoding
    .replace(/&apos;/g, "'"); // Alternative apostrophe encoding
};

/**
 * @internal
 */
export const Payment$inboundSchema = (
  data: GoPayPaymentBaseResponse,
): Payment => {
  const { item } = JSON.parse(
    decodeHtmlEntities(
      data.additional_params?.find(param => param.name === PAYKIT_METADATA_KEY)
        ?.value ?? '{}',
    ),
  );

  const metadata = omitInternalMetadata(
    data.additional_params?.reduce(
      (acc, param) => {
        acc[param.name] = String(param.value);
        return acc;
      },
      {} as Record<string, string>,
    ) ?? {},
  );

  const statusMap: Record<
    GoPayPaymentBaseResponse['state'],
    Payment['status']
  > = {
    CREATED: 'pending',
    PAYMENT_METHOD_CHOSEN: 'processing',
    PAID: 'succeeded',
    AUTHORIZED: 'requires_capture',
    CANCELED: 'canceled',
    TIMEOUTED: 'canceled',
    REFUNDED: 'canceled',
    PARTIALLY_REFUNDED: 'canceled',
  };

  const requiresAction =
    data.state === 'CREATED' || data.state === 'AUTHORIZED' ? true : false;

  return {
    id: data.id.toString(),
    amount: data.amount,
    currency: data.currency,
    customer: data.payer?.contact?.email
      ? { email: data.payer.contact.email }
      : null,
    status: statusMap[data.state],
    item_id: item,
    metadata,
    requires_action: requiresAction,
    payment_url: data.gw_url ?? null,
  };
};

/**
 * @internal
 */
export const Checkout$inboundSchema = (
  data: GoPayPaymentBaseResponse,
): Checkout => {
  const { item, qty, type } = JSON.parse(
    decodeHtmlEntities(
      data.additional_params?.find(param => param.name === PAYKIT_METADATA_KEY)
        ?.value ?? '{}',
    ),
  );

  const metadata = omitInternalMetadata(
    data.additional_params?.reduce(
      (acc, param) => {
        acc[param.name] = String(param.value);
        return acc;
      },
      {} as Record<string, string>,
    ) ?? {},
  );

  return {
    id: data.id.toString(),
    amount: data.amount,
    currency: data.currency,
    customer: data.payer?.contact?.email
      ? { email: data.payer.contact.email }
      : null,
    payment_url: data.gw_url ?? '',
    metadata,
    session_type: type,
    products: [{ id: item, quantity: parseInt(qty) }],
  };
};

/**
 * @internal
 */
export const Invoice$inboundSchema = <T extends 'payment' | 'subscription'>(
  data: T extends 'payment'
    ? GoPayPaymentBaseResponse
    : GoPaySubscriptionResponse,
  isSubscription: boolean,
): Invoice => {
  const { item, qty } = JSON.parse(
    decodeHtmlEntities(
      data.additional_params?.find(param => param.name === PAYKIT_METADATA_KEY)
        ?.value ?? '{}',
    ),
  );

  const status = (() => {
    if (data.state === 'PAID') return 'paid';
    return 'open';
  })();

  const paidAt = isSubscription
    ? new Date(
        (data as GoPaySubscriptionResponse).recurrence?.recurrence_date_to ??
          '',
      )
    : new Date();

  const metadata = omitInternalMetadata(
    data.additional_params?.reduce(
      (acc, param) => {
        acc[param.name] = String(param.value);
        return acc;
      },
      {} as Record<string, string>,
    ) ?? {},
  );

  return {
    id: data.id.toString(),
    amount_paid: data.amount,
    currency: data.currency,
    customer: data.payer?.contact?.email
      ? { email: data.payer.contact.email }
      : null,
    status,
    paid_at: paidAt.toISOString(),
    metadata: metadata ?? {},
    custom_fields: null,
    subscription_id: isSubscription ? data.id.toString() : null,
    billing_mode: isSubscription ? 'recurring' : 'one_time',
    line_items: [{ id: item, quantity: parseInt(qty) }],
  };
};

/**
 * @internal
 */
export const Subscription$inboundSchema = (
  data: GoPaySubscriptionResponse,
): Subscription => {
  const { item } = JSON.parse(
    decodeHtmlEntities(
      data.additional_params?.find(param => param.name === PAYKIT_METADATA_KEY)
        ?.value ?? '{}',
    ),
  );

  const billingIntervalMap: Record<string, Subscription['billing_interval']> = {
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    ON_DEMAND: 'month',
  };

  const billingInterval =
    billingIntervalMap[data.recurrence?.recurrence_cycle ?? 'ON_DEMAND'];

  const recurrencePeriod = data.recurrence?.recurrence_period ?? 1;
  const recurrenceCycle = data.recurrence?.recurrence_cycle;

  const currentPeriodEnd = new Date(data.recurrence?.recurrence_date_to ?? '');

  const currentPeriodStart = (() => {
    if (!currentPeriodEnd) return new Date();

    const endDate = new Date(currentPeriodEnd);
    const startDate = new Date(endDate);

    switch (recurrenceCycle) {
      case 'DAY':
        startDate.setDate(startDate.getDate() - recurrencePeriod);
        break;
      case 'WEEK':
        startDate.setDate(startDate.getDate() - recurrencePeriod * 7);
        break;
      case 'MONTH':
        startDate.setMonth(startDate.getMonth() - recurrencePeriod);
        break;
      default:
        startDate.setDate(startDate.getDate() - recurrencePeriod);
    }

    return startDate;
  })();

  const metadata = omitInternalMetadata(
    data.additional_params?.reduce(
      (acc, param) => {
        acc[param.name] = String(param.value);
        return acc;
      },
      {} as Record<string, string>,
    ) ?? {},
  );

  const requiresAction = data.state === 'CREATED' ? true : false;

  const subscriptionStatusMap: Record<
    GoPaySubscriptionResponse['state'],
    Subscription['status']
  > = {
    CREATED: 'pending',
    PAID: 'active',
    CANCELED: 'canceled',
    TIMEOUTED: 'canceled',
    REFUNDED: 'canceled',
    PARTIALLY_REFUNDED: 'canceled',
    AUTHORIZED: 'active',
    PAYMENT_METHOD_CHOSEN: 'active',
  };

  const status = subscriptionStatusMap[data.state] ?? 'expired';

  return {
    id: data.id.toString(),
    status,
    customer: data.payer?.contact?.email
      ? { email: data.payer.contact.email }
      : null,
    item_id: item,
    billing_interval: billingInterval,
    currency: data.currency,
    amount: data.amount,
    metadata: metadata,
    custom_fields: null,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    requires_action: requiresAction,
    payment_url: requiresAction ? (data.gw_url ?? null) : null,
  };
};

/**
 * @internal
 */
export const Refund$inboundSchema = (
  data: GoPayPaymentBaseResponse,
): Refund => {
  return {
    id: data.id.toString(),
    amount: data.amount,
    currency: data.currency,
    reason: data.state,
    metadata: {},
  };
};
