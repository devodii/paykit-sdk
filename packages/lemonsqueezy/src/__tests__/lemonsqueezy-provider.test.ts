import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LemonSqueezyProvider } from '../lemonsqueezy-provider';
import * as crypto from 'crypto';

describe('LemonSqueezyProvider', () => {
  let provider: LemonSqueezyProvider;

  beforeEach(() => {
    provider = new LemonSqueezyProvider({ apiKey: 'test_key', isSandbox: true });
    // Mock the HTTP client
    vi.spyOn(provider._native, 'post').mockImplementation(async () => ({ ok: true as const, value: undefined as never }));
    vi.spyOn(provider._native, 'get').mockImplementation(async () => ({ ok: true as const, value: undefined as never }));
  });

  it('should initialize with correct name', () => {
    expect(provider.providerName).toBe('lemonsqueezy');
  });

  describe('createCustomer', () => {
    it('should map unified createCustomer to LemonSqueezy payload', async () => {
      const mockResponse = {
        ok: true as const,
        value: {
          data: {
            type: 'customers',
            id: '123',
            attributes: {
              name: 'John Doe',
              email: 'john@example.com',
              status: 'subscribed',
              store_id: 1,
              created_at: '2023-01-01T00:00:00Z',
              updated_at: '2023-01-01T00:00:00Z',
              test_mode: true,
            },
          },
        },
      };

      vi.spyOn(provider._native, 'post').mockResolvedValue(mockResponse);

      const customer = await provider.createCustomer({
        email: 'john@example.com',
        name: 'John Doe',
        billing: null,
        provider_metadata: { store_id: 1 },
      });

      expect(provider._native.post).toHaveBeenCalledWith('/customers', {
        body: JSON.stringify({
          data: {
            type: 'customers',
            attributes: {
              name: 'John Doe',
              email: 'john@example.com',
            },
            relationships: {
              store: {
                data: { type: 'stores', id: '1' },
              },
            },
          },
        }),
      });

      expect(customer.id).toBe('123');
      expect(customer.name).toBe('John Doe');
      expect(customer.custom_fields?.store_id).toBe(1);
    });
  });

  describe('handleWebhook', () => {
    it('should verify signature and map event correctly', async () => {
      const secret = 'my_webhook_secret';
      const payloadBody = JSON.stringify({
        meta: { event_name: 'order_created' },
        data: { id: 'order_123', type: 'orders', attributes: { total: 1000 } },
      });

      const hmac = crypto.createHmac('sha256', secret);
      const signature = hmac.update(payloadBody).digest('hex');

      const events = await provider.handleWebhook(
        {
          body: payloadBody,
          headersAsObject: { 'x-signature': signature },
          fullUrl: 'http://localhost/webhook',
        },
        secret,
      );

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('lemonsqueezy.order_created');
      expect(events[0].id).toMatch(/^lemonsqueezy:order_created:/);
      expect(events[0].data.attributes.total).toBe(1000);

      expect(events[1].type).toBe('payment.updated');
      expect(events[1].data.amount).toBe(1000);
      expect(events[1].id).toMatch(/^paykit:order_created:/);
    });

    it('should throw ConfigurationError if no webhook secret is provided', async () => {
      await expect(
        provider.handleWebhook({ body: '', headersAsObject: {}, fullUrl: '' }, null),
      ).rejects.toThrow('Webhook secret is required for LemonSqueezy');
    });

    it('should throw OperationFailedError on invalid signature', async () => {
      const secret = 'my_webhook_secret';
      const payloadBody = JSON.stringify({ meta: { event_name: 'test' }, data: {} });

      await expect(
        provider.handleWebhook(
          {
            body: payloadBody,
            headersAsObject: { 'x-signature': 'invalid_signature_here' },
            fullUrl: 'http://localhost/webhook',
          },
          secret,
        ),
      ).rejects.toThrow('Failed to handleWebhook with lemonsqueezy');
    });
  });
});
