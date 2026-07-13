import { ConfigurationError, WebhookError } from '@paykit-sdk/core';
import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { StripeProvider } from '../stripe-provider';

const WEBHOOK_SECRET = 'whsec_test_secret';

const makeProvider = () =>
  new StripeProvider({ apiKey: 'sk_test_123', debug: false });

/** Sign a payload exactly like Stripe does, using the official helper. */
const signedHeaders = (payload: string) => {
  const stripe = new Stripe('sk_test_123');
  return {
    'stripe-signature': stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    }),
  };
};

const makeEvent = (
  type: string,
  object: Record<string, unknown> = {},
) =>
  JSON.stringify({
    id: 'evt_test_1',
    object: 'event',
    type,
    created: 1700000000,
    data: { object },
  });

describe('StripeProvider constructor', () => {
  it('throws ConfigurationError when apiKey is missing', () => {
    expect(() => new StripeProvider({} as never)).toThrow(
      ConfigurationError,
    );
  });

  it('detects sandbox mode from a test key', () => {
    expect(makeProvider().isSandbox).toBe(true);
    expect(
      new StripeProvider({ apiKey: 'sk_live_123', debug: false })
        .isSandbox,
    ).toBe(false);
  });

  it('honors an explicit isSandbox flag over key sniffing', () => {
    const provider = new StripeProvider({
      apiKey: 'sk_live_123',
      isSandbox: true,
      debug: false,
    });
    expect(provider.isSandbox).toBe(true);
  });

  it('exposes the native Stripe client', () => {
    expect(makeProvider()._native).toBeInstanceOf(Stripe);
  });
});

