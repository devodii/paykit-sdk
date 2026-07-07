import { validateRequiredKeys } from '@paykit-sdk/core';
import { StripeProvider, StripeOptions } from './stripe-provider';

export const createStripe = (config: StripeOptions) => {
  return new StripeProvider(config);
};

export const stripe = () => {
  const envVars = validateRequiredKeys(
    ['STRIPE_API_KEY'],
    (process.env as Record<string, string>) ?? {},
    'Missing required environment variables: {keys}',
  );

  return createStripe({
    apiKey: envVars.STRIPE_API_KEY,
    apiVersion: '2025-08-27.basil',
    isSandbox:
      envVars.STRIPE_API_KEY.includes('_test_') ||
      process.env.NODE_ENV !== 'production',
  });
};
