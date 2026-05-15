# @paykit-sdk/gopay

GoPay provider for PayKit

## Quick Start

```typescript
import { createEndpointHandlers, PayKit } from '@paykit-sdk/core';
import { gopay, createGopay } from '@paykit-sdk/gopay';

// Method 1: Using environment variables
const provider = gopay(); // Ensure required environment variables are set

// Method 2: Direct configuration
const provider = createGopay({
  clientId: process.env.GOPAY_CLIENT_ID,
  clientSecret: process.env.GOPAY_CLIENT_SECRET,
  goId: process.env.GOPAY_GO_ID,
  isSandbox: true,
  webhookUrl: 'https://your-domain.com/api/paykit/webhooks',
  debug: true, // Enable to see helpful logs about provider_metadata
});

export const paykit = new PayKit(provider);
export const endpoints = createEndpointHandlers(paykit);
```

### Next.js Catch All API Route (/api/paykit/[...endpoint]/route.ts)

```typescript
import { endpoints } from '@/lib/paykit';
import { EndpointPath } from '@paykit-sdk/core';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> },
) {
  try {
    const { endpoint: endpointArray } = await params;
    // Construct the endpoint path with full type safety
    const endpoint = ('/' + endpointArray.join('/')) as EndpointPath;
    const handler = endpoints[endpoint];

    if (!handler) {
      return NextResponse.json(
        { message: 'Endpoint not found' },
        { status: 404 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { args } = body;

    const result = await handler(...args);

    return NextResponse.json({ result });
  } catch (error) {
    console.error('PayKit API Error:', error);
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
```

### Next.js Webhooks (/api/paykit/webhooks/route.ts)

**⚠️ IMPORTANT:** GoPay webhooks use GET requests instead of POST. Your webhook route must export a GET handler, not POST.

```typescript
import { paykit } from '@/lib/paykit';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const webhook = paykit.webhooks
    .setup({ webhookSecret: '' }) // GoPay doesn't use webhook secrets
    .on('customer.created', async event => {
      console.log('Customer created:', event.data);
    })
    .on('subscription.created', async event => {
      console.log('Subscription created:', event.data);
    })
    .on('payment.created', async event => {
      console.log('Payment created:', event.data);
    })
    .on('refund.created', async event => {
      console.log('Refund created:', event.data);
    })
    .on('invoice.generated', async event => {
      console.log('Invoice generated:', event.data);
    });

  const headers = request.headers;
  const url = request.url;

  try {
    console.log('Webhook handled');
    await webhook.handle({ body: '', headers, fullUrl: url });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
```

### Express.js with Webhook Handler

```typescript
import { paykit, endpoints } from '@/lib/paykit';
import { EndpointPath } from '@paykit-sdk/core';
import express from 'express';

const app = express();

// IMPORTANT: GoPay webhooks use GET requests, not POST
app.get('/api/webhooks/gopay', async (req, res) => {
  try {
    const webhook = paykit.webhooks
      .setup({ webhookSecret: '' }) // GoPay doesn't use webhook secrets
      .on('customer.created', async event => {
        console.log('Customer created:', event.data);
      })
      .on('subscription.created', async event => {
        console.log('Subscription created:', event.data);
      })
      .on('payment.created', async event => {
        console.log('Payment created:', event.data);
      })
      .on('refund.created', async event => {
        console.log('Refund created:', event.data);
      })
      .on('invoice.generated', async event => {
        console.log('Invoice generated:', event.data);
      });

    const body = ''; // GoPay sends data via URL query params
    const headers = req.headers;
    const url = req.url;
    await webhook.handle({ body, headers, fullUrl: url });

    // Return immediately, processing happens in background
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : 'Webhook processing failed',
    });
  }
});

// Regular API routes use JSON middleware
app.use(express.json());

app.post('/api/paykit/*', async (req, res) => {
  try {
    const endpoint = req.path.replace(
      '/api/paykit',
      '',
    ) as EndpointPath;
    const handler = endpoints[endpoint];

    if (!handler) {
      return res.status(404).json({ message: 'Endpoint not found' });
    }

    const { args } = req.body;
    const result = await handler(...args);

    res.json({ result });
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : 'Internal server error',
    });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Subscription Management

```typescript
// Cancel subscription
await paykit.subscriptions.cancel('sub_123');
```

## Provider Metadata

GoPay requires specific `provider_metadata` fields for different operations. Enable `debug: true` when initializing the provider to see helpful console logs that recommend which fields to use.

```typescript
const checkout = await paykit.checkouts.create({
  customer: { email: 'user@example.com' },
  item_id: 'item_123',
  session_type: 'one_time',
  quantity: 1,
  metadata: { plan: 'pro' },
  success_url: 'http://localhost:3000/success',
  cancel_url: 'http://localhost:3000/cancel',
  provider_metadata: {
    amount: '2900',
    currency: 'CZK',
    lang: 'en', // Language for the payment gateway (default: 'EN')
  },
});
```

## Environment Variables

```bash
GOPAY_CLIENT_ID=140...
GOPAY_CLIENT_SECRET=n6W...
GOPAY_GO_ID=864....
GOPAY_SANDBOX=true
GOPAY_WEBHOOK_URL=https://your-domain.com/api/paykit/webhooks
```

## Documentation

For detailed documentation, including setup guides, webhook configuration, and provider metadata requirements, see the [GoPay Provider Documentation](https://docs.usepaykit.com/providers/gopay).

## Support

- [GoPay Documentation](https://doc.gopay.com/)
- [PayKit Issues](https://github.com/usepaykit/paykit-sdk/issues)

## License

ISC
