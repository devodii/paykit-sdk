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
