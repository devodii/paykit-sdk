import { validateRequiredKeys } from '@paykit-sdk/core';
import { ChapaProvider, ChapaOptions } from './chapa-provider';

export const createChapa = (config: ChapaOptions) =>
  new ChapaProvider(config);

export const chapa = () => {
  const envVars = validateRequiredKeys(
    ['CHAPA_SECRET_KEY'],
    (process.env as Record<string, string>) ?? {},
    'Missing required environment variables: {keys}',
  );

  const isSandbox = process.env.NODE_ENV !== 'production';

  return createChapa({
    secretKey: envVars.CHAPA_SECRET_KEY,
    isSandbox,
    debug: isSandbox,
  });
};

export { ChapaProvider, type ChapaOptions };
