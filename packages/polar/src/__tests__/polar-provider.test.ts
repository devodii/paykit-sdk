import { ConfigurationError, WebhookError } from '@paykit-sdk/core';
import { Polar } from '@polar-sh/sdk';
import { validateEvent } from '@polar-sh/sdk/webhooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PolarProvider } from '../polar-provider';

vi.mock('@polar-sh/sdk/webhooks', () => ({
  validateEvent: vi.fn(),
}));

const validateEventMock = vi.mocked(validateEvent);

const makeProvider = () =>
  new PolarProvider({
    accessToken: 'polar_pat_test',
    isSandbox: true,
    debug: false,
  });

const dto = (body = '{}') => ({
  body,
  headersAsObject: {
    'webhook-id': 'wh_1',
    'webhook-timestamp': '1700000000',
    'webhook-signature': 'v1,sig',
  },
  fullUrl: 'https://app.example.com/api/webhook',
});

describe('PolarProvider constructor', () => {
  it('throws ConfigurationError when accessToken is missing', () => {
    expect(
      () => new PolarProvider({ isSandbox: true } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name, sandbox flag, and native client', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('polar');
    expect(provider.isSandbox).toBe(true);
    expect(provider._native).toBeInstanceOf(Polar);
  });
});

describe('PolarProvider.createCheckout / createPayment', () => {
  const createCheckoutMock = vi.fn();

  const makeProviderWithPolar = () => {
    const provider = makeProvider();
    createCheckoutMock.mockResolvedValue({
      id: 'checkout_1',
      url: 'https://polar.sh/checkout/1',
      customerId: null,
      customerEmail: 'buyer@example.com',
      subscriptionId: null,
      products: [{ id: 'prod_1' }],
      metadata: {},
      currency: 'usd',
      amount: 2500,
    });
    (provider as never as Record<string, unknown>).polar = {
      checkouts: { create: createCheckoutMock },
    };
    return provider;
  };

  beforeEach(() => {
    createCheckoutMock.mockReset();
  });

  it('createCheckout sends an id-based customer as customerId (not silently dropped)', async () => {
    const provider = makeProviderWithPolar();

    await provider.createCheckout({
      customer: { id: 'cus_1' },
      item_id: 'prod_1',
      quantity: 1,
      session_type: 'one_time',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: null,
    } as never);

    const [options] = createCheckoutMock.mock.calls[0];
    expect(options.customerId).toBe('cus_1');
    expect(options.customerEmail).toBeUndefined();
  });

  it('createCheckout sends an email customer as customerEmail', async () => {
    const provider = makeProviderWithPolar();

    const checkout = await provider.createCheckout({
      customer: { email: 'buyer@example.com' },
      item_id: 'prod_1',
      quantity: 1,
      session_type: 'one_time',
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
      metadata: null,
    } as never);

    const [options] = createCheckoutMock.mock.calls[0];
    expect(options.customerEmail).toBe('buyer@example.com');
    expect(options.customerId).toBeUndefined();
    expect(checkout.id).toBe('checkout_1');
  });

  it('createPayment sends an id-based customer as customerId', async () => {
    const provider = makeProviderWithPolar();

    await provider.createPayment({
      customer: { id: 'cus_1' },
      amount: 2500,
      currency: 'usd',
      item_id: 'prod_1',
      capture_method: 'automatic',
    } as never);

    const [options] = createCheckoutMock.mock.calls[0];
    expect(options.customerId).toBe('cus_1');
  });
});

describe('PolarProvider.handleWebhook', () => {
  beforeEach(() => {
    validateEventMock.mockReset();
  });

  it('rejects when no webhook secret is configured', async () => {
    await expect(
      makeProvider().handleWebhook(dto(), null),
    ).rejects.toThrow(WebhookError);
    expect(validateEventMock).not.toHaveBeenCalled();
  });

  it('propagates signature-validation failures from the Polar SDK', async () => {
    validateEventMock.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    await expect(
      makeProvider().handleWebhook(dto(), 'whsec_test'),
    ).rejects.toThrow('invalid signature');
    expect(validateEventMock).toHaveBeenCalledWith(
      '{}',
      dto().headersAsObject,
      'whsec_test',
    );
  });

  it('emits a raw event plus customer.deleted mapping', async () => {
    validateEventMock.mockReturnValue({
      type: 'customer.deleted',
      data: { id: 'cus_1' },
    } as never);

    const events = await makeProvider().handleWebhook(
      dto(),
      'whsec_test',
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: 'wh_1',
      type: 'polar.customer.deleted',
      created: 1700000000,
      is_raw: true,
    });
    expect(events[1]).toMatchObject({
      type: 'customer.deleted',
      data: null,
    });
  });

  it('maps order.paid to payment.succeeded + invoice.generated', async () => {
    validateEventMock.mockReturnValue({
      type: 'order.paid',
      data: {
        id: 'order_1',
        totalAmount: 2500,
        currency: 'usd',
        customerId: 'cus_1',
        billingReason: 'purchase',
        status: 'paid',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        metadata: { ref: 'r1' },
        product: { id: 'prod_1' },
        customer: { email: 'buyer@example.com' },
        subscriptionId: null,
        items: [],
      },
    } as never);

    const events = await makeProvider().handleWebhook(
      dto(),
      'whsec_test',
    );

    expect(events.map(e => e.type)).toEqual([
      'polar.order.paid',
      'payment.succeeded',
      'invoice.generated',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'order_1',
      amount: 2500,
      currency: 'usd',
      status: 'succeeded',
      customer: { id: 'cus_1' },
      item_id: 'prod_1',
    });
    expect(events[2].data).toMatchObject({
      billing_mode: 'one_time',
    });
  });

  it('marks subscription-cycle orders as recurring invoices', async () => {
    validateEventMock.mockReturnValue({
      type: 'order.paid',
      data: {
        id: 'order_2',
        totalAmount: 900,
        currency: 'usd',
        customerId: 'cus_1',
        billingReason: 'subscription_cycle',
        status: 'paid',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        metadata: {},
        product: { id: 'prod_1' },
        customer: { email: 'buyer@example.com' },
        subscriptionId: 'sub_1',
        items: [],
      },
    } as never);

    const events = await makeProvider().handleWebhook(
      dto(),
      'whsec_test',
    );

    expect(events[2].data).toMatchObject({
      billing_mode: 'recurring',
    });
  });

  it('maps order.created to payment.created', async () => {
    validateEventMock.mockReturnValue({
      type: 'order.created',
      data: {
        id: 'order_3',
        totalAmount: 1500,
        currency: 'usd',
        customerId: 'cus_1',
        status: 'pending',
        metadata: {},
        product: { id: 'prod_1' },
        customer: { email: 'buyer@example.com' },
      },
    } as never);

    const events = await makeProvider().handleWebhook(
      dto(),
      'whsec_test',
    );

    expect(events.map(e => e.type)).toEqual([
      'polar.order.created',
      'payment.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'order_3',
      status: 'pending',
      requires_action: true,
    });
  });

  it('maps customer.created to customer.created', async () => {
    validateEventMock.mockReturnValue({
      type: 'customer.created',
      data: {
        id: 'cus_1',
        email: 'buyer@example.com',
        name: 'Buyer',
        metadata: {},
        createdAt: new Date('2026-01-01T00:00:00Z'),
        modifiedAt: null,
      },
    } as never);

    const events = await makeProvider().handleWebhook(
      dto(),
      'whsec_test',
    );

    expect(events.map(e => e.type)).toEqual([
      'polar.customer.created',
      'customer.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'cus_1',
      email: 'buyer@example.com',
    });
  });

  it('maps customer.updated to customer.updated', async () => {
    validateEventMock.mockReturnValue({
      type: 'customer.updated',
      data: {
        id: 'cus_1',
        email: 'buyer@example.com',
        name: 'Buyer',
        metadata: {},
        createdAt: new Date('2026-01-01T00:00:00Z'),
        modifiedAt: new Date('2026-01-02T00:00:00Z'),
      },
    } as never);

    const events = await makeProvider().handleWebhook(
      dto(),
      'whsec_test',
    );

    expect(events.map(e => e.type)).toEqual([
      'polar.customer.updated',
      'customer.updated',
    ]);
  });

  const subscriptionFixture = (
    extra: Record<string, unknown> = {},
  ) => ({
    id: 'sub_1',
    status: 'active',
    customerId: 'cus_1',
    customer: { email: 'buyer@example.com' },
    currentPeriodStart: '2026-01-01T00:00:00Z',
    currentPeriodEnd: '2026-02-01T00:00:00Z',
    metadata: {},
    customFieldData: null,
    productId: 'prod_1',
    recurringInterval: 'month',
    currency: 'usd',
    amount: 2000,
    ...extra,
  });

  it('maps subscription.created to subscription.created', async () => {
    validateEventMock.mockReturnValue({
      type: 'subscription.created',
      data: subscriptionFixture(),
    } as never);

    const events = await makeProvider().handleWebhook(
      dto(),
      'whsec_test',
    );

    expect(events.map(e => e.type)).toEqual([
      'polar.subscription.created',
      'subscription.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'sub_1',
      status: 'active',
    });
  });

  it('maps subscription.updated to subscription.updated', async () => {
    validateEventMock.mockReturnValue({
      type: 'subscription.updated',
      data: subscriptionFixture({ status: 'past_due' }),
    } as never);

    const events = await makeProvider().handleWebhook(
      dto(),
      'whsec_test',
    );

    expect(events.map(e => e.type)).toEqual([
      'polar.subscription.updated',
      'subscription.updated',
    ]);
    expect(events[1].data).toMatchObject({ status: 'past_due' });
  });

  it('maps subscription.revoked to subscription.canceled', async () => {
    validateEventMock.mockReturnValue({
      type: 'subscription.revoked',
      data: subscriptionFixture({ status: 'canceled' }),
    } as never);

    const events = await makeProvider().handleWebhook(
      dto(),
      'whsec_test',
    );

    expect(events.map(e => e.type)).toEqual([
      'polar.subscription.revoked',
      'subscription.canceled',
    ]);
    expect(events[1].data).toMatchObject({ status: 'canceled' });
  });

  it('maps refund.created to refund.created', async () => {
    validateEventMock.mockReturnValue({
      type: 'refund.created',
      data: {
        id: 'ref_1',
        amount: 500,
        currency: 'usd',
        reason: 'requested_by_customer',
        metadata: {},
      },
    } as never);

    const events = await makeProvider().handleWebhook(
      dto(),
      'whsec_test',
    );

    expect(events.map(e => e.type)).toEqual([
      'polar.refund.created',
      'refund.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'ref_1',
      amount: 500,
    });
  });

  it('emits only the raw event for unmapped types', async () => {
    validateEventMock.mockReturnValue({
      type: 'benefit.created',
      data: { id: 'ben_1' },
    } as never);

    const events = await makeProvider().handleWebhook(
      dto(),
      'whsec_test',
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('polar.benefit.created');
    expect(events[0].is_raw).toBe(true);
  });
});
