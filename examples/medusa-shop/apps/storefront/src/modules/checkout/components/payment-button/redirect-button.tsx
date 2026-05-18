import { Button } from "@modules/common/components/ui"
import React, { useState } from "react"
import ErrorMessage from "../error-message"
import { HttpTypes } from "@medusajs/types"

interface RedirectPaymentButtonProps {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}

export const RedirectPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: RedirectPaymentButtonProps) => {
  const [error, setError] = useState<string | null>(null)

  const paymentUrl = cart.payment_collection?.payment_sessions?.[0]?.data
    ?.payment_url as string | null

  const handlePayment = () => {
    if (!paymentUrl) {
      setError("No payment URL available. Please refresh and try again.")
      return
    }
    window.location.href = paymentUrl
  }

  return (
    <>
      <Button
        disabled={notReady || !paymentUrl}
        onClick={handlePayment}
        size="large"
        data-testid={dataTestId}
      >
        Place order
      </Button>
      <ErrorMessage error={error} />
    </>
  )
}
