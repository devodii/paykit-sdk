import { describe, expect, it, vi } from 'vitest';
import { WebhookError } from './error';
import type { PayKitProvider } from './paykit-provider';
import { Webhook } from './webhook-provider';

const makeProvider = (
  events: Array<Record<string, unknown>>,
): PayKitProvider =>
  ({
    providerName: 'fake',
    handleWebhook: vi.fn().mockResolvedValue(events),
  }) as unknown as PayKitProvider;

const dto = {
  body: '{}',
  headersAsObject: {},
  fullUrl: 'https://app.example.com/webhook',
};

describe('Webhook', () => {
  it('throws when used before setup()', async () => {
    const webhook = new Webhook();

    expect(() =>
      webhook.on('payment.succeeded', async () => {}),
    ).toThrow(WebhookError);
    await expect(webhook.handle(dto)).rejects.toThrow(WebhookError);
  });

  it('dispatches standard events to their handlers', async () => {
    const event = {
      id: 'evt_1',
      type: 'payment.succeeded',
      created: 123,
      data: { id: 'pay_1', amount: 1000 },
    };
    const handler = vi.fn().mockResolvedValue(undefined);

    const webhook = new Webhook()
      .setup({ webhookSecret: 's', provider: makeProvider([event]) })
      .on('payment.succeeded', handler);

    await webhook.handle(dto);

    // Non-raw events are delivered as the full event payload
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('delivers raw events with their inner data only', async () => {
    const rawEvent = {
      id: 'evt_raw',
      type: 'fake.charge.succeeded',
      created: 123,
      data: { native: true },
      is_raw: true,
    };
    const handler = vi.fn().mockResolvedValue(undefined);

    const webhook = new Webhook<Record<string, unknown>>()
      .setup({
        webhookSecret: null,
        provider: makeProvider([rawEvent]),
      })
      .on('fake.charge.succeeded', handler as never);

    await webhook.handle(dto);

    expect(handler).toHaveBeenCalledWith({ native: true });
  });

  it('supports multiple handlers per event type', async () => {
    const event = {
      id: 'evt_1',
      type: 'customer.created',
      created: 1,
      data: {},
    };
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);

    const webhook = new Webhook()
      .setup({ webhookSecret: 's', provider: makeProvider([event]) })
      .on('customer.created', first)
      .on('customer.created', second);

    await webhook.handle(dto);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('ignores events with no registered handler', async () => {
    const event = {
      id: 'evt_1',
      type: 'refund.created',
      created: 1,
      data: {},
    };
    const handler = vi.fn();

    const webhook = new Webhook()
      .setup({ webhookSecret: 's', provider: makeProvider([event]) })
      .on('payment.failed', handler);

    await expect(webhook.handle(dto)).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('propagates handler rejections', async () => {
    const event = {
      id: 'evt_1',
      type: 'payment.failed',
      created: 1,
      data: {},
    };

    const webhook = new Webhook()
      .setup({ webhookSecret: 's', provider: makeProvider([event]) })
      .on('payment.failed', async () => {
        throw new Error('handler exploded');
      });

    await expect(webhook.handle(dto)).rejects.toThrow(
      'handler exploded',
    );
  });
});
