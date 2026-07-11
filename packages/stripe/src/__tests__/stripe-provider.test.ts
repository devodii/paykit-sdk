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
});
