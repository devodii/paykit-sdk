# @paykit-sdk/xendit

Xendit provider for PayKit.

## Installation

```bash
npm install @paykit-sdk/xendit
# or
pnpm add @paykit-sdk/xendit
```

## Quick Start

```typescript
import { createEndpointHandlers, PayKit } from '@paykit-sdk/core';
import { xendit } from '@paykit-sdk/xendit';

export const paykit = new PayKit(xendit());
export const endpoints = createEndpointHandlers(paykit);
```

Or with direct config:

```typescript
import { PayKit } from '@paykit-sdk/core';
import { createXendit } from '@paykit-sdk/xendit';

export const paykit = new PayKit(
  createXendit({
    secretKey: 'xnd_development_...',
    isSandbox: true,
  }),
);
```

## Environment Variables

```bash
XENDIT_SECRET_KEY=xnd_development_...
```

`isSandbox` is inferred from `NODE_ENV` — set `NODE_ENV=production` for live mode. Whether requests actually hit test or live data is determined by whether `XENDIT_SECRET_KEY` is a `xnd_development_` or `xnd_production_` key, not by `isSandbox` itself.

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

Xendit verifies webhooks with a **Callback Verification Token** you copy from your Xendit dashboard — it's a plain string comparison via the `x-callback-token` header, not an HMAC signature.

```typescript
// app/api/paykit/webhooks/route.ts
import { paykit } from '@/lib/paykit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.text();

  const webhook = paykit.webhooks
    .setup({ webhookSecret: process.env.XENDIT_CALLBACK_TOKEN! })
    .on('payment.succeeded', async event => {
      /* invoice status PAID/SETTLED, or a succeeded recurring cycle */
    })
    .on('payment.failed', async event => {
      /* invoice status EXPIRED, or a failed recurring cycle */
    })
    .on('subscription.updated', async event => {
      /* recurring.plan.activated */
    })
    .on('subscription.canceled', async event => {
      /* recurring.plan.inactivated */
    });

  await webhook.handle({
    body,
    headersAsObject: Object.fromEntries(request.headers),
    fullUrl: request.url,
  });

  return NextResponse.json({ received: true });
}
```

## Checkout

Xendit checkouts are built on hosted Invoices and require an email customer and amount/currency in `provider_metadata`:

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
    currency: 'IDR',
  },
});

// Redirect user to checkout.payment_url
```

## Subscriptions

Xendit's Recurring Plans API has no separate reusable plan template — each plan already carries its own amount/currency/schedule, and requires a pre-created Xendit customer id plus at least one saved payment token:

```typescript
const subscription = await paykit.subscriptions.create({
  customer: { id: 'cust_xendit_id' },
  item_id: 'My Newspaper Subscription',
  quantity: 1,
  billing_interval: 'month',
  amount: 50000,
  currency: 'IDR',
  metadata: null,
  provider_metadata: {
    payment_tokens: [{ payment_token_id: 'pt-...', rank: 1 }],
  },
});
```

## Refunds

```typescript
const refund = await paykit.refunds.create({
  payment_id: 'invoice_id_from_the_original_checkout',
  amount: 400,
  reason: 'requested_by_customer',
  metadata: null,
});
```

## Unsupported

Xendit has no delete-customer API and no manual payment-capture API — `deleteCustomer` and `capturePayment` throw `ProviderNotSupportedError`. Use `cancelPayment` to expire a pending invoice instead.

## Documentation

Full docs at [docs.usepaykit.com/providers/xendit](https://docs.usepaykit.com/providers/xendit).

## Support

- [Xendit Documentation](https://docs.xendit.co)
- [PayKit Issues](https://github.com/usepaykit/paykit-sdk/issues)

## License

ISC
