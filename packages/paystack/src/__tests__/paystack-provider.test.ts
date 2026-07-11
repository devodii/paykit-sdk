import { ConfigurationError, WebhookError } from '@paykit-sdk/core';
import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { PaystackProvider } from '../paystack-provider';
import { Checkout$inboundSchema } from '../utils/mapper';

const SECRET = 'sk_test_paystack_secret';

const makeProvider = () =>
  new PaystackProvider({
    secretKey: SECRET,
    isSandbox: true,
    debug: false,
  });

const sign = (body: string, secret = SECRET) =>
  createHmac('sha512', secret).update(body).digest('hex');

const dto = (
  body: string,
  signature: string | undefined = undefined,
) => ({
  body,
  headersAsObject: (signature
    ? { 'x-paystack-signature': signature }
    : {}) as Record<string, string>,
  fullUrl: 'https://app.example.com/api/webhook',
});

describe('PaystackProvider constructor', () => {
  it('throws ConfigurationError when secretKey is missing', () => {
    expect(
      () => new PaystackProvider({ isSandbox: true } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('paystack');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('Checkout$inboundSchema', () => {
  it('recovers products and session type from paykit metadata', () => {
    // Regression: an unreachable typeof check used to leave products
    // as [{id: '', quantity: 1}] no matter what the metadata carried
    const checkout = Checkout$inboundSchema(
      {
        reference: 'ref_1',
        authorization_url: 'https://checkout.paystack.com/ref_1',
        access_code: 'ac_1',
      } as never,
      {
        currency: 'NGN',
        amount: 10000,
        metadata: JSON.stringify({
          __paykit: JSON.stringify({
            item_id: 'item_9',
            quantity: 2,
            type: 'one_time',
          }),
        }) as never,
      },
    );

    expect(checkout.products).toEqual([
      { id: 'item_9', quantity: 2 },
    ]);
    expect(checkout.session_type).toBe('one_time');
    expect(checkout.payment_url).toBe(
      'https://checkout.paystack.com/ref_1',
    );
  });
});

describe('PaystackProvider.handleWebhook', () => {
  it('rejects when no webhook secret is configured', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), null),
    ).rejects.toThrow(WebhookError);
  });

  it('rejects when the signature header is missing', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), SECRET),
    ).rejects.toThrow('Missing x-paystack-signature header');
  });

  it('rejects an invalid signature', async () => {
    const body = JSON.stringify({
      event: 'charge.success',
      data: {},
    });

    await expect(
      makeProvider().handleWebhook(
        dto(body, sign(body, 'wrong_secret')),
        SECRET,
      ),
    ).rejects.toThrow('Invalid Paystack webhook signature');
  });

  it('rejects a correctly signed but non-JSON payload', async () => {
    const body = 'not-json';

    await expect(
      makeProvider().handleWebhook(dto(body, sign(body)), SECRET),
    ).rejects.toThrow('Invalid webhook payload: not valid JSON');
  });

  it('always emits the raw provider event', async () => {
    const body = JSON.stringify({
      event: 'transfer.success',
      data: { reference: 'ref_1' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'paystack.transfer.success',
      is_raw: true,
      data: { reference: 'ref_1' },
    });
  });

  it('maps subscription.disable to subscription.canceled', async () => {
    const body = JSON.stringify({
      event: 'subscription.disable',
      data: { subscription_code: 'SUB_1' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'paystack.subscription.disable',
      'subscription.canceled',
    ]);
    expect(events[1].data).toBeNull();
  });

  it('maps charge.failed to payment.failed', async () => {
    const body = JSON.stringify({
      event: 'charge.failed',
      data: {
        reference: 'ref_9',
        amount: 5000,
        currency: 'NGN',
        status: 'failed',
        metadata: '{}',
        customer: { email: 'buyer@example.com' },
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events).toHaveLength(2);
    expect(events[1].type).toBe('payment.failed');
    expect(events[1].data).toMatchObject({
      id: 'ref_9',
      amount: 5000,
      currency: 'NGN',
      status: 'failed',
      customer: { email: 'buyer@example.com' },
    });
  });

  it('maps charge.success to payment.updated + invoice.generated', async () => {
    const body = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 12345,
        reference: 'ref_10',
        amount: 10000,
        currency: 'NGN',
        status: 'success',
        metadata: '{}',
        paid_at: '2026-01-01T00:00:00.000Z',
        customer: { email: 'buyer@example.com' },
      },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'paystack.charge.success',
      'payment.updated',
      'invoice.generated',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'ref_10',
      status: 'succeeded',
    });
    expect(events[2].data).toMatchObject({
      amount_paid: 10000,
      currency: 'NGN',
      status: 'paid',
    });
  });
});
