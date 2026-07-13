import { validateRequiredKeys } from '@paykit-sdk/core';
import { XenditProvider, XenditOptions } from './xendit-provider';

export const createXendit = (config: XenditOptions) =>
  new XenditProvider(config);

export const xendit = () => {
  const envVars = validateRequiredKeys(
    ['XENDIT_SECRET_KEY'],
    (process.env as Record<string, string>) ?? {},
    'Missing required environment variables: {keys}',
  );

  const isSandbox = process.env.NODE_ENV !== 'production';

  return createXendit({
    secretKey: envVars.XENDIT_SECRET_KEY,
    isSandbox,
    debug: isSandbox,
  });
};

export { XenditProvider, type XenditOptions };
