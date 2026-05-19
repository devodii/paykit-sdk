# @paykit-sdk/redsys

Redsys inSite provider for PayKit.

## Overview

This package integrates Redsys's inSite payment method into PayKit. inSite allows customers to enter their card details directly on your website through secure iframes hosted by Redsys, without redirecting to an external payment page.

## Installation

```bash
npm install @paykit-sdk/redsys
# or
pnpm add @paykit-sdk/redsys
```

## Quick Start

```typescript
import { createEndpointHandlers, PayKit } from '@paykit-sdk/core';
import { redsys } from '@paykit-sdk/redsys';

// Configure the provider
const provider = redsys();
// or with manual config:
import { createRedsys } from '@paykit-sdk/redsys';
const provider = createRedsys({
  merchantCode: process.env.REDSYS_MERCHANT_CODE,
  terminal: process.env.REDSYS_TERMINAL,
  secretKey: process.env.REDSYS_SECRET_KEY,
  environment: 'sandbox', // or 'production'
  transactionType: '0',   // '0' = immediate, '1' = pre-auth
});

export const paykit = new PayKit(provider);
export const endpoints = createEndpointHandlers(paykit);
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `REDSYS_MERCHANT_CODE` | Your Redsys merchant code |
| `REDSYS_TERMINAL` | Terminal number |
| `REDSYS_SECRET_KEY` | HMAC-SHA256 secret key from Redsys backend |
| `REDSYS_TRANSACTION_TYPE` | `"0"` (immediate) or `"1"` (pre-authorization) |

## Flow

1. **Create Checkout** → returns merchant parameters + signature for inSite iframe
2. **Frontend loads inSite** → renders secure card input iframes
3. **User enters card** → Redsys returns `operationId`
4. **Create Payment** → pass `operationId` in `provider_metadata.operationId`
5. **Webhooks** → server-side notifications for payment status

## Frontend Integration

The `createCheckout` response includes inSite parameters in metadata:

```typescript
const checkout = await paykit.createCheckout(params);

// These fields from checkout.metadata are needed for inSite:
const { 
  redsys_merchant_params,
  redsys_signature,
  redsys_signature_version,
  redsys_merchant_code,
  redsys_terminal,
} = checkout.metadata;
```

Load the Redsys inSite script and initialize:

```html
<script src="https://sis-t.REDsys.es:25443/sis/rest/register/v2/redsysV3.js"></script>

<script>
  // After checkout is created:
  getInSiteForm(
    'card-form',           // container ID
    {},                    // button styles
    {},                    // body styles
    {},                    // box styles
    {},                    // input styles
    'Pay now',             // button text (HTML encoded)
    callbackFunction,       // callback with operationId
    terminal,
    orderId
  );
</script>
```

## License

MIT