import {
  Invoice,
  omitInternalMetadata,
  Payment,
} from '@paykit-sdk/core';
import { ComgateWebhookStatusSuccessResponse } from '../schema';

/**
 * @internal
 */
export const Payment$inboundSchema = (
  webhookResponse: ComgateWebhookStatusSuccessResponse,
  status: Payment['status'],
): Payment => {
  return {
    id: webhookResponse.transId,
    amount: webhookResponse.price,
    currency: webhookResponse.curr,
    customer: webhookResponse.payerId
      ? { id: webhookResponse.payerId }
      : { email: webhookResponse.email },
    status,
    metadata: omitInternalMetadata(
      JSON.parse(webhookResponse.refId) as Record<string, unknown>,
    ),
    item_id: null,
    requires_action: false,
    payment_url: '',
  };
};

/**
 * @internal
 */
export const Invoice$inboundSchema = (
  webhookResponse: ComgateWebhookStatusSuccessResponse,
): Invoice => {
  const status = ((): Invoice['status'] => {
    if (webhookResponse.status == 'PAID') return 'paid';
    return 'open';
  })();

  return {
    id: webhookResponse.transId,
    status,
    paid_at: new Date().toISOString(),
    amount_paid: webhookResponse.price,
    currency: webhookResponse.curr,
    customer: webhookResponse.payerId
      ? { id: webhookResponse.payerId }
      : { email: webhookResponse.email },
    custom_fields: null,
    subscription_id: null,
    billing_mode: 'one_time',
    line_items: webhookResponse.name
      ? [{ id: webhookResponse.name, quantity: 1 }]
      : [],
    metadata: omitInternalMetadata(
      JSON.parse(webhookResponse.refId) as Record<string, unknown>,
    ),
  };
};
