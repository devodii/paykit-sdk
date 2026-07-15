# @paykit-sdk/bachs

Bachs provider for PayKit.

Bachs is a hosted-checkout-first payments and billing platform for
African internet businesses selling globally
([docs.bachs.io](https://docs.bachs.io)). There is no direct "create
payment" endpoint - every payment originates from a checkout session,
so `createPayment` reuses the same flow as `createCheckout`, just
returning a `Payment` instead of a `Checkout`. Subscriptions work the
same way: there's no "create subscription" call either - a
subscription is created automatically once a checkout for a
recurring-configured product completes.

## Quick Start

```typescript
import { createEndpointHandlers, PayKit } from '@paykit-sdk/core';
import { bachs, createBachs } from '@paykit-sdk/bachs';

// Method 1: Using environment variables
const provider = bachs(); // Ensure required environment variables are set

// Method 2: Direct configuration
const provider = createBachs({
  apiKey: process.env.BACHS_API_KEY, // sk_sandbox_... or sk_live_...
  isSandbox: true,
  debug: true,
});

export const paykit = new PayKit(provider);
export const endpoints = createEndpointHandlers(paykit);
```

Required env vars for `bachs()`:

```bash
BACHS_API_KEY=sk_sandbox_...
BACHS_SANDBOX=true
```

## Creating a checkout

Products (and their prices) live jin your Bachs product catalog -
`item_id` is a Bachs `product_id`. Bachs resolves the amount/currency
from the product itself, so you don't pass either:

```typescript
const checkout = await paykit.checkouts.create({
  customer: { email: 'jane@example.com' }, // or { id: 'cust_...' } for an existing customer
  item_id: 'prod_abc123',
  quantity: 1,
  session_type: 'one_time',
  success_url: 'https://shop.example.com/thanks',
  cancel_url: 'https://shop.example.com/cart',
  metadata: { order_id: 'ORD-9876' },
});

// Redirect the customer to checkout.payment_url
```

Recurring products work identically - if `prod_abc123` has a
`billing_cycle` configured on Bachs, completing this same checkout
creates a subscription automatically; you'll get both a
`payment.succeeded` and a `subscription.created` webhook.

### Safe retries

`createCheckout`/`createPayment` each make two calls under the hood
(create the session, then fetch it back to resolve pricing). If your
own code might retry the whole call - e.g. after a timeout where you
can't tell if it succeeded - pass a stable `idempotencyKey` (your own
order ID works well) so a retry returns the original session instead
of creating a duplicate:

```typescript
await paykit.checkouts.create({
  // ...
  provider_metadata: { idempotencyKey: `order-${order.id}` },
});
```

Without one, each call gets a fresh random key, which only protects
against retries Bachs' own HTTP client performs internally - not
retries you trigger yourself. `createRefund` has the same option, and
reuses it for both Bachs' `Idempotency-Key` header and its
refund-specific `reference`/`idempotency_key` fields.

## Creating a payment directly

Same underlying flow, mapped onto `Payment`. Needs `success_url` in
`provider_metadata` since Bachs still redirects the customer even for
a "direct" payment:

```typescript
const payment = await paykit.payments.create({
  customer: { email: 'jane@example.com' },
  amount: 50, // informational only - Bachs resolves the real amount from the product
  currency: 'USD',
  item_id: 'prod_abc123',
  capture_method: 'automatic', // Bachs captures automatically - no manual step
  provider_metadata: {
    success_url: 'https://shop.example.com/thanks',
    cancel_url: 'https://shop.example.com/cart', // optional
  },
});

// payment.id is the checkout_id - use it for retrievePayment/createRefund
// payment.payment_url is the hosted checkout URL
```

`payment.id` (and `checkout.id`) is Bachs' `checkout_id` for the
lifetime of the payment - a real `charge_id`/`payment_id` only exists
once the customer completes payment, nested under the checkout session
as `.charge`. `retrievePayment`/`retrieveCheckout` handle that
automatically; `createRefund` resolves the real charge_id internally.

## Retrieving a payment or checkout

```typescript
const payment = await paykit.payments.retrieve(payment.id);
```

Before the customer pays, this reflects the checkout's own status
(`pending`, `requires_action: true`). Once they pay, it reflects the
nested charge (`succeeded`, `failed`, etc). `retrieveCheckout`/
`retrievePayment` never see the checkout URL again after creation -
Bachs only returns it once - so `checkout.payment_url` is `''` and
`payment.payment_url` is `null` on retrieval.

## Customers

Full support except delete (no endpoint exists):

```typescript
const customer = await paykit.customers.create({
  email: 'jane@example.com',
  name: 'Jane Doe',
  billing: null,
});

await paykit.customers.update(customer.id, { name: 'Jane D.' });
await paykit.customers.retrieve(customer.id);
```

## Subscriptions

No `createSubscription` - create one via `createCheckout` with a
recurring-configured product instead (see above). Retrieve, update,
and cancel work directly:

```typescript
const subscription =
  await paykit.subscriptions.retrieve('sub_1a2b3c4d5e');

await paykit.subscriptions.update('sub_1a2b3c4d5e', {
  metadata: {},
  provider_metadata: { product_id: 'prod_xyz456' }, // move to a different plan
});

await paykit.subscriptions.cancel('sub_1a2b3c4d5e'); // cancels immediately
```

`cancelSubscription` always cancels immediately
(`cancel_at_period_end: false`) since PayKit's interface doesn't pass
params through to it - use `updateSubscription`'s `provider_metadata`
first if you need different behavior.

## Refunds

```typescript
await paykit.refunds.create({
  payment_id: 'chk_1a2b3c4d5e', // the checkout_id
  amount: 29,
  reason: 'Customer request',
  metadata: null,
});
```

Requires the payment to have actually succeeded (a `charge` must exist
under the checkout session) - throws `ResourceNotFoundError` otherwise.

## Webhooks

Configure an endpoint from your Bachs Developer Portal or via the
Webhook Endpoint API - either way you get an `X-Bachs-Signature`
header (HMAC-SHA256 of `"{timestamp}.{raw_body}"`) plus
`X-Bachs-Timestamp`, verified against your endpoint's signing secret.
Deliveries older than 5 minutes are rejected:

```typescript
const webhook = paykit.webhooks
  .setup({ webhookSecret: process.env.BACHS_WEBHOOK_SECRET! }) // whsec_...
  .on('payment.succeeded', async event => {
    /* collection.succeeded, re-fetched */
  })
  .on('payment.failed', async event => {
    /* collection.failed / collection.abandoned */
  })
  .on('payment.updated', async event => {
    /* collection.underpaid */
  })
  .on('subscription.created', async event => {})
  .on('subscription.updated', async event => {})
  .on('subscription.canceled', async event => {})
  .on('refund.created', async event => {
    /* refund.created / refund.paid / refund.failed */
  })
  .on('customer.created', async event => {})
  .on('customer.updated', async event => {});

await webhook.handle({
  body: await request.text(),
  headersAsObject: Object.fromEntries(request.headers),
  fullUrl: request.url,
});
```

`payout.*`, `invoice.*`, `dispute.*`, and `conversion.*` events aren't
mapped to a standard PayKit event - they're outside PayKit's current
interface. Opt into them as raw events:

```typescript
paykit.webhooks
  .setup({ webhookSecret: process.env.BACHS_WEBHOOK_SECRET! })
  .on('bachs.payout.paid', async event => {
    // event.data is the raw Bachs payload
  });
```

## Unsupported operations

`updateCheckout`, `deleteCheckout`, `deleteCustomer`,
`createSubscription`, `deleteSubscription`, `updatePayment`,
`deletePayment`, `capturePayment`, and `cancelPayment` throw
`ProviderNotSupportedError` - Bachs has no endpoints for amending or
deleting a checkout session, deleting a customer, creating a
subscription directly, or manually capturing/canceling a payment.
