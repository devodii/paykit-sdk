# Paystack PR Plan — `paystack-tests` branch
> Written: 2026-07-24 | Commit: 93df9d4
> Scope: `packages/paystack` only — do not touch anything else in the monorepo.

---

## Track A Results — What the real Paystack sandbox confirmed

| Call | Status | Notes |
|---|---|---|
| `POST /transaction/initialize` | ✅ Shape correct | `authorization_url`, `access_code`, `reference` snake_case → camelCased by `_toCamel` correctly |
| `GET /transaction/verify/:ref` | ✅ Shape correct | `metadata` can be `""`, `authorization` can be `{}`, `status` can be `"abandoned"` → falls to `'pending'` in mapper |
| `POST /customer` | 🐛 BUG | Returns `createdAt`/`updatedAt` (camelCase) only — no `created_at`/`updated_at` |
| `GET /customer/:id` | ✅ Works | Returns BOTH `createdAt` AND `created_at` — bypasses `_toCamel`, works fine |
| `PUT /customer/:id` | 🐛 BUG | Same as POST — `createdAt`/`updatedAt` only |
| `GET /subscription` list | ✅ Shape confirmed | `subscription_code`, `email_token`, `cron_expression`, `next_payment_date`, no top-level `currency` |
| `GET /subscription/:code` | ⏳ pending | Expected same shape as list |
| `POST /subscription/disable` | ⏳ pending | Expected `{ status: true, message: "Subscription disabled" }` |
| `POST /refund` | ⏳ pending | Need successful transaction refund (use `paykit-sub-test-001`) |

---

## Bugs Found — All confirmed against real API

### Bug 1 — `createRefund` hardcodes `'NGN'` currency
- **File**: `src/paystack-provider.ts:653`
- **Evidence**: `PaystackRefund.currency` field exists. Paystack returns actual currency in refund response.
  Hardcoding `'NGN'` is wrong for GHS, USD, ZAR transactions.
- **Fix**: `Refund$inboundSchema(refund, refund.currency || 'NGN')`
- **Commit**: `fix(paystack): use refund currency from response instead of hardcoded NGN`

---

### Bug 2 — `cancelSubscription` does not guard the `/subscription/disable` response
- **File**: `src/paystack-provider.ts:481–486`
- **Evidence**: If the disable POST fails, `_client.post` returns `{ ok: false }` but the
  code ignores it and returns `{ ...existing, status: 'canceled' }` — silent incorrect return.
- **Fix**: Check the response: `const disableRes = await this._client.post(...); await this.unwrap(disableRes, 'cancelSubscription');`
- **Commit**: `fix(paystack): throw on failed subscription disable instead of silent wrong return`

---

### Bug 3 — Double-fetch in `cancelSubscription` is undocumented
- **File**: `src/paystack-provider.ts:467`
- **Evidence**: Intentional — `retrieveSubscription()` runs data through `Subscription$inboundSchema`
  which drops `email_token`. `POST /subscription/disable` requires both `code` and `token` from
  the raw API. Without a second raw fetch, `email_token` is unavailable.
- **Fix**: Add a comment above the second `_client.get` call explaining why.
- **Commit**: included with Bug 2 fix

---

### Bug 4 — CRITICAL: `_toCamel` + mappers mismatch

**Root cause**: `unwrap()` always applies `_toCamel()` to response data. This converts snake_case
API fields to camelCase. But all provider-specific mappers (`Customer$inboundSchema`,
`Subscription$inboundSchema`, `Refund$inboundSchema`) read snake_case field names.

Every `create*`/`update*` method that calls `unwrap()` then passes data to a mapper is returning
**silently broken data** — wrong `id`, wrong `name`, `Invalid Date` for timestamps.

#### What breaks method by method

**`createCustomer` / `updateCustomer`**:
```
API field         → After _toCamel  → Mapper reads         → Result
customer_code     → customerCode     data.customer_code     undefined → id: undefined ❌
first_name        → firstName        data.first_name        undefined → name falls back to email ❌
last_name         → lastName         data.last_name         undefined ❌
(absent)          → createdAt        data.created_at        undefined → Invalid Date ❌
(absent)          → updatedAt        data.updated_at        undefined → null ❌
```

**`createSubscription`**:
```
API field          → After _toCamel   → Mapper reads            → Result
subscription_code  → subscriptionCode  data.subscription_code    undefined → id: undefined ❌
next_payment_date  → nextPaymentDate   data.next_payment_date    undefined → new Date() wrong ❌
plan.plan_code     → plan.planCode     data.plan?.plan_code      undefined → item_id: '' ❌
```

**`cancelSubscription` second raw fetch**:
```
API field          → After _toCamel   → Code reads              → Result
subscription_code  → subscriptionCode  rawSub.subscription_code  undefined → body.code: undefined ❌
email_token        → emailToken        rawSub.email_token         undefined → body.token: undefined ❌
```
Paystack then rejects the disable call. Combined with Bug 2 (no response check),
the failure is swallowed silently.

