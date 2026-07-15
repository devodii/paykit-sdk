# @paykit-sdk/remita

Remita provider for PayKit.

Remita's "Invoice Generation" API is a Remita Retrieval Reference (RRR)
based collection flow, not a hosted checkout - `createPayment`
generates an RRR that the payer completes through Remita's own
channels (bank transfer, USSD, card, agent), outside of this
integration. There is no `payment_url`, no customer-object API, and no
recurring/subscription API (Remita's recurring billing is a separate
Direct Debit product with its own auth/endpoints, out of scope here).

## Quick Start

```typescript
import { createEndpointHandlers, PayKit } from '@paykit-sdk/core';
import { remita, createRemita } from '@paykit-sdk/remita';

// Method 1: Using environment variables
const provider = remita(); // Ensure required environment variables are set

// Method 2: Direct configuration
const provider = createRemita({
  merchantId: process.env.REMITA_MERCHANT_ID,
  apiKey: process.env.REMITA_API_KEY,
  serviceTypeId: process.env.REMITA_SERVICE_TYPE_ID,
  isSandbox: true,
  debug: true,
});

export const paykit = new PayKit(provider);
export const endpoints = createEndpointHandlers(paykit);
```

Required env vars for `remita()`:

```bash
REMITA_MERCHANT_ID=...
REMITA_API_KEY=...
REMITA_SERVICE_TYPE_ID=...
REMITA_SANDBOX=true
```

`REMITA_BASE_URL` is required once `REMITA_SANDBOX=false` - **Remita
does not publish a fixed production base URL** for this API in their
docs; it's issued per-merchant after KYC/go-live, from the
Administration Menu -> "API Keys and Webhooks" page.

## Creating a payment

```typescript
const payment = await paykit.payments.create({
  customer: { email: 'payer@example.com' },
  amount: 20000,
  currency: 'NGN',
  item_id: 'invoice-1',
  capture_method: 'automatic', // Remita has no manual capture
  provider_metadata: {
    payerName: 'John Doe', // required - Remita has no customer API to source this from
    payerPhone: '09062067384', // required
    // serviceTypeId: 'override', // optional - overrides the provider-level default
    // expiryDate: '31/12/2026',  // optional, format DD/MM/YYYY
  },
});

// payment.id is the RRR - direct your payer to complete payment
// against it through Remita's channels. payment.payment_url is
// always null; there is no hosted redirect.
```

`payerName` and `payerPhone` must be supplied in `provider_metadata`
because PayKit's customer object only carries an email/id, and
Remita's Invoice Generation API requires both.

## Checking payment status

```typescript
const payment = await paykit.payments.retrieve(payment.id); // RRR
```

Remita's status API (`status.reg`) returns only `{ amount, RRR,
orderId, message, transactiontime, status, paymentDate? }` - it does
not echo back the payer's email, `item_id`, or `metadata`. Those
fields are only ever populated on the object returned synchronously
from `createPayment`; a subsequent `retrievePayment` always returns
`customer: null`, `item_id: null`, `metadata: {}`.

Only status codes `00` and `01` mean the RRR has been paid (per
Remita's own docs) - everything else is treated as `pending` unless it
matches one of Remita's documented failure codes.

## Canceling a payment

```typescript
await paykit.payments.cancel(payment.id); // RRR
```

Cancels an **unpaid** RRR via Remita's "Cancel Invoice" endpoint. This
is the only post-creation mutation Remita's Invoice Generation API
supports - there's no way to amend payer details or partially update a
payment reference.

## Webhooks

Configure a "listening URL" in Remita's dashboard (Administration Menu
-> API Keys and Webhooks). Remita POSTs a JSON **array** of
notifications to it - there is no signature or shared secret on this
payload, so `webhookSecret` is unused. Every notification is
re-verified against the status API before a standardized event is
emitted, since the payload itself can't be authenticated:

```typescript
const webhook = paykit.webhooks
  .setup({ webhookSecret: null }) // unused - Remita has no signature
  .on('payment.succeeded', async event => {
    /* re-verified status 00/01 */
  })
  .on('payment.failed', async event => {
    /* re-verified as a documented failure code */
  })
  .on('payment.updated', async event => {
    /* re-verified as still pending */
  });

await webhook.handle({
  body: await request.text(),
  headersAsObject: Object.fromEntries(request.headers),
  fullUrl: request.url,
});
```

### Raw Remita events

```typescript
paykit.webhooks
  .setup({ webhookSecret: null })
  .on('remita.notification', async event => {
    // event.data is the raw Remita notification payload, unverified
  });
```

**Caveat:** Remita's docs ask your endpoint to reply with the literal
text `"Ok"` (or `"Not Ok"`). `webhook.handle()` always sends its own
response, so if strict compliance with that contract matters to you,
send the literal text from your own route handler after calling
`webhook.handle()`.

## Unsupported operations

`createCheckout` / `retrieveCheckout` / `updateCheckout` /
`deleteCheckout`, all customer operations, all subscription
operations, `updatePayment`, `deletePayment`, `capturePayment`, and
`createRefund` throw `ProviderNotSupportedError` - Remita's Invoice
Generation API has no hosted checkout URL, no customer-object API, no
subscription API, no amend/delete endpoint beyond cancellation, no
manual capture step, and no refund endpoint. Use `createPayment` /
`cancelPayment` directly instead.
