import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { PostHog } from 'posthog-node';
import { z } from 'zod';

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const PORT = Number(process.env.PORT ?? 3001);

if (!POSTHOG_API_KEY) {
  console.error('POSTHOG_API_KEY env var is required');
  process.exit(1);
}

const posthog = new PostHog(POSTHOG_API_KEY, {
  host: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
  flushAt: 1,
  flushInterval: 0,
});

const telemetryEventSchema = z.object({
  provider: z.string().min(1),
  action: z.string().min(1),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
  sdk_version: z.string().optional(),
  is_live_mode: z.boolean().optional(),
  provider_version: z.string().optional(),
  adapter: z.string().optional(),
  adapter_version: z.string().optional(),
});

const app = new Hono();

app.post('/v1/track', async c => {
  let raw: unknown;

  try {
    raw = await c.req.json();
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const result = telemetryEventSchema.safeParse(raw);

  if (!result.success) {
    return c.json(
      { ok: false, error: result.error.flatten().fieldErrors },
      400,
    );
  }

  const body = result.data;

  posthog.capture({
    distinctId: body.provider,
    event: body.action,
    properties: {
      amount: body.amount,
      currency: body.currency,
      status: body.status,
      metadata: body.metadata,
      timestamp: body.timestamp,
      sdk_version: body.sdk_version,
      is_live_mode: body.is_live_mode,
      provider_version: body.provider_version,
      adapter: body.adapter,
      adapter_version: body.adapter_version,
    },
  });

  return c.json({ ok: true }, 200);
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Telemetry service listening on :${PORT}`);
});
