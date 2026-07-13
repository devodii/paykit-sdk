import {
  ConfigurationError,
  ProviderNotSupportedError,
  ValidationError,
  WebhookError,
} from '@paykit-sdk/core';
import { createCipheriv, createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { RedsysProvider } from '../redsys-provider';

// Redsys's PUBLIC integration-docs test key (not a real secret).
const SECRET_KEY = 'sq7HjrUOBfKmC576ILgskD5srU870gJ7';

const makeProvider = (isSandbox = true) =>
  new RedsysProvider({
    merchantCode: '999008881',
    terminal: '1',
    secretKey: SECRET_KEY,
    isSandbox,
    debug: false,
  });

/**
 * Independent reimplementation of Redsys HMAC_SHA256_V1: derive the
 * per-order key by 3DES-CBC-encrypting the zero-padded order number
 * with the base64-decoded secret (zero IV), then HMAC-SHA256 the
 * Base64-encoded merchant parameters with that key.
 */
const deriveOrderKey = (orderId: string) => {
  const key = Buffer.from(SECRET_KEY, 'base64');
  const iv = Buffer.alloc(8, 0);
  const cipher = createCipheriv('des-ede3-cbc', key, iv);
  cipher.setAutoPadding(false);
  const padded = Buffer.alloc(Math.ceil(orderId.length / 8) * 8, 0);
  padded.write(orderId, 'utf8');
  return Buffer.concat([cipher.update(padded), cipher.final()]);
};

const sign = (orderId: string, base64Params: string) =>
  createHmac('sha256', deriveOrderKey(orderId))
    .update(base64Params)
    .digest('base64');

const encodeParams = (params: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(params)).toString('base64');

const webhookDto = (params: Record<string, unknown>) => {
  const base64Params = encodeParams(params);
  return {
    body: JSON.stringify({
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      Ds_MerchantParameters: base64Params,
      Ds_Signature: sign(String(params.Ds_Order), base64Params),
    }),
    headersAsObject: {},
    fullUrl: 'https://app.example.com/api/webhook',
  };
};

const checkoutParams = {
  customer: { email: 'buyer@example.com' },
  metadata: { amount: '1000', currency: 'EUR' },
  session_type: 'one_time' as const,
  item_id: 'item_1',
  quantity: 1,
  success_url: 'https://app.example.com/ok',
  cancel_url: 'https://app.example.com/no',
};

describe('RedsysProvider constructor', () => {
  it('throws ConfigurationError when secretKey is missing', () => {
    expect(
      () =>
        new RedsysProvider({
          merchantCode: '999008881',
          terminal: '1',
          isSandbox: true,
        } as never),
    ).toThrow(ConfigurationError);
  });

  it('honors an explicit redsysUrl override', async () => {
    const provider = new RedsysProvider({
      merchantCode: '999008881',
      terminal: '1',
      secretKey: SECRET_KEY,
      isSandbox: true,
      redsysUrl: 'https://custom.example.com/pay',
    });

    const checkout = await provider.createCheckout(checkoutParams);
    expect(checkout.payment_url).toBe(
      'https://custom.example.com/pay',
    );
  });

  it('points sandbox mode at the Redsys TEST endpoint', async () => {
    const checkout =
      await makeProvider(true).createCheckout(checkoutParams);
    expect(checkout.payment_url).toBe(
      'https://sis-t.redsys.es:25443/sis/realizarPago',
    );
  });

  it('points production mode at the LIVE endpoint', async () => {
    const checkout =
      await makeProvider(false).createCheckout(checkoutParams);
    expect(checkout.payment_url).toBe(
      'https://sis.redsys.es/sis/realizarPago',
    );
  });
});

describe('RedsysProvider.createCheckout', () => {
  it('returns signed inSite merchant parameters', async () => {
    const checkout =
      await makeProvider().createCheckout(checkoutParams);

    expect(checkout.id).toMatch(/^redsys_/);
    expect(checkout.amount).toBe(1000);
    expect(checkout.currency).toBe('EUR');
    expect(checkout.customer).toEqual({
      email: 'buyer@example.com',
    });
    expect(checkout.products).toEqual([
      { id: 'item_1', quantity: 1 },
    ]);

    const merchantParams = JSON.parse(
      Buffer.from(
        checkout.metadata!.redsys_merchant_params,
        'base64',
      ).toString('utf-8'),
    );
    expect(merchantParams).toMatchObject({
      DS_MERCHANT_MERCHANTCODE: '999008881',
      DS_MERCHANT_TERMINAL: '1',
      DS_MERCHANT_AMOUNT: '1000',
      DS_MERCHANT_CURRENCY: '978',
    });

    const orderId = merchantParams.DS_MERCHANT_ORDER;
    expect(checkout.metadata!.redsys_signature).toBe(
      sign(orderId, checkout.metadata!.redsys_merchant_params),
    );
  });

  it('requires amount and currency in metadata', async () => {
    await expect(
      makeProvider().createCheckout({
        ...checkoutParams,
        metadata: {},
      }),
    ).rejects.toThrow(/amount|currency/);
  });
});

describe('RedsysProvider unsupported operations', () => {
  it('rejects createCustomer as not supported', async () => {
    await expect(
      makeProvider().createCustomer({
        email: 'x@example.com',
      } as never),
    ).rejects.toThrow(ProviderNotSupportedError);
  });

  it('names redsys (not another provider) in the error', async () => {
    await expect(
      makeProvider().createCustomer({
        email: 'x@example.com',
      } as never),
    ).rejects.toThrow(/redsys/);
  });

  it('rejects createPayment without an operationId', async () => {
    await expect(
      makeProvider().createPayment({
        customer: { email: 'buyer@example.com' },
        amount: 1000,
        currency: 'EUR',
        metadata: {},
        item_id: 'item_1',
      } as never),
    ).rejects.toThrow(ValidationError);
  });
});

describe('RedsysProvider.handleWebhook', () => {
  it('rejects a payload without Ds_MerchantParameters', async () => {
    await expect(
      makeProvider().handleWebhook(
        {
          body: JSON.stringify({ Ds_Signature: 'x' }),
          headersAsObject: {},
          fullUrl: 'https://app.example.com/api/webhook',
        },
        '',
      ),
    ).rejects.toThrow(WebhookError);
  });

  it('rejects an invalid signature', async () => {
    const params = {
      Ds_Order: 'ABC123',
      Ds_Response: '0000',
      Ds_Amount: '1000',
    };
    const dto = webhookDto(params);
    const parsed = JSON.parse(dto.body);
    parsed.Ds_Signature = 'tampered';

    await expect(
      makeProvider().handleWebhook(
        { ...dto, body: JSON.stringify(parsed) },
        '',
      ),
    ).rejects.toThrow('Invalid Redsys webhook signature');
  });

  it('emits payment.succeeded for an approved payment', async () => {
    const events = await makeProvider().handleWebhook(
      webhookDto({
        Ds_Order: 'ABC123',
        Ds_Response: '0000',
        Ds_Amount: '1000',
        Ds_AuthorisationCode: '999999',
        Ds_MerchantData: Buffer.from(
          JSON.stringify({ customerId: 'cus_1' }),
        ).toString('base64'),
      }),
      '',
    );

    expect(events).toHaveLength(2);
    const standard = events[1];
    expect(standard.type).toBe('payment.succeeded');
    expect(standard.data).toMatchObject({
      id: 'ABC123_999999',
      status: 'succeeded',
      customer: { id: 'cus_1' },
    });

    // Amounts stay in minor units end-to-end
    expect((standard.data as { amount: number }).amount).toBe(1000);

    // The raw event uses the standard payload shape so the Webhook
    // dispatcher can deliver it to raw-event subscribers
    expect(events[0]).toMatchObject({
      type: 'redsys.payment.succeeded',
      is_raw: true,
    });
  });

  it('treats any 00xx response code as approved, not just 0000', async () => {
    const events = await makeProvider().handleWebhook(
      webhookDto({
        Ds_Order: 'GHI789',
        Ds_Response: '0099',
        Ds_Amount: '1500',
        Ds_AuthorisationCode: '888888',
      }),
      '',
    );

    expect(events[1].type).toBe('payment.succeeded');
    expect(events[1].data).toMatchObject({ status: 'succeeded' });
  });

  it('emits payment.failed for a declined payment', async () => {
    const events = await makeProvider().handleWebhook(
      webhookDto({
        Ds_Order: 'DEF456',
        Ds_Response: '0180',
        Ds_Amount: '2000',
      }),
      '',
    );

    expect(events).toHaveLength(2);
    expect(events[1].type).toBe('payment.failed');
    expect(events[1].data).toMatchObject({
      id: 'DEF456',
      status: 'failed',
    });
  });

  it('treats a missing Ds_MerchantData as an unknown customer', async () => {
    const events = await makeProvider().handleWebhook(
      webhookDto({
        Ds_Order: 'GHI789',
        Ds_Response: '0000',
        Ds_Amount: '1000',
      }),
      '',
    );

    expect(events[1].data).toMatchObject({ customer: null });
  });

  it('maps Ds_Currency back to an ISO currency code', async () => {
    const events = await makeProvider().handleWebhook(
      webhookDto({
        Ds_Order: 'JKL012',
        Ds_Response: '0000',
        Ds_Amount: '1000',
        Ds_Currency: '840',
      }),
      '',
    );

    expect(events[1].data).toMatchObject({ currency: 'USD' });
  });
});
