import { validateRequiredKeys } from '@paykit-sdk/core';
import { RemitaOptions, RemitaProvider } from './remita-provider';

export const createRemita = (config: RemitaOptions) => {
  return new RemitaProvider(config);
};

export const remita = () => {
  const envVars = validateRequiredKeys(
    [
      'REMITA_MERCHANT_ID',
      'REMITA_API_KEY',
      'REMITA_SERVICE_TYPE_ID',
      'REMITA_SANDBOX',
    ],
    process.env as Record<string, string>,
    'Missing required environment variables: {keys}',
  );

  return createRemita({
    merchantId: envVars.REMITA_MERCHANT_ID,
    apiKey: envVars.REMITA_API_KEY,
    serviceTypeId: envVars.REMITA_SERVICE_TYPE_ID,
    isSandbox: envVars.REMITA_SANDBOX === 'true',
    baseUrl: process.env.REMITA_BASE_URL,
  });
};

export { RemitaProvider, type RemitaOptions };
