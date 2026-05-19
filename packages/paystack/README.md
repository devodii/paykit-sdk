# @paykit-sdk/paystack

Paystack provider for PayKit.

## Installation

```bash
npm install @paykit-sdk/paystack
# or
pnpm add @paykit-sdk/paystack
```

## Quick Start

```typescript
import { createEndpointHandlers, PayKit } from '@paykit-sdk/core';
import { paystack } from '@paykit-sdk/paystack';

export const paykit = new PayKit(paystack());
export const endpoints = createEndpointHandlers(paykit);
```

Or with direct config:

```typescript
import { PayKit } from '@paykit-sdk/core';
import { createPaystack } from '@paykit-sdk/paystack';

export const paykit = new PayKit(
  createPaystack({
    secretKey: 'sk_test_...',
    isSandbox: true,
  }),
);
```

## Environment Variables

```bash
PAYSTACK_SECRET_KEY=sk_test_...
```

`isSandbox` is inferred from `NODE_ENV` — set `NODE_ENV=production` for live mode.

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
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  const { args } = await request.json();
  const result = await handler(...args);
  return NextResponse.json({ result });
}
```

## Webhooks

Paystack sends signed POST requests. Pass your webhook secret to verify signatures.

```typescript
// app/api/paykit/webhooks/route.ts
import { paykit } from '@/lib/paykit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.text();

  const webhook = paykit.webhooks
    .setup({ webhookSecret: process.env.PAYSTACK_SECRET_KEY! })
    .on('payment.created', async event => {
      /* charge.success — pending authorization */
    })
    .on('payment.updated', async event => {
      /* charge.dispute.create — pre-auth hold updated */
    })
    .on('payment.failed', async event => {
      /* charge.failed */
    })
    .on('invoice.generated', async event => {
      /* invoice.payment_failed or invoice.update */
    })
    .on('customer.created', async event => {
      /* customeridentification.success */
    })
    .on('customer.updated', async event => {
      /* customeridentification.failed */
    })
    .on('subscription.created', async event => {
      /* subscription.create */
    })
    .on('subscription.canceled', async event => {
      /* subscription.disable */
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

Paystack requires an email customer and amount/currency in `provider_metadata`:

```typescript
const checkout = await paykit.checkouts.create({
  customer: { email: 'user@example.com' },
  item_id: 'plan_pro',
  session_type: 'one_time',
  quantity: 1,
  success_url: 'https://example.com/success',
  provider_metadata: {
    amount: 50000, // in kobo (NGN) or smallest currency unit
    currency: 'NGN',
  },
});

// Redirect user to checkout.payment_url
```

## Documentation

Full docs at [docs.usepaykit.com/providers/paystack](https://docs.usepaykit.com/providers/paystack).

## Support

- [Paystack Documentation](https://paystack.com/docs)
- [PayKit Issues](https://github.com/usepaykit/paykit-sdk/issues)

## License

ISC
