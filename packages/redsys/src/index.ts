import { validateRequiredKeys } from '@paykit-sdk/core';
import { RedsysProvider, RedsysOptions } from './redsys-provider';

export const createRedsys = (config: RedsysOptions) =>
  new RedsysProvider(config);

export const redsys = () => {
  const envVars = validateRequiredKeys(
    ['REDSYS_MERCHANT_CODE', 'REDSYS_TERMINAL', 'REDSYS_SECRET_KEY'],
    (process.env as Record<string, string>) ?? {},
    'Missing required environment variables: {keys}',
  );

  const isSandbox = process.env.NODE_ENV !== 'production';

  return createRedsys({
    merchantCode: envVars.REDSYS_MERCHANT_CODE,
    terminal: envVars.REDSYS_TERMINAL,
    secretKey: envVars.REDSYS_SECRET_KEY,
    isSandbox,
    debug: isSandbox,
    transactionType:
      (process.env.REDSYS_TRANSACTION_TYPE as '0' | '1') ?? '0',
  });
};

export { RedsysProvider, type RedsysOptions };
