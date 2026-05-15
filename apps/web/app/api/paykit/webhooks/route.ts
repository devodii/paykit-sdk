import { paykit } from '@/lib/paykit';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 },
    );
  }

  const webhook = paykit.webhooks
    .setup({ webhookSecret })
    .on('customer.created', async event => {
      console.log('Customer created:', event.data);
    })
    .on('subscription.created', async event => {
      console.log('Subscription created:', event.data);
    })
    .on('payment.created', async event => {
      console.log('Payment created:', event.data);
    })
    .on('refund.created', async event => {
      console.log('Refund created:', event.data);
    })
    .on('invoice.generated', async event => {
      console.log('Invoice generated:', event.data);
    });

  const body = await request.text();
  const headers = request.headers;
  const url = request.url;

  try {
    await webhook.handle({ body, headers, fullUrl: url });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.log('Webhook Error', error);
    return NextResponse.json({ success: false });
  }
}
