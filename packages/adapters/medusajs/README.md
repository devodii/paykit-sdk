# @paykit-sdk/medusajs

Universal payment provider adapter for Medusa v2+ using PayKit. Compatible with any PayKit provider.

## Installation

```bash
npm install @paykit-sdk/medusajs @paykit-sdk/core
```

## Install your provider

```bash
npm install @paykit-sdk/stripe
```

## Usage

Configure in `medusa-config.ts`:

```typescript
import { defineConfig } from '@medusajs/framework/utils';
import { stripe } from '@paykit-sdk/stripe';

export default defineConfig({
  modules: [
    {
      resolve: '@medusajs/payment',
      options: {
        providers: [
          {
            resolve: '@paykit-sdk/medusajs',
            options: {
              provider: stripe(),
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
              debug: process.env.NODE_ENV === 'development',
              amountToCentsMultiplier: 100,
            },
          },
        ],
      },
    },
  ],
});
```

## Environment Variables

```env
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Webhook Setup

Configure your payment provider to send webhooks to:

```
https://your-store.com/hooks/payment/pp_paykit
```

Select payment-related events based on the PayKit provider documentation.

## Configuration Options

| Option        | Type           | Required | Description                  |
| ------------- | -------------- | -------- | ---------------------------- |
| provider      | PayKitProvider | Yes      | PayKit provider instance     |
| webhookSecret | string         | Yes      | Webhook secret from provider |
| debug         | boolean        | No       | Enable debug logging         |

## License

ISC
