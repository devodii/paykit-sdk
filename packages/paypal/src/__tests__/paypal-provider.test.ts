import { ConfigurationError, WebhookError } from '@paykit-sdk/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayPalProvider } from '../paypal-provider';

const makeProvider = () =>
  new PayPalProvider({
    clientId: 'paypal_client_id',
    clientSecret: 'paypal_client_secret',
    isSandbox: true,
    debug: false,
  });

const verifyWebhookMock = vi.fn();

/**
 * The provider verifies signatures through PayPal's
 * verify-webhook-signature API via an internal controller; tests
 * replace that controller so no network is involved.
 */
const makeProviderWithVerification = (
  status: 'SUCCESS' | 'FAILURE',
) => {
  const provider = makeProvider();
  verifyWebhookMock.mockResolvedValue({
    result: { verification_status: status },
  });
  (provider as never as Record<string, unknown>).webhookController = {
    verifyWebhook: verifyWebhookMock,
  };
  return provider;
};

const webhookBody = (
  eventType: string,
  resource: Record<string, unknown> = {},
) =>
  JSON.stringify({
    id: 'WH-EVT-1',
    event_type: eventType,
    create_time: '2026-01-01T00:00:00Z',
    resource,
  });

const dto = (body: string) => ({
  body,
  headersAsObject: {
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.paypal.com/cert',
    'paypal-transmission-id': 'tx-1',
    'paypal-transmission-sig': 'sig',
    'paypal-transmission-time': '2026-01-01T00:00:00Z',
  },
  fullUrl: 'https://app.example.com/api/webhook',
});

describe('PayPalProvider constructor', () => {
  it('throws ConfigurationError when credentials are missing', () => {
    expect(
      () => new PayPalProvider({ clientId: 'only-id' } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('paypal');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('PayPalProvider.handleWebhook', () => {
  beforeEach(() => {
    verifyWebhookMock.mockReset();
  });

  it('rejects when no webhook id (secret) is configured', async () => {
    await expect(
      makeProvider().handleWebhook(
        dto(webhookBody('CHECKOUT.ORDER.APPROVED')),
        null,
      ),
    ).rejects.toThrow(WebhookError);
  });

  it('rejects when PayPal reports verification FAILURE', async () => {
    const provider = makeProviderWithVerification('FAILURE');

    await expect(
      provider.handleWebhook(
        dto(webhookBody('CHECKOUT.ORDER.APPROVED')),
        'webhook_id_1',
      ),
    ).rejects.toThrow('PayPal Webhook verification failed');
  });

  it('passes headers and the webhook id to the verification API', async () => {
    const provider = makeProviderWithVerification('SUCCESS');
    const body = webhookBody('UNMAPPED.EVENT');

    await provider.handleWebhook(dto(body), 'webhook_id_1');

    expect(verifyWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        transmissionId: 'tx-1',
        transmissionSig: 'sig',
        webhookId: 'webhook_id_1',
      }),
    );
  });

  it('emits only the raw event for unmapped event types', async () => {
    const provider = makeProviderWithVerification('SUCCESS');

    const events = await provider.handleWebhook(
      dto(webhookBody('PAYMENT.SALE.COMPLETED', { id: 'sale_1' })),
      'webhook_id_1',
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'WH-EVT-1',
      type: 'paypal.PAYMENT.SALE.COMPLETED',
      is_raw: true,
    });
  });

  it('maps BILLING.SUBSCRIPTION.CANCELLED to subscription.canceled', async () => {
    const provider = makeProviderWithVerification('SUCCESS');

    const events = await provider.handleWebhook(
      dto(
        webhookBody('BILLING.SUBSCRIPTION.CANCELLED', {
          id: 'I-SUB1',
          status: 'CANCELLED',
          plan_id: 'P-PLAN1',
          start_time: '2026-01-01T00:00:00Z',
          subscriber: { email_address: 'buyer@example.com' },
          billing_info: {
            last_payment: {
              amount: { currency_code: 'USD', value: '10.00' },
            },
          },
        }),
      ),
      'webhook_id_1',
    );

    expect(events.map(e => e.type)).toEqual([
      'paypal.BILLING.SUBSCRIPTION.CANCELLED',
      'subscription.canceled',
    ]);
  });

  it('maps PAYMENT.CAPTURE.COMPLETED to payment.succeeded', async () => {
    const provider = makeProviderWithVerification('SUCCESS');

    const events = await provider.handleWebhook(
      dto(
        webhookBody('PAYMENT.CAPTURE.COMPLETED', {
          id: 'CAP-1',
          status: 'COMPLETED',
          amount: { currency_code: 'USD', value: '25.00' },
          custom_id: 'order_ref',
        }),
      ),
      'webhook_id_1',
    );

    expect(events.map(e => e.type)).toEqual([
      'paypal.PAYMENT.CAPTURE.COMPLETED',
      'payment.succeeded',
    ]);
  });
});
