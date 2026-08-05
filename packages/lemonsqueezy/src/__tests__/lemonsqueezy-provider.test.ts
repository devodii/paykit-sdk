import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LemonSqueezyProvider } from '../lemonsqueezy-provider';
import * as crypto from 'crypto';

describe('LemonSqueezyProvider', () => {
  let provider: LemonSqueezyProvider;

  beforeEach(() => {
    provider = new LemonSqueezyProvider({ apiKey: 'test_key' });
    // Mock the HTTP client
    vi.spyOn(provider._native as any, 'post').mockImplementation(async () => ({}));
    vi.spyOn(provider._native as any, 'get').mockImplementation(async () => ({}));
  });

  it('should initialize with correct name', () => {
    expect(provider.providerName).toBe('lemonsqueezy');
  });

  describe('createCustomer', () => {
    it('should map unified createCustomer to LemonSqueezy payload', async () => {
      const mockResponse = {
        ok: true,
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

      vi.spyOn(provider._native as any, 'post').mockResolvedValue(mockResponse);

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

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('order_created');
      expect(events[0].id).toBe('order_123');
      expect(events[0].data.attributes.total).toBe(1000);
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
