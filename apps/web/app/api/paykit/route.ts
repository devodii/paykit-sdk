import { LifetimeAccessEmail } from '@/components/lifetime-access-email-template';
import { paykit } from '@/lib/paykit';
import { resend } from '@/lib/resend';
import { NextRequest, NextResponse } from 'next/server';

export const POST = async (request: NextRequest) => {
  try {
    const webhook = paykit.webhooks
      .setup({ webhookSecret: process.env.POLAR_WEBHOOK_SECRET! })
      .on('customer.created', async customer => {
        console.log({ customer });
      })
      .on('invoice.generated', async invoice => {
        const isPaid = invoice.data.status === 'paid';

        if (!isPaid) return;

        const email = invoice.data.custom_fields?.[
          'account-email'
        ] as string;

        const { error } = await resend.emails.send({
          from: 'PayKit <odii@usepaykit.dev>',
          to: email,
          subject: 'PayKit Lifetime Access',
          react: LifetimeAccessEmail(),
        });

        if (error) throw error;
      });

    const headersAsObject = Object.fromEntries(request.headers.entries());
    const body = await request.text();
    const url = request.url;

    await webhook.handle({ body, headersAsObject, fullUrl: url });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
};
