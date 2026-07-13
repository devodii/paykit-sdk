# @paykit-sdk/razorpay

Razorpay provider for PayKit.

## Installation

```bash
npm install @paykit-sdk/razorpay
# or
pnpm add @paykit-sdk/razorpay
```

## Quick Start

```typescript
import { createEndpointHandlers, PayKit } from '@paykit-sdk/core';
import { razorpay } from '@paykit-sdk/razorpay';

export const paykit = new PayKit(razorpay());
export const endpoints = createEndpointHandlers(paykit);
```

Or with direct config:

```typescript
import { PayKit } from '@paykit-sdk/core';
import { createRazorpay } from '@paykit-sdk/razorpay';

export const paykit = new PayKit(
  createRazorpay({
    keyId: 'rzp_test_...',
    keySecret: '...',
    isSandbox: true,
  }),
);
```

## Environment Variables

```bash
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

`isSandbox` is inferred from `NODE_ENV` — set `NODE_ENV=production` for live mode. Whether requests actually hit test or live data is determined by whether `RAZORPAY_KEY_ID` is a `rzp_test_` or `rzp_live_` key, not by `isSandbox` itself.

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

Razorpay signs webhook requests with the webhook secret you configure in the Razorpay dashboard — this is separate from your API key secret.

```typescript
// app/api/paykit/webhooks/route.ts
import { paykit } from '@/lib/paykit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.text();

  const webhook = paykit.webhooks
    .setup({ webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET! })
    .on('payment.succeeded', async event => {
      /* payment.captured / order.paid / subscription.charged */
    })
    .on('payment.failed', async event => {
      /* payment.failed */
    })
    .on('refund.created', async event => {
      /* refund.created / refund.processed */
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

Razorpay checkouts are built on Payment Links and require an email customer and amount/currency in `provider_metadata`:

```typescript
const checkout = await paykit.checkouts.create({
  customer: { email: 'user@example.com' },
  item_id: 'plan_pro',
  session_type: 'one_time',
  quantity: 1,
  success_url: 'https://example.com/success',
  cancel_url: 'https://example.com/cancel',
  provider_metadata: {
    amount: '40000',
    currency: 'INR',
  },
});

// Redirect user to checkout.payment_url
```

## Subscriptions

Razorpay subscriptions require a pre-existing Plan created via the Razorpay dashboard or API — `item_id` maps to that `plan_id`. Razorpay also requires either `total_count` or `end_at` to create a subscription:

```typescript
const subscription = await paykit.subscriptions.create({
  customer: { email: 'user@example.com' },
  item_id: 'plan_00000000000001',
  quantity: 1,
  billing_interval: 'month',
  amount: 49900,
  currency: 'INR',
  metadata: null,
  provider_metadata: {
    total_count: 12,
  },
});

// Redirect user to subscription.payment_url to authorize the mandate
```

## Refunds

```typescript
const refund = await paykit.refunds.create({
  payment_id: 'pay_...',
  amount: 40000,
  reason: 'requested_by_customer',
  metadata: null,
});
```

Omit `amount` from `provider_metadata` for a full refund of the remaining captured amount.

## Unsupported

Razorpay has no delete-customer API and no cancel-payment/void API — `deleteCustomer` and `cancelPayment` throw `ProviderNotSupportedError`. Use `createRefund` to reverse a captured payment instead of canceling it.

## Documentation

Full docs at [docs.usepaykit.com/providers/razorpay](https://docs.usepaykit.com/providers/razorpay).

## Support

- [Razorpay Documentation](https://razorpay.com/docs/api/)
- [PayKit Issues](https://github.com/usepaykit/paykit-sdk/issues)

## License

ISC
