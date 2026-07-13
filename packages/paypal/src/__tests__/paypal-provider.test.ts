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

describe('PayPalProvider.createCheckout / createPayment', () => {
  const createOrderMock = vi.fn();

  const makeProviderWithOrders = () => {
    const provider = makeProvider();
    createOrderMock.mockResolvedValue({
      result: {
        id: 'ORDER-1',
        status: 'CREATED',
        payer: { emailAddress: 'buyer@example.com' },
        links: [
          {
            rel: 'approve',
            href: 'https://paypal.com/checkoutnow?token=1',
          },
        ],
        purchaseUnits: [
          {
            amount: { value: '25.00', currencyCode: 'USD' },
            customId: '{}',
            items: [{ sku: 'sku_1' }],
          },
        ],
      },
    });
    (provider as never as Record<string, unknown>).ordersController =
      {
        createOrder: createOrderMock,
      };
    return provider;
  };

  beforeEach(() => {
    createOrderMock.mockReset();
  });

  it('createCheckout sends the customer email as emailAddress', async () => {
    const provider = makeProviderWithOrders();

    await provider.createCheckout({
      customer: { email: 'buyer@example.com' },
      item_id: 'sku_1',
      quantity: 1,
      session_type: 'one_time',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: null,
      provider_metadata: {
        currency: 'USD',
        amount: '25.00',
        itemName: 'Widget',
      },
    } as never);

    const [{ body }] = createOrderMock.mock.calls[0];
    expect(body.payer).toEqual({
      emailAddress: 'buyer@example.com',
    });
  });

  it('createCheckout sends an id-based customer as payerId (not an empty payer)', async () => {
    const provider = makeProviderWithOrders();

    await provider.createCheckout({
      customer: { id: 'cus_1' },
      item_id: 'sku_1',
      quantity: 1,
      session_type: 'one_time',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: null,
      provider_metadata: {
        currency: 'USD',
        amount: '25.00',
        itemName: 'Widget',
      },
    } as never);

    const [{ body }] = createOrderMock.mock.calls[0];
    expect(body.payer).toEqual({ payerId: 'cus_1' });
  });

  it('createPayment sends an id-based customer as payerId', async () => {
    const provider = makeProviderWithOrders();

    await provider.createPayment({
      customer: { id: 'cus_1' },
      amount: 2500,
      currency: 'USD',
      item_id: 'sku_1',
      capture_method: 'automatic',
    } as never);

    const [{ body }] = createOrderMock.mock.calls[0];
    expect(body.payer).toEqual({ payerId: 'cus_1' });
  });

  it('createPayment sends the customer email as emailAddress', async () => {
    const provider = makeProviderWithOrders();

    const payment = await provider.createPayment({
      customer: { email: 'buyer@example.com' },
      amount: 2500,
      currency: 'USD',
      item_id: 'sku_1',
      capture_method: 'automatic',
    } as never);

    const [{ body }] = createOrderMock.mock.calls[0];
    expect(body.payer).toEqual({ emailAddress: 'buyer@example.com' });
    expect(payment.id).toBe('ORDER-1');
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

  it('maps CHECKOUT.ORDER.APPROVED to payment.created', async () => {
    const provider = makeProviderWithVerification('SUCCESS');

    const events = await provider.handleWebhook(
      dto(
        webhookBody('CHECKOUT.ORDER.APPROVED', {
          id: 'ORDER-1',
          status: 'APPROVED',
          payer: { email_address: 'buyer@example.com' },
          purchase_units: [
            { amount: { value: '25.00', currency_code: 'USD' } },
          ],
        }),
      ),
      'webhook_id_1',
    );

    expect(events.map(e => e.type)).toEqual([
      'paypal.CHECKOUT.ORDER.APPROVED',
      'payment.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'ORDER-1',
      status: 'requires_capture',
    });
  });

  it('maps CHECKOUT.ORDER.COMPLETED to payment.succeeded', async () => {
    const provider = makeProviderWithVerification('SUCCESS');

    const events = await provider.handleWebhook(
      dto(
        webhookBody('CHECKOUT.ORDER.COMPLETED', {
          id: 'ORDER-2',
          status: 'COMPLETED',
          payer: { email_address: 'buyer@example.com' },
          purchase_units: [
            { amount: { value: '25.00', currency_code: 'USD' } },
          ],
        }),
      ),
      'webhook_id_1',
    );

    expect(events.map(e => e.type)).toEqual([
      'paypal.CHECKOUT.ORDER.COMPLETED',
      'payment.succeeded',
    ]);
  });

  it('maps PAYMENT.CAPTURE.REFUNDED to refund.created', async () => {
    const provider = makeProviderWithVerification('SUCCESS');

    const events = await provider.handleWebhook(
      dto(
        webhookBody('PAYMENT.CAPTURE.REFUNDED', {
          id: 'REF-1',
          amount: { total: '-10.00', currency: 'USD' },
        }),
      ),
      'webhook_id_1',
    );

    expect(events.map(e => e.type)).toEqual([
      'paypal.PAYMENT.CAPTURE.REFUNDED',
      'refund.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'REF-1',
      amount: 10,
      currency: 'USD',
    });
  });

  const subscriptionResource = (
    extra: Record<string, unknown> = {},
  ) => ({
    id: 'I-SUB1',
    state: 'Active',
    start_date: '2026-01-01T00:00:00Z',
    plan: {
      id: 'P-PLAN1',
      curr_code: 'USD',
      payment_definitions: [
        {
          type: 'REGULAR',
          frequency: 'Month',
          amount: { value: '10.00' },
        },
      ],
    },
    payer: { payer_info: { email: 'buyer@example.com' } },
    ...extra,
  });

  it('maps BILLING.SUBSCRIPTION.CREATED to subscription.created', async () => {
    const provider = makeProviderWithVerification('SUCCESS');

    const events = await provider.handleWebhook(
      dto(
        webhookBody(
          'BILLING.SUBSCRIPTION.CREATED',
          subscriptionResource({ state: 'Pending' }),
        ),
      ),
      'webhook_id_1',
    );

    expect(events.map(e => e.type)).toEqual([
      'paypal.BILLING.SUBSCRIPTION.CREATED',
      'subscription.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'I-SUB1',
      status: 'pending',
    });
  });

  it.each([
    'BILLING.SUBSCRIPTION.UPDATED',
    'BILLING.SUBSCRIPTION.SUSPENDED',
    'BILLING.SUBSCRIPTION.ACTIVATED',
  ])('maps %s to subscription.updated', async eventType => {
    const provider = makeProviderWithVerification('SUCCESS');

    const events = await provider.handleWebhook(
      dto(webhookBody(eventType, subscriptionResource())),
      'webhook_id_1',
    );

    expect(events.map(e => e.type)).toEqual([
      `paypal.${eventType}`,
      'subscription.updated',
    ]);
  });

  it('maps BILLING.SUBSCRIPTION.EXPIRED to subscription.canceled', async () => {
    const provider = makeProviderWithVerification('SUCCESS');

    const events = await provider.handleWebhook(
      dto(
        webhookBody(
          'BILLING.SUBSCRIPTION.EXPIRED',
          subscriptionResource({ state: 'Expired' }),
        ),
      ),
      'webhook_id_1',
    );

    expect(events.map(e => e.type)).toEqual([
      'paypal.BILLING.SUBSCRIPTION.EXPIRED',
      'subscription.canceled',
    ]);
    expect(events[1].data).toMatchObject({ status: 'canceled' });
  });
});