describe('StripeProvider.handleWebhook', () => {
  const fullUrl = 'https://app.example.com/api/webhook';

  it('rejects when no webhook secret is configured', async () => {
    await expect(
      makeProvider().handleWebhook(
        { body: '{}', headersAsObject: {}, fullUrl },
        null,
      ),
    ).rejects.toThrow(WebhookError);
  });

  it('rejects when the stripe-signature header is missing', async () => {
    await expect(
      makeProvider().handleWebhook(
        { body: '{}', headersAsObject: {}, fullUrl },
        WEBHOOK_SECRET,
      ),
    ).rejects.toThrow('Missing Stripe signature');
  });

  it('rejects a payload with an invalid signature', async () => {
    const body = makeEvent('customer.deleted');

    await expect(
      makeProvider().handleWebhook(
        {
          body,
          headersAsObject: {
            'stripe-signature': 't=1,v1=deadbeef',
          },
          fullUrl,
        },
        WEBHOOK_SECRET,
      ),
    ).rejects.toThrow();
  });

  it('rejects a tampered payload signed for different content', async () => {
    const original = makeEvent('customer.deleted');
    const tampered = makeEvent('customer.deleted', {
      injected: true,
    });

    await expect(
      makeProvider().handleWebhook(
        {
          body: tampered,
          headersAsObject: signedHeaders(original),
          fullUrl,
        },
        WEBHOOK_SECRET,
      ),
    ).rejects.toThrow();
  });

  it('emits a raw event plus the standard mapping for customer.deleted', async () => {
    const body = makeEvent('customer.deleted', {
      id: 'cus_1',
      object: 'customer',
      deleted: true,
    });

    const events = await makeProvider().handleWebhook(
      { body, headersAsObject: signedHeaders(body), fullUrl },
      WEBHOOK_SECRET,
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: 'evt_test_1',
      type: 'stripe.customer.deleted',
      is_raw: true,
    });
    expect(events[1]).toMatchObject({
      type: 'customer.deleted',
      data: null,
    });
  });

  it('emits subscription.canceled for customer.subscription.deleted', async () => {
    const body = makeEvent('customer.subscription.deleted', {
      id: 'sub_1',
      object: 'subscription',
    });

    const events = await makeProvider().handleWebhook(
      { body, headersAsObject: signedHeaders(body), fullUrl },
      WEBHOOK_SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'stripe.customer.subscription.deleted',
      'subscription.canceled',
    ]);
  });

  it('emits only the raw event for unmapped event types', async () => {
    const body = makeEvent('charge.succeeded', {
      id: 'ch_1',
      object: 'charge',
    });

    const events = await makeProvider().handleWebhook(
      { body, headersAsObject: signedHeaders(body), fullUrl },
      WEBHOOK_SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('stripe.charge.succeeded');
    expect(events[0].is_raw).toBe(true);
  });

  const emit = async (
    type: string,
    object: Record<string, unknown>,
  ) => {
    const body = makeEvent(type, object);
    return makeProvider().handleWebhook(
      { body, headersAsObject: signedHeaders(body), fullUrl },
      WEBHOOK_SECRET,
    );
  };

  it('emits invoice.generated for a one-time checkout.session.completed', async () => {
    const events = await emit('checkout.session.completed', {
      id: 'cs_1',
      object: 'checkout.session',
      mode: 'payment',
      custom_fields: [],
      amount_total: 1000,
      currency: 'usd',
      metadata: {},
      customer: 'cus_1',
      line_items: {
        data: [{ price: { id: 'price_1' }, quantity: 1 }],
      },
    });

    expect(events.map(e => e.type)).toEqual([
      'stripe.checkout.session.completed',
      'invoice.generated',
    ]);
    expect(events[1].data).toMatchObject({
      status: 'paid',
      amount_paid: 1000,
      currency: 'usd',
    });
  });

  it('emits only the raw event for checkout.session.completed in subscription mode', async () => {
    const events = await emit('checkout.session.completed', {
      id: 'cs_2',
      object: 'checkout.session',
      mode: 'subscription',
      custom_fields: [],
      amount_total: 1000,
      currency: 'usd',
      metadata: {},
      customer: 'cus_1',
      line_items: { data: [] },
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('stripe.checkout.session.completed');
  });

  it('emits invoice.generated for invoice.paid on a new subscription', async () => {
    const events = await emit('invoice.paid', {
      id: 'in_1',
      object: 'invoice',
      status: 'paid',
      billing_reason: 'subscription_create',
      currency: 'usd',
      customer: 'cus_1',
      amount_paid: 1000,
      lines: { data: [] },
      created: 1700000000,
      metadata: {},
      custom_fields: null,
    });

    expect(events.map(e => e.type)).toEqual([
      'stripe.invoice.paid',
      'invoice.generated',
    ]);
    expect(events[1].data).toMatchObject({
      amount_paid: 1000,
      currency: 'usd',
      billing_mode: 'recurring',
    });
  });

  it('emits only the raw event for invoice.paid with an unrelated billing_reason', async () => {
    const events = await emit('invoice.paid', {
      id: 'in_2',
      object: 'invoice',
      status: 'paid',
      billing_reason: 'manual',
      currency: 'usd',
      customer: 'cus_1',
      amount_paid: 1000,
      lines: { data: [] },
      metadata: {},
      custom_fields: null,
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('stripe.invoice.paid');
  });

  it('emits customer.created for customer.created', async () => {
    const events = await emit('customer.created', {
      id: 'cus_1',
      object: 'customer',
      email: 'buyer@example.com',
      name: 'Buyer',
      metadata: {},
      created: 1700000000,
    });

    expect(events.map(e => e.type)).toEqual([
      'stripe.customer.created',
      'customer.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'cus_1',
      email: 'buyer@example.com',
    });
  });

  it('emits customer.updated for customer.updated', async () => {
    const events = await emit('customer.updated', {
      id: 'cus_1',
      object: 'customer',
      email: 'buyer@example.com',
      name: 'Buyer',
      metadata: {},
      created: 1700000000,
    });

    expect(events.map(e => e.type)).toEqual([
      'stripe.customer.updated',
      'customer.updated',
    ]);
  });

  const subscriptionFixture = (
    extra: Record<string, unknown> = {},
  ) => ({
    id: 'sub_1',
    object: 'subscription',
    status: 'active',
    customer: 'cus_1',
    items: {
      data: [
        {
          id: 'si_1',
          price: {
            unit_amount: 1000,
            currency: 'usd',
            recurring: { interval: 'month' },
          },
        },
      ],
    },
    start_date: 1700000000,
    cancel_at: 1700003600,
    metadata: {},
    ...extra,
  });

  it('emits subscription.created for customer.subscription.created', async () => {
    const events = await emit(
      'customer.subscription.created',
      subscriptionFixture(),
    );

    expect(events.map(e => e.type)).toEqual([
      'stripe.customer.subscription.created',
      'subscription.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'sub_1',
      status: 'active',
    });
  });

  it('emits subscription.updated for customer.subscription.updated', async () => {
    const events = await emit(
      'customer.subscription.updated',
      subscriptionFixture({ status: 'past_due' }),
    );

    expect(events.map(e => e.type)).toEqual([
      'stripe.customer.subscription.updated',
      'subscription.updated',
    ]);
    expect(events[1].data).toMatchObject({ status: 'past_due' });
  });

  const paymentIntentFixture = (
    status: string,
    extra: Record<string, unknown> = {},
  ) => ({
    id: 'pi_1',
    object: 'payment_intent',
    amount: 1000,
    currency: 'usd',
    customer: null,
    status,
    metadata: {},
    ...extra,
  });

  it('emits payment.created for payment_intent.created', async () => {
    const events = await emit(
      'payment_intent.created',
      paymentIntentFixture('requires_payment_method'),
    );

    expect(events.map(e => e.type)).toEqual([
      'stripe.payment_intent.created',
      'payment.created',
    ]);
    expect(events[1].data).toMatchObject({
      id: 'pi_1',
      status: 'pending',
    });
  });

  it('emits payment.succeeded for payment_intent.succeeded', async () => {
    const events = await emit(
      'payment_intent.succeeded',
      paymentIntentFixture('succeeded'),
    );

    expect(events.map(e => e.type)).toEqual([
      'stripe.payment_intent.succeeded',
      'payment.succeeded',
    ]);
    expect(events[1].data).toMatchObject({ status: 'succeeded' });
  });

  it('emits payment.failed for payment_intent.canceled', async () => {
    const events = await emit(
      'payment_intent.canceled',
      paymentIntentFixture('canceled'),
    );

    expect(events.map(e => e.type)).toEqual([
      'stripe.payment_intent.canceled',
      'payment.failed',
    ]);
  });

  it('emits payment.failed for payment_intent.payment_failed', async () => {
    const events = await emit(
      'payment_intent.payment_failed',
      paymentIntentFixture('requires_payment_method'),
    );

    expect(events.map(e => e.type)).toEqual([
      'stripe.payment_intent.payment_failed',
      'payment.failed',
    ]);
  });

  it.each([
    'payment_intent.processing',
    'payment_intent.requires_action',
    'payment_intent.amount_capturable_updated',
    'payment_intent.partially_funded',
  ])('emits payment.updated for %s', async type => {
    const statusByType: Record<string, string> = {
      'payment_intent.processing': 'processing',
      'payment_intent.requires_action': 'requires_action',
      'payment_intent.amount_capturable_updated': 'requires_capture',
      'payment_intent.partially_funded': 'processing',
    };

    const events = await emit(
      type,
      paymentIntentFixture(statusByType[type]),
    );

    expect(events.map(e => e.type)).toEqual([
      `stripe.${type}`,
      'payment.updated',
    ]);
  });

  it('emits refund.created for refund.created', async () => {
    const events = await emit('refund.created', {
      id: 're_1',
      object: 'refund',
      amount: 500,
      currency: 'usd',
      reason: null,
      metadata: {},
    });

    expect(events.map(e => e.type)).toEqual([
      'stripe.refund.created',
      'refund.created',
    ]);
    expect(events[1].data).toMatchObject({ id: 're_1', amount: 500 });
  });
});
