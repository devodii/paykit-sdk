import { CreditCard } from "@medusajs/icons"
import Bancontact from "@modules/common/icons/bancontact"
import Ideal from "@modules/common/icons/ideal"
import PayPal from "@modules/common/icons/paypal"
import React from "react"

export type PaymentUIStrategy = "integrated-stripe" | "redirect" | "manual"

export interface ProviderUIConfig {
  title: string
  icon: React.JSX.Element
  strategy: PaymentUIStrategy
}

export const getProviderConfig = (providerId?: string): ProviderUIConfig => {
  if (!providerId)
    return { title: "Unknown", icon: <CreditCard />, strategy: "manual" }

  if (providerId.startsWith("pp_paykit_")) {
    const subProvider = providerId.replace("pp_paykit_", "")
    const paykitStrategies: Record<string, PaymentUIStrategy> = {
      stripe: "integrated-stripe",
      gopay: "redirect",
      comgate: "redirect",
      paystack: "redirect",
      paypal: "redirect",
    }
    return {
      title: subProvider.charAt(0).toUpperCase() + subProvider.slice(1),
      icon: <CreditCard />,
      strategy: paykitStrategies[subProvider] || "redirect",
    }
  }

  const medusaRegistry: Record<string, ProviderUIConfig> = {
    pp_stripe_stripe: {
      title: "Credit card",
      icon: <CreditCard />,
      strategy: "integrated-stripe",
    },
    "pp_medusa-payments_default": {
      title: "Credit card",
      icon: <CreditCard />,
      strategy: "integrated-stripe",
    },
    "pp_stripe-ideal_stripe": {
      title: "iDeal",
      icon: <Ideal />,
      strategy: "integrated-stripe",
    },
    "pp_stripe-bancontact_stripe": {
      title: "Bancontact",
      icon: <Bancontact />,
      strategy: "integrated-stripe",
    },
    pp_paypal_paypal: {
      title: "PayPal",
      icon: <PayPal />,
      strategy: "redirect",
    },
    pp_system_default: {
      title: "Manual Payment",
      icon: <CreditCard />,
      strategy: "manual",
    },
  }

  return (
    medusaRegistry[providerId] || {
      title: providerId,
      icon: <CreditCard />,
      strategy: "manual",
    }
  )
}

export const paymentInfoMap = new Proxy(
  {},
  {
    get: (_, id: string) => getProviderConfig(id),
  },
) as any