**`createRefund`**:
```
API field        → After _toCamel  → Mapper reads         → Result
customer_note    → customerNote     data.customer_note     undefined → reason: null ❌
merchant_note    → merchantNote     data.merchant_note     undefined → reason: null ❌
```

#### Why `retrieve*` methods work

They bypass `unwrap()` and pass `response.value.data` directly to the mapper.
The raw API data has snake_case fields → mapper reads them correctly.

#### Why `initializeTransaction` still needs `_toCamel`

The API returns `authorization_url` (snake_case) but `PaystackInitializeResponse`
is designed to hold `authorizationUrl` (camelCase). `unwrap()` is correct here.

#### The fix — bypass `_toCamel` for mapper-bound responses

Replace `unwrap()` with a direct response check for `createCustomer`, `updateCustomer`,
`createSubscription`, `createRefund`, and the second raw fetch in `cancelSubscription`:

```ts
// BEFORE (broken):
const customer = await this.unwrap(response, 'createCustomer');
return Customer$inboundSchema(customer);

// AFTER (correct):
if (!response.ok || !response.value?.status) {
  throw new OperationFailedError('createCustomer', this.providerName, {
    cause: new Error(response.value?.message ?? JSON.stringify(response.error) ?? 'Unknown error'),
  });
}
return Customer$inboundSchema(response.value.data as PaystackCustomer);
```

- **Commit**: `fix(paystack): bypass _toCamel when feeding API responses into provider mappers`

---

## Missing Tests (18) — `describe('PaystackProvider — missing coverage')`

Follow the exact pattern in the existing test file: `fetchMock.mockResolvedValueOnce(jsonResponse(...))`.
Assert both the outgoing request (URL, body) and the returned value (mapped correctly).

### Checkout
- [ ] `retrieveCheckout maps a verified transaction to a Checkout`
  - Mock: `GET /transaction/verify/:ref` with `status: 'abandoned'`
  - Assert: `result.id === 'paykit-test-ref-001'`, `result.currency === 'NGN'`
- [ ] `retrieveCheckout returns null when API returns no data`
  - Mock: response with `{ ok: false, value: null }`
  - Assert: `result === null`, fetch called once
- [ ] `updateCheckout throws ProviderNotSupportedError and fetch is never called`
- [ ] `deleteCheckout throws ProviderNotSupportedError and fetch is never called`

### Customer
- [ ] `createCustomer sends first/last name split and returns correct id`
  - Mock POST /customer with Step 3 response shape
  - Assert: `body.first_name === 'Ada'`, `body.last_name === 'Lovelace'`
  - Assert: `result.id === 'CUS_pr2g96inu6rt0uv'` (was undefined before Bug 4 fix)
  - Assert: `result.name === 'Ada Lovelace'` (was email-based before Bug 4 fix)
  - Assert: `result.created_at` is a valid `Date` (was Invalid Date before Bug 4 fix)
- [ ] `createCustomer handles single-token name (no space = no last name)`
  - Mock: same response shape, send `name: 'Chizihn'`
  - Assert: `body.first_name === 'Chizihn'`, `body.last_name === undefined`
- [ ] `retrieveCustomer maps a Paystack customer object`
  - Mock GET /customer with Step 4 response shape
  - Assert: `result.id === 'CUS_pr2g96inu6rt0uv'`, `result.name === 'Ada Lovelace'`
  - Assert: `result.created_at` is a valid Date
- [ ] `retrieveCustomer returns null when customer is not found`
  - Mock: `{ ok: false }` or `{ value: { data: null } }`
  - Assert: `result === null`
- [ ] `updateCustomer sends only changed fields (partial update)`
  - Mock PUT /customer with Step 5 response shape
  - Send: `{ phone: '+2348099999999' }` only
  - Assert: body has `phone` but NOT `first_name`/`last_name`/`email`
  - Assert: `result.id === 'CUS_pr2g96inu6rt0uv'` (was undefined before Bug 4 fix)
- [ ] `deleteCustomer throws ProviderNotSupportedError and fetch is never called`

### Subscription
- [ ] `createSubscription sends customer and plan, returns correct id`
  - Mock POST /subscription with real shape from GET /subscription list
  - Assert: `body.customer === 'CUS_...'`, `body.plan === 'PLN_...'`
  - Assert: `result.id === 'SUB_2vjq5801vp9xs5p'` (was undefined before Bug 4 fix)
  - Assert: `result.status === 'active'`, `result.item_id === 'PLN_gi1quck1wlv5zk1'`
  - Assert: `result.billing_interval === 'month'`
- [ ] `retrieveSubscription maps a Paystack subscription correctly`
  - Mock GET /subscription/:code with Step 9 response shape
  - Assert: `result.id === 'SUB_2vjq5801vp9xs5p'`, `result.billing_interval === 'month'`
  - Assert: `result.customer.email === 'test.customer@example.com'`
