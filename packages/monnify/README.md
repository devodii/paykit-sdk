# @paykit-sdk/monnify

Monnify provider for PayKit.

## Installation

```bash
npm install @paykit-sdk/monnify
# or
pnpm add @paykit-sdk/monnify
```

## Quick Start

```typescript
import { createEndpointHandlers, PayKit } from '@paykit-sdk/core';
import { monnify } from '@paykit-sdk/monnify';

export const paykit = new PayKit(monnify());
export const endpoints = createEndpointHandlers(paykit);
```

Or with direct config:

```typescript
import { PayKit } from '@paykit-sdk/core';
import { createMonnify } from '@paykit-sdk/monnify';

export const paykit = new PayKit(
  createMonnify({
    apiKey: 'MK_TEST_...',
    secretKey: 'your-secret-key',
    isSandbox: true,
  }),
);
```

## Environment Variables

```bash
MONNIFY_API_KEY=MK_TEST_...
MONNIFY_SECRET_KEY=your-secret-key
MONNIFY_SANDBOX=true
```

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

Monnify sends signed POST requests with an HMAC-SHA512 signature.

```typescript
// app/api/paykit/webhooks/route.ts
import { paykit } from '@/lib/paykit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.text();

  const webhook = paykit.webhooks
    .setup({ webhookSecret: process.env.MONNIFY_SECRET_KEY! })
    .on('payment.created', async event => {
      /* SUCCESSFUL_TRANSACTION or SUCCESSFUL_TRANSACTION_OFFLINE */
    })
    .on('payment.updated', async event => {
      /* SETTLEMENT */
    })
    .on('payment.failed', async event => {
      /* REJECTED_PAYMENT */
    });

  await webhook.handle({
    body,
    headersAsObject: Object.fromEntries(request.headers),
    fullUrl: request.url,
  });

  return NextResponse.json({ received: true });
}
```

Monnify event mappings:

| Monnify event | PayKit event emitted |
| --- | --- |
| `SUCCESSFUL_TRANSACTION` | `payment.created` |
| `SUCCESSFUL_TRANSACTION_OFFLINE` | `payment.created` |
| `REJECTED_PAYMENT` | `payment.failed` |
| `SETTLEMENT` | `payment.updated` |

## Checkout

Monnify requires an email customer and amount/currency in `provider_metadata`:

```typescript
const checkout = await paykit.checkouts.create({
  customer: { email: 'user@example.com' },
  item_id: 'prod_123',
  session_type: 'one_time',
  quantity: 1,
  success_url: 'https://example.com/success',
  provider_metadata: {
    amount: 5000,
    currency: 'NGN',
  },
});

// Redirect user to checkout.payment_url
```

## Documentation

Full docs at [docs.usepaykit.com/providers/monnify](https://docs.usepaykit.com/providers/monnify).

## Support

- [Monnify Documentation](https://developers.monnify.com)
- [PayKit Issues](https://github.com/usepaykit/paykit-sdk/issues)

## License

ISC
