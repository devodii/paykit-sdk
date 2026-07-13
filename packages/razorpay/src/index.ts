import { validateRequiredKeys } from '@paykit-sdk/core';
import {
  RazorpayProvider,
  RazorpayOptions,
} from './razorpay-provider';

export const createRazorpay = (config: RazorpayOptions) =>
  new RazorpayProvider(config);

export const razorpay = () => {
  const envVars = validateRequiredKeys(
    ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
    (process.env as Record<string, string>) ?? {},
    'Missing required environment variables: {keys}',
  );

  const isSandbox = process.env.NODE_ENV !== 'production';

  return createRazorpay({
    keyId: envVars.RAZORPAY_KEY_ID,
    keySecret: envVars.RAZORPAY_KEY_SECRET,
    isSandbox,
    debug: isSandbox,
  });
};

export { RazorpayProvider, type RazorpayOptions };
