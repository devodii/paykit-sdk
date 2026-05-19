import { z } from 'zod';
import { PayKitProvider } from './paykit-provider';

type MethodNames = {
  [K in keyof PayKitProvider]: PayKitProvider[K] extends (
    ...args: any[]
  ) => any
    ? K
    : never;
}[keyof PayKitProvider<any, any, any> & string];

export const PAYKIT_PROVIDER_METHODS: Array<MethodNames> = [
  'createCheckout',
  'retrieveCheckout',
  'updateCheckout',
  'deleteCheckout',
  'createCustomer',
  'updateCustomer',
  'retrieveCustomer',
  'deleteCustomer',
  'createSubscription',
  'updateSubscription',
  'cancelSubscription',
  'deleteSubscription',
  'retrieveSubscription',
  'createPayment',
  'updatePayment',
  'retrievePayment',
  'deletePayment',
  'capturePayment',
  'cancelPayment',
  'createRefund',
  'handleWebhook',
];

export const providerSchema = z.custom<PayKitProvider>(
  (val: unknown) => {
    if (!val || typeof val !== 'object') return false;

    const provider = val as any;

    if (typeof provider.providerName !== 'string') return false;

    return PAYKIT_PROVIDER_METHODS.every(
      method => typeof provider[method] === 'function',
    );
  },
  {
    message:
      'Invalid PayKit provider: Missing implementation for required methods.',
  },
);

export const payKitAdapterMetadataSchema = z.object({
  /**
   * The name of the adapter
   */
  name: z.string(),
  /**
   * The version of the adapter
   */
  version: z.string(),
});

export type PayKitAdapterMetadata = z.infer<
  typeof payKitAdapterMetadataSchema
>;
