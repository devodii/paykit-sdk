import { retrieveOrderByCartId } from "@lib/data/orders"
import { placeOrder } from "@lib/data/cart"
import { redirect, notFound } from "next/navigation"

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ cart_id?: string }>
}

export default async function PaymentReturnPage(props: Props) {
  const { countryCode } = await props.params
  const { cart_id } = await props.searchParams

  if (!cart_id) return notFound()

  // Order may already exist if a webhook processed the payment
  const existingOrder = await retrieveOrderByCartId(cart_id)

  if (existingOrder) {
    redirect(`/${countryCode}/order/${existingOrder.id}/confirmed`)
  }

  // Complete the cart now that the user has returned from the payment provider
  try {
    await placeOrder(cart_id)
  } catch (e: any) {
    // Re-throw Next.js redirect/not-found errors so they propagate correctly
    if (
      e?.digest?.startsWith("NEXT_REDIRECT") ||
      e?.digest?.startsWith("NEXT_NOT_FOUND")
    ) {
      throw e
    }

    redirect(`/${countryCode}/checkout`)
  }

  redirect(`/${countryCode}/checkout`)
}
