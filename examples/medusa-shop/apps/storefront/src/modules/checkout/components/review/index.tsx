"use client"

import { Heading, Text, clx } from "@modules/common/components/ui"

import { PaymentButtonRegistry } from "../payment-registry"
import { useSearchParams } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { getProviderConfig } from "@lib/constant"

const Review = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const searchParams = useSearchParams()

  const isOpen = searchParams.get("step") === "review"

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards &&
    ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])
      ?.length > 0 &&
    cart?.total === 0
  )

  const previousStepsCompleted =
    cart.shipping_address &&
    (cart.shipping_methods?.length ?? 0) > 0 &&
    (cart.payment_collection || paidByGiftcard)

  const activeSession = cart.payment_collection?.payment_sessions?.[0]
  const providerUIConfig = getProviderConfig(activeSession?.provider_id)

  const strategy = paidByGiftcard ? "manual" : providerUIConfig.strategy
  const PaymentButtonComponent = PaymentButtonRegistry[strategy]

  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none": !isOpen,
            },
          )}
        >
          Review
        </Heading>
      </div>
      {isOpen && previousStepsCompleted && (
        <>
          <div className="flex items-start gap-x-1 w-full mb-6">
            <div className="w-full">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                By clicking the Place Order button, you confirm that you have
                read, understand and accept our Terms of Use, Terms of Sale and
                Returns Policy and acknowledge that you have read Medusa
                Store&apos;s Privacy Policy.
              </Text>
            </div>
          </div>

          <PaymentButtonComponent
            cart={cart}
            notReady={notReady}
            data-testid="submit-order-button"
          />
        </>
      )}
    </div>
  )
}

export default Review
