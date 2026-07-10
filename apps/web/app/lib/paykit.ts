import { PayKit, createEndpointHandlers } from '@paykit-sdk/core';
import { createStripe } from '@paykit-sdk/stripe';

export const paykit = new PayKit(createStripe({ apiKey: 'sk_test' }));
export const endpoints = createEndpointHandlers(paykit);