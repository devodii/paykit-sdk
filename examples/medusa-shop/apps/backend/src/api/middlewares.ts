import { defineMiddlewares } from '@medusajs/framework/http';

export default defineMiddlewares({
  routes: [
    {
      // Preserve raw body for HMAC signature verification (Stripe, Paystack, Monnify, etc.)
      // Also allows GET so some providers (e.g. GoPay) webhooks can pass through.
      matcher: '/hooks/payment/*',
      method: ['GET', 'POST'],
      bodyParser: { preserveRawBody: true },
    },
  ],
});
