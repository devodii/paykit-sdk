# @paykit-sdk/chapa

Chapa provider for PayKit.

## Installation

```bash
npm install @paykit-sdk/chapa
# or
pnpm add @paykit-sdk/chapa
```

## Quick Start

```typescript
import { chapa } from '@paykit-sdk/chapa';
import { createEndpointHandlers, PayKit } from '@paykit-sdk/core';

export const paykit = new PayKit(chapa());
export const endpoints = createEndpointHandlers(paykit);
```

Or with direct config:

```typescript
import { createChapa } from '@paykit-sdk/chapa';
import { PayKit } from '@paykit-sdk/core';

export const paykit = new PayKit(
  createChapa({
    secretKey: 'CHASECK_TEST-...',
    isSandbox: true,
  }),
);
```

## Environment Variables

```bash
CHAPA_SECRET_KEY=CHASECK_TEST-...
```

`isSandbox` is inferred from `NODE_ENV` — set `NODE_ENV=production` for live mode. Whether requests actually hit test or live data is determined by whether `CHAPA_SECRET_KEY` is a `CHASECK_TEST-` or `CHASECK-` key, not by `isSandbox` itself.

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

Chapa sends signed POST requests, using your secret key as the webhook secret — there is no separate webhook signing secret to configure.

```typescript
// app/api/paykit/webhooks/route.ts
import { paykit } from '@/lib/paykit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.text();

  const webhook = paykit.webhooks
    .setup({ webhookSecret: process.env.CHAPA_SECRET_KEY! })
    .on('payment.updated', async event => {
      /* charge.success */
    })
    .on('payment.failed', async event => {
      /* charge.failed/cancelled */
    })
    .on('invoice.generated', async event => {
      /* charge.success */
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

Chapa requires an email customer and amount/currency in `provider_metadata`:

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
    currency: 'ETB',
  },
});

// Redirect user to checkout.payment_url
```

## Refunds

Refunds are always sent with an explicit `amount` — pass the full transaction amount for a full refund.

```typescript
const refund = await paykit.refunds.create({
  payment_id: 'tx_ref_from_the_original_transaction',
  amount: 400,
  reason: 'requested_by_customer',
  metadata: null,
});
```

## Unsupported

Chapa has no customer management API and no subscription/plan API — `createCustomer`, `createSubscription`, and related methods throw `ProviderNotSupportedError`. Customer details are captured inline with each transaction instead.

## Documentation

Full docs at [docs.usepaykit.com/providers/chapa](https://docs.usepaykit.com/providers/chapa).

## Support

- [Chapa Documentation](https://developer.chapa.co)
- [PayKit Issues](https://github.com/usepaykit/paykit-sdk/issues)

## License

ISC
