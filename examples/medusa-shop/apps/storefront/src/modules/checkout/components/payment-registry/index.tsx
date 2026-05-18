import { StripePaymentButton } from "@modules/checkout/components/payment-button/stripe-button"
import { RedirectPaymentButton } from "@modules/checkout/components/payment-button/redirect-button"
import { ManualPaymentButton } from "@modules/checkout/components/payment-button/manual-button"
import { PaymentUIStrategy } from "@lib/constant"
import React from "react"

export const PaymentButtonRegistry: Record<PaymentUIStrategy, React.FC<any>> = {
  "integrated-stripe": StripePaymentButton,
  redirect: RedirectPaymentButton,
  manual: ManualPaymentButton,
}
