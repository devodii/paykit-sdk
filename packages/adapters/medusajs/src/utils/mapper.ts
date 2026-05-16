import { PaymentSessionStatus } from '@medusajs/framework/utils';
import { PaymentStatus } from '@paykit-sdk/core';

/**
 * @internal
 */
export const PaymentStatus$inboundSchema = (status: PaymentStatus) => {
  switch (status) {
    case 'pending':
    case 'processing':
      return PaymentSessionStatus.PENDING;
    case 'requires_action':
      return PaymentSessionStatus.REQUIRES_MORE;
    case 'requires_capture':
      return PaymentSessionStatus.AUTHORIZED;
    case 'succeeded':
      return PaymentSessionStatus.CAPTURED;
    case 'canceled':
      return PaymentSessionStatus.CANCELED;
    case 'failed':
      return PaymentSessionStatus.ERROR;
    default:
      return PaymentSessionStatus.PENDING;
  }
};
