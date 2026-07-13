# @paykit-sdk/mercadopago

Mercado Pago provider for PayKit.

## Installation

```bash
npm install @paykit-sdk/mercadopago
# or
pnpm add @paykit-sdk/mercadopago
```

## Quick Start

```typescript
import { createEndpointHandlers, PayKit } from '@paykit-sdk/core';
import { mercadoPago } from '@paykit-sdk/mercadopago';

export const paykit = new PayKit(mercadoPago());
export const endpoints = createEndpointHandlers(paykit);
```

Or with direct config:

```typescript
import { PayKit } from '@paykit-sdk/core';
import { createMercadoPago } from '@paykit-sdk/mercadopago';

export const paykit = new PayKit(
  createMercadoPago({
    accessToken: 'TEST-...',
    isSandbox: true,
  }),
);
```

## Environment Variables

```bash
MERCADOPAGO_ACCESS_TOKEN=TEST-...
```

`isSandbox` is inferred from `NODE_ENV` — set `NODE_ENV=production` for live mode. Whether requests actually hit test or live data is determined by whether `MERCADOPAGO_ACCESS_TOKEN` is a `TEST-` or `APP_USR-` token, not by `isSandbox` itself.

## Next.js API Route

```typescript
// app/api/paykit/[...endpoint]/route.ts
import { endpoints } from '@/lib/paykit';
import { EndpointPath } from '@paykit-sdk/core';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> },
) {
  const { endpoint: endpointArray } = await params;
  const endpoint = ('/' + endpointArray.join('/')) as EndpointPath;
  const handler = endpoints[endpoint];

  if (!handler) {
    return NextResponse.json(
      { message: 'Not found' },
      { status: 404 },
    );
  }

  const { args } = await request.json();
  const result = await handler(...args);
  return NextResponse.json({ result });
}
```

## Webhooks

Mercado Pago signs webhooks with a **secret signature** you configure separately in your integration's settings — it's not the same as your access token. Notifications only carry the resource type and id; the SDK fetches the full resource before mapping standard events.

```typescript
// app/api/paykit/webhooks/route.ts
import { paykit } from '@/lib/paykit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.text();

  const webhook = paykit.webhooks
    .setup({ webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET! })
    .on('payment.succeeded', async event => {
      /* payment status "approved" */
    })
    .on('payment.failed', async event => {
      /* payment status "rejected" or "cancelled" */
    })
    .on('refund.created', async event => {
      /* payment status "refunded" */
    })
    .on('subscription.updated', async event => {
      /* subscription_preapproval notifications */
    });

  await webhook.handle({
    body,
    headersAsObject: Object.fromEntries(request.headers),
    fullUrl: request.url,
  });

  return NextResponse.json({ received: true });
}
```

Mercado Pago sends the signature in the `x-signature` header (`ts=...,v1=...`), and the resource id in the `data.id` query parameter — both are required to recompute the HMAC.

## Checkout

Mercado Pago checkouts are built on Checkout Pro preferences and require an email customer and amount/currency in `provider_metadata`:

```typescript
const checkout = await paykit.checkouts.create({
  customer: { email: 'user@example.com' },
  item_id: 'plan_pro',
  session_type: 'one_time',
  quantity: 1,
  success_url: 'https://example.com/success',
  cancel_url: 'https://example.com/cancel',
  provider_metadata: {
    amount: '400',
    currency: 'ARS',
  },
});

// Redirect user to checkout.payment_url
```

## Subscriptions

Mercado Pago subscriptions require a pre-existing Plan (`preapproval_plan`) created via the dashboard or API — `item_id` maps to that plan's id:

```typescript
const subscription = await paykit.subscriptions.create({
  customer: { email: 'user@example.com' },
  item_id: 'plan_id_from_mercadopago',
  quantity: 1,
  billing_interval: 'month',
  amount: 4990,
  currency: 'ARS',
  metadata: null,
});

// Redirect user to subscription.payment_url to authorize the mandate
```

## Refunds

```typescript
const refund = await paykit.refunds.create({
  payment_id: '123456789',
  amount: 400,
  reason: 'requested_by_customer',
  metadata: null,
});
```

## Unsupported

Mercado Pago has no delete-preference API and no general payment-update API — `deleteCheckout` and `updatePayment` throw `ProviderNotSupportedError`. Use `capturePayment`/`cancelPayment` for payment state transitions instead.

## Documentation

Full docs at [docs.usepaykit.com/providers/mercadopago](https://docs.usepaykit.com/providers/mercadopago).

## Support

- [Mercado Pago Documentation](https://www.mercadopago.com/developers/en/reference)
- [PayKit Issues](https://github.com/usepaykit/paykit-sdk/issues)

## License

ISC
