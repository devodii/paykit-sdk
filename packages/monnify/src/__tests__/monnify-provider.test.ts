import { ConfigurationError, WebhookError } from '@paykit-sdk/core';
import { sha512 } from 'js-sha512';
import { describe, expect, it } from 'vitest';
import { MonnifyProvider } from '../monnify-provider';

const SECRET = 'monnify_test_secret';

const makeProvider = () =>
  new MonnifyProvider({
    apiKey: 'MK_TEST_KEY_ID',
    secretKey: 'MK_TEST_KEY_SECRET',
    isSandbox: true,
    debug: false,
  });

/** Signature as Monnify sends it: HMAC-SHA512 over the raw body. */
const sign = (rawBody: string, secret = SECRET) =>
  sha512.hmac(secret, rawBody);

const dto = (body: string, signature?: string) => ({
  body,
  headersAsObject: (signature
    ? { 'monnify-signature': signature }
    : {}) as Record<string, string>,
  fullUrl: 'https://app.example.com/api/webhook',
});

describe('MonnifyProvider constructor', () => {
  it('throws ConfigurationError when credentials are missing', () => {
    expect(
      () => new MonnifyProvider({ isSandbox: true } as never),
    ).toThrow(ConfigurationError);
  });

  it('exposes provider name and sandbox flag', () => {
    const provider = makeProvider();
    expect(provider.providerName).toBe('monnify');
    expect(provider.isSandbox).toBe(true);
  });
});

describe('MonnifyProvider.handleWebhook', () => {
  const successBody = JSON.stringify({
    eventType: 'SUCCESSFUL_TRANSACTION',
    eventData: {
      transactionReference: 'MNFY|1',
      amountPaid: 5000,
    },
  });

  it('rejects when no webhook secret is configured', async () => {
    await expect(
      makeProvider().handleWebhook(dto('{}'), null),
    ).rejects.toThrow(WebhookError);
  });

  it('rejects when the signature header is missing', async () => {
    await expect(
      makeProvider().handleWebhook(dto(successBody), SECRET),
    ).rejects.toThrow('Missing Monnify signature');
  });

  it('rejects an invalid signature', async () => {
    await expect(
      makeProvider().handleWebhook(
        dto(successBody, sign(successBody, 'wrong')),
        SECRET,
      ),
    ).rejects.toThrow('Invalid Monnify signature');
  });

  it('rejects a signature over a double-encoded payload', async () => {
    // Regression: the old implementation hashed JSON.stringify(body)
    // (the body double-encoded) and rejected all genuine webhooks
    await expect(
      makeProvider().handleWebhook(
        dto(successBody, sign(JSON.stringify(successBody))),
        SECRET,
      ),
    ).rejects.toThrow('Invalid Monnify signature');
  });

  it('accepts a genuine Monnify signature over the raw body', async () => {
    const events = await makeProvider().handleWebhook(
      dto(successBody, sign(successBody)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'monnify.SUCCESSFUL_TRANSACTION',
      'payment.created',
    ]);
    expect(events[0].is_raw).toBe(true);
    expect(events[0].data).toMatchObject({
      transactionReference: 'MNFY|1',
    });
  });

  it('maps REJECTED_PAYMENT to payment.failed', async () => {
    const body = JSON.stringify({
      eventType: 'REJECTED_PAYMENT',
      eventData: { transactionReference: 'MNFY|2' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'monnify.REJECTED_PAYMENT',
      'payment.failed',
    ]);
  });

  it('maps MANDATE_UPDATE by mandate status', async () => {
    const body = JSON.stringify({
      eventType: 'MANDATE_UPDATE',
      eventData: { mandateStatus: 'CANCELLED' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events.map(e => e.type)).toEqual([
      'monnify.MANDATE_UPDATE',
      'subscription.canceled',
    ]);
  });

  it('emits only the raw event for unknown event types', async () => {
    const body = JSON.stringify({
      eventType: 'SOMETHING_NEW',
      eventData: { ref: 'x' },
    });

    const events = await makeProvider().handleWebhook(
      dto(body, sign(body)),
      SECRET,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'monnify.SOMETHING_NEW',
      is_raw: true,
      data: { ref: 'x' },
    });
  });
});
