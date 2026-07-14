import { validateRequiredKeys } from '@paykit-sdk/core';
import {
  MoneyGramOptions,
  MoneyGramProvider,
} from './moneygram-provider';

export const createMoneygram = (config: MoneyGramOptions) => {
  return new MoneyGramProvider(config);
};

export const moneygram = () => {
  const envVars = validateRequiredKeys(
    [
      'MONEYGRAM_CLIENT_ID',
      'MONEYGRAM_CLIENT_SECRET',
      'MONEYGRAM_AGENT_PARTNER_ID',
      'MONEYGRAM_OPERATOR_ID',
      'MONEYGRAM_SANDBOX',
    ],
    (process.env as Record<string, string>) ?? {},
    'Missing required environment variables: {keys}',
  );

  return createMoneygram({
    clientId: envVars.MONEYGRAM_CLIENT_ID,
    clientSecret: envVars.MONEYGRAM_CLIENT_SECRET,
    agentPartnerId: envVars.MONEYGRAM_AGENT_PARTNER_ID,
    operatorId: envVars.MONEYGRAM_OPERATOR_ID,
    isSandbox: envVars.MONEYGRAM_SANDBOX === 'true',
    posId: process.env.MONEYGRAM_POS_ID,
    debug: true,
  });
};

export { MoneyGramProvider, type MoneyGramOptions };
