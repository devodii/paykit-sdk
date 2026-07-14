# @paykit-sdk/moneygram

MoneyGram provider for PayKit.

MoneyGram is a money-transfer (remittance) API, not a traditional
checkout/subscription processor - there's no customer-object API and no
recurring payments. `createPayment` and `createCheckout` both run MoneyGram's
full **Quote → Update → Commit** transfer flow as a single call (MoneyGram
has no separate hosted checkout page, so "checkout" here just means the same
transfer, mapped onto PayKit's `Checkout` shape).

## Quick Start

```typescript
import { createEndpointHandlers, PayKit } from '@paykit-sdk/core';
import { moneygram, createMoneygram } from '@paykit-sdk/moneygram';

// Method 1: Using environment variables
const provider = moneygram(); // Ensure required environment variables are set

// Method 2: Direct configuration
const provider = createMoneygram({
  clientId: process.env.MONEYGRAM_CLIENT_ID,
  clientSecret: process.env.MONEYGRAM_CLIENT_SECRET,
  agentPartnerId: process.env.MONEYGRAM_AGENT_PARTNER_ID,
  operatorId: process.env.MONEYGRAM_OPERATOR_ID,
  isSandbox: true,
  debug: true,
});

export const paykit = new PayKit(provider);
export const endpoints = createEndpointHandlers(paykit);
```

Required env vars for `moneygram()`:

```bash
MONEYGRAM_CLIENT_ID=...
MONEYGRAM_CLIENT_SECRET=...
MONEYGRAM_AGENT_PARTNER_ID=30150519
MONEYGRAM_OPERATOR_ID=paykit-web
MONEYGRAM_SANDBOX=true
```

`MONEYGRAM_POS_ID` is optional (defaults to `"01"`). There is no
`MONEYGRAM_WEBHOOK_*` env var read at construction time — see
[Webhooks](#webhooks) below for where the webhook key goes.

## Creating a transfer

```typescript
const payment = await paykit.payments.create({
  customer: { email: 'sender@example.com' },
  amount: 100,
  currency: 'USD',
  item_id: 'transfer-to-jane',
  capture_method: 'automatic', // MoneyGram commits immediately - manual capture isn't supported
  provider_metadata: {
    destinationCountryCode: 'PHL', // ISO alpha-3
    serviceOptionCode: 'WILL_CALL', // cash pickup; omit to let MoneyGram pick a default
    sender: {
      name: { firstName: 'John', lastName: 'Doe' },
      address: {
        line1: '123 Main St',
        city: 'Dallas',
        countryCode: 'USA',
      },
      mobilePhone: { number: '5551234567', countryDialCode: '1' },
      personalDetails: { dateOfBirth: '1990-01-01' },
      primaryIdentification: {
        typeCode: 'PPT',
        id: 'X1234567',
        issueCountryCode: 'USA',
      },
    },
    receiver: {
      name: { firstName: 'Jane', lastName: 'Smith' },
    },
  },
});
```

`sender` and `receiver` are required - MoneyGram has no customer-object API,
so full KYC data must be supplied on every transfer.

## Creating a checkout

Same flow, mapped onto `Checkout` instead of `Payment` - useful if your code
is already written against `paykit.checkouts`. Since `Checkout` has no
top-level `amount`/`currency`, both go in `provider_metadata` too:

```typescript
const checkout = await paykit.checkouts.create({
  customer: { email: 'sender@example.com' },
  item_id: 'transfer-to-jane',
  quantity: 1,
  session_type: 'one_time', // MoneyGram transfers are never recurring
  success_url: 'https://example.com/success', // unused - MoneyGram has no redirect step
  cancel_url: 'https://example.com/cancel', // unused - MoneyGram has no redirect step
  provider_metadata: {
    amount: 100,
    currency: 'USD',
    destinationCountryCode: 'PHL',
    serviceOptionCode: 'WILL_CALL',
    sender: {
      /* same shape as createPayment above */
    },
    receiver: {
      /* same shape as createPayment above */
    },
  },
});

// checkout.payment_url is a receipt link (valid 5 minutes), not a
// "go pay here" redirect - the transfer is already committed by the time
// createCheckout returns.
```

`retrieveCheckout`/`updateCheckout` work the same way as
`retrievePayment`/`updatePayment` (see below) - MoneyGram has one
transaction resource, not separate payment/checkout resources.
`deleteCheckout` throws `ProviderNotSupportedError`, same as `deletePayment`.

## Webhooks

MoneyGram doesn't use a shared secret for webhooks, and publishes exactly
one fixed public key per environment (sandbox/production) with no
per-partner issuance - so `webhookSecret` is unused. Pass `null`:

```typescript
const webhook = paykit.webhooks
  .setup({ webhookSecret: null }) // unused - always verified against MoneyGram's published sandbox/production key
  .on('payment.created', async event => {
    /* UNFUNDED - customer must fund at a MoneyGram store */
  })
  .on('payment.succeeded', async event => {
    /* SENT - committed, funded, and accepted */
  })
  .on('payment.updated', async event => {
    /* AVAILABLE / IN_TRANSIT / RECEIVED / DELIVERED / PROCESSING / CLOSED */
  })
  .on('payment.failed', async event => {
    /* REJECTED */
  })
  .on('refund.created', async event => {
    /* REFUNDED */
  });

await webhook.handle({
  body: await request.text(),
  headersAsObject: Object.fromEntries(request.headers),
  fullUrl: request.url,
});
```

## Unsupported operations

`createCustomer`, `createSubscription`, `capturePayment`, `cancelPayment`,
and `deleteCheckout`/`deletePayment` throw `ProviderNotSupportedError` -
MoneyGram has no customer storage, manual capture, recurring transfers, or a
way to delete/void a committed transfer. Use `createPayment` /
`createCheckout` / `createRefund` directly instead.
