import { PayKit, createEndpointHandlers } from '@paykit-sdk/core';
import { stripe } from '@paykit-sdk/stripe';

export const paykit = new PayKit(stripe());
export const endpoints = createEndpointHandlers(paykit);
