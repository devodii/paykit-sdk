import { validateRequiredKeys } from '@paykit-sdk/core';
import {
  MercadoPagoProvider,
  MercadoPagoOptions,
} from './mercadopago-provider';

export const createMercadoPago = (config: MercadoPagoOptions) =>
  new MercadoPagoProvider(config);

export const mercadoPago = () => {
  const envVars = validateRequiredKeys(
    ['MERCADOPAGO_ACCESS_TOKEN'],
    (process.env as Record<string, string>) ?? {},
    'Missing required environment variables: {keys}',
  );

  const isSandbox = process.env.NODE_ENV !== 'production';

  return createMercadoPago({
    accessToken: envVars.MERCADOPAGO_ACCESS_TOKEN,
    isSandbox,
    debug: isSandbox,
  });
};

export { MercadoPagoProvider, type MercadoPagoOptions };