- [ ] `retrieveSubscription returns null when not found`
- [ ] `cancelSubscription retrieves, re-fetches raw, calls disable, returns canceled`
  - Queue 3 fetchMocks: GET (mapped), GET (raw), POST disable
  - Assert: fetch called 3 times
  - Assert: 3rd call URL is `/subscription/disable`
  - Assert: 3rd call body `{ code: 'SUB_...', token: '...' }`
  - Assert: `result.status === 'canceled'`
- [ ] `cancelSubscription throws ResourceNotFoundError when subscription is not found`
  - Mock: first GET → not found response
  - Assert: throws `ResourceNotFoundError`, fetch called only once
- [ ] `cancelSubscription throws OperationFailedError when disable call fails`
  - Queue 3 mocks: GET, GET, POST disable → `{ status: false, message: 'Invalid token' }`
  - Assert: throws `OperationFailedError`
- [ ] `updateSubscription throws ProviderNotSupportedError and fetch is never called`
- [ ] `deleteSubscription throws ProviderNotSupportedError and fetch is never called`

### Payment
- [ ] `retrievePayment maps a verified transaction to a Payment with status succeeded`
  - Mock GET /transaction/verify with `status: 'success'` response
  - Assert: `result.id === 'ref'`, `result.status === 'succeeded'`, `result.requires_action === false`
- [ ] `retrievePayment returns null when transaction is not found`
- [ ] `updatePayment throws ProviderNotSupportedError`
- [ ] `deletePayment throws ProviderNotSupportedError`
- [ ] `capturePayment throws ProviderNotSupportedError`
- [ ] `cancelPayment throws ProviderNotSupportedError`

### Refund
- [ ] `createRefund sends transaction reference, amount, and merchant_note`
  - Mock: POST /refund → real response shape from Step 11
  - Assert: body `transaction === 'paykit-sub-test-001'`, `amount === 1000`, `merchant_note` present
  - Assert: `result.id === String(refund_id)`, `result.amount === 1000`
- [ ] `createRefund uses currency from refund response, not hardcoded NGN`
  - Mock: POST /refund → response with `currency: 'GHS'`
  - Assert: after Bug 1 fix, `result.currency === 'GHS'`

---

## Track C — Integration Smoke-Test Script

**Purpose**: Run every SDK method against real Paystack sandbox. Proves every method works end-to-end.  
**Not part of CI** — run manually with `PAYSTACK_SECRET_KEY=sk_test_... npx tsx scripts/smoke-test.ts`

File: `packages/paystack/scripts/smoke-test.ts`

```
sequence:
1. createCustomer → capture customerId
2. retrieveCustomer(customerId)
3. updateCustomer(customerId, { phone: '+2348099999999' })
4. createPayment (email customer, returns authorization_url)
5. retrievePayment(paymentId) — will be 'pending' until visited
6. retrieveCheckout(paymentId)
7. retrieveSubscription(existingSubCode = 'SUB_2vjq5801vp9xs5p')
8. createRefund (use paykit-sub-test-001 transaction)
```

Usage note for Emmanuel: uses `workspace:*` as shown in pnpm workspace setup.

---

## OSS Workflow Checklist

- [ ] Bug fixes (one commit per bug):
  - [ ] `fix(paystack): bypass _toCamel when feeding API responses into provider mappers`
  - [ ] `fix(paystack): use refund currency from response instead of hardcoded NGN`
  - [ ] `fix(paystack): throw on failed subscription disable, document intentional double-fetch`
- [ ] Tests:
  - [ ] `test(paystack): add full coverage for checkout, customer, subscription, payment, refund methods`
- [ ] Integration script:
  - [ ] `chore(paystack): add smoke-test script for manual sandbox verification`
- [ ] Changeset: `pnpm changeset` → `@paykit-sdk/paystack` → `patch`
- [ ] Verify: `pnpm test --filter @paykit-sdk/paystack` (0 failures) + `pnpm --filter @paykit-sdk/paystack typecheck` (0 errors)
- [ ] Sync: `git fetch upstream && git rebase upstream/main`
- [ ] PR title: `fix(paystack): correct _toCamel mapper mismatch, refund currency, subscription disable guard + full test coverage`

---

## Definition of Done

- [ ] All 4 bugs fixed
- [ ] All 18+ missing tests passing
- [ ] `pnpm test --filter @paykit-sdk/paystack` → 0 failures (target ~45+ tests, currently 22)
- [ ] `pnpm --filter @paykit-sdk/paystack typecheck` → 0 errors
- [ ] `cancelSubscription` double-fetch has a comment
- [ ] `createRefund` uses `refund.currency || 'NGN'`
- [ ] Smoke-test script runs against sandbox without error
- [ ] Changeset committed
