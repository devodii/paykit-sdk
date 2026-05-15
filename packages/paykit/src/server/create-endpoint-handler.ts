import { PayKit } from '../index';
import type { EndpointHandler, EndpointPath } from './endpoints';

/**
 * Creates type-safe endpoint handlers for any PayKit instance
 * Usage in your API route:
 *
 * ```ts
 * import { paykit } from '@/lib/paykit';
 * import { createEndpointHandlers } from '@paykit-sdk/core';
 *
 * const endpoints = createEndpointHandlers(paykit);
 * ```
 */
export function createEndpointHandlers(paykit: PayKit<any>): {
  [K in EndpointPath]: EndpointHandler<K>;
} {
  return {
    '/customer/create': params => paykit.customers.create(params),
    '/customer/retrieve': id => paykit.customers.retrieve(id),
    '/customer/update': (id, params) => paykit.customers.update(id, params),
    '/customer/delete': id => paykit.customers.delete(id),

    '/checkout/create': params => paykit.checkouts.create(params),
    '/checkout/retrieve': id => paykit.checkouts.retrieve(id),
    '/checkout/update': (id, params) => paykit.checkouts.update(id, params),
    '/checkout/delete': id => paykit.checkouts.delete(id),

    '/subscription/create': params => paykit.subscriptions.create(params),
    '/subscription/retrieve': id => paykit.subscriptions.retrieve(id),
    '/subscription/update': (id, params) =>
      paykit.subscriptions.update(id, params),
    '/subscription/cancel': id => paykit.subscriptions.cancel(id),
    '/subscription/delete': id => paykit.subscriptions.delete(id),

    '/payment/create': params => paykit.payments.create(params),
    '/payment/retrieve': id => paykit.payments.retrieve(id),
    '/payment/update': (id, params) => paykit.payments.update(id, params),
    '/payment/capture': (id, params) => paykit.payments.capture(id, params),
    '/payment/cancel': id => paykit.payments.cancel(id),
    '/payment/delete': id => paykit.payments.delete(id),

    '/refund/create': params => paykit.refunds.create(params),
  };
}
