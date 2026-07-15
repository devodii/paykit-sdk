import { validateRequiredKeys } from '@paykit-sdk/core';
import { BachsOptions, BachsProvider } from './bachs-provider';

export const createBachs = (config: BachsOptions) => {
  return new BachsProvider(config);
};

export const bachs = () => {
  const envVars = validateRequiredKeys(
    ['BACHS_API_KEY', 'BACHS_SANDBOX'],
    process.env as Record<string, string>,
    'Missing required environment variables: {keys}',
  );

  return createBachs({
    apiKey: envVars.BACHS_API_KEY,
    isSandbox: envVars.BACHS_SANDBOX === 'true',
  });
};

export { BachsProvider, type BachsOptions };
