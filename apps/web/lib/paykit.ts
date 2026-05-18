import { PayKit, createEndpointHandlers } from '@paykit-sdk/core';
import { createStripe } from '@paykit-sdk/stripe';

export const paykit = new PayKit(
  createStripe({ apiKey: process.env.STRIPE_SECRET_KEY! }),
);
export const endpoints = createEndpointHandlers(paykit);
