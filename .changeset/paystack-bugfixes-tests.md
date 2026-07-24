---
"@paykit-sdk/paystack": patch
---

fix(paystack): bypass _toCamel when feeding API responses into provider mappers to fix undefined ids and timestamps
fix(paystack): use refund currency from response instead of hardcoded NGN
fix(paystack): throw on failed subscription disable
