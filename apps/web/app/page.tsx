'use client';

import { useState } from 'react';
import { CodeBlock } from '@/components/code-block';
import { Footer, GitHubMark } from '@/components/footer';
import { InstallCommand } from '@/components/install-command';
import { Navbar } from '@/components/navbar';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const PROVIDERS = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Global payment processing',
    pkg: '@paykit-sdk/stripe',
    fn: 'stripe',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'PayPal payments',
    pkg: '@paykit-sdk/paypal',
    fn: 'paypal',
  },
  {
    id: 'polar',
    name: 'Polar',
    description: 'Open source monetization',
    pkg: '@paykit-sdk/polar',
    fn: 'polar',
  },
  {
    id: 'gopay',
    name: 'GoPay',
    description: 'Monetization in Czechia',
    pkg: '@paykit-sdk/gopay',
    fn: 'goPay',
  },
];

function providerCode(p: (typeof PROVIDERS)[0]) {
  return `import { PayKit } from '@paykit-sdk/core';
import { ${p.fn} } from '${p.pkg}';

const provider = ${p.fn}();
const paykit = new PayKit(provider);

const customer = await paykit.customers.create({
  email: 'customer@example.com',
});

const checkout = await paykit.checkouts.create({
  customer_id: customer.id,
  metadata: { order_id: '123' },
  session_type: 'one_time',
  item_id: 'price_123',
});`;
}

export default function Page() {
  const [activeProvider, setActiveProvider] = useState(PROVIDERS[0]);

  return (
    <main className="flex min-h-screen flex-col">
      <Navbar />
      <section className="relative flex flex-col items-center overflow-hidden px-5 pt-40 pb-20 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px] dark:hidden"
          style={{
            background:
              'radial-gradient(ellipse 70% 40% at 50% 0%, oklch(0.92 0 0 / 0.6) 0%, transparent 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-[500px] dark:block"
          style={{
            background:
              'radial-gradient(ellipse 70% 40% at 50% 0%, oklch(0.3 0 0 / 0.4) 0%, transparent 100%)',
          }}
        />

        <p className="text-muted-foreground relative mb-8 text-[11px] font-medium tracking-[0.22em] uppercase">
          A Payroutes Company.
        </p>

        <h1 className="font-heading text-foreground relative max-w-3xl text-[clamp(2.8rem,7vw,5rem)] leading-[1.04] tracking-[-0.02em]">
          Build payments
          <br />
          <span className="text-muted-foreground">
            without vendor lock-in
          </span>
        </h1>

        <p className="text-muted-foreground relative mt-6 max-w-xl text-[15px] leading-relaxed">
          A consistent TypeScript API across Stripe, PayPal, Polar,
          and more. Swap providers with{' '}
          <span className="text-foreground font-medium">
            2 lines of code.
          </span>
        </p>

        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/docs"
            className="bg-foreground text-background inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-medium transition-opacity hover:opacity-85"
          >
            Read Documentation <ArrowRight size={13} />
          </Link>
          <Link
            href="https://github.com/payrouteshq/paykit-sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 inline-flex h-9 items-center gap-1.5 rounded-lg border px-4 text-[13px] transition-colors"
          >
            <GitHubMark /> View on GitHub
          </Link>
        </div>

        <div className="relative mt-6">
          <InstallCommand pkg={activeProvider.pkg} />
        </div>
      </section>

      <section className="flex flex-col items-center gap-16 px-5 pb-24">
        <div className="flex w-full max-w-4xl flex-col items-center">
          <div className="mb-5 flex flex-col items-center gap-1 text-center">
            <p className="text-muted-foreground/60 font-mono text-[11px] tracking-widest uppercase">
              Live demo
            </p>
            <h2 className="font-heading text-foreground text-2xl">
              Switch providers with{' '}
              <span className="text-muted-foreground">
                just 2 lines of code
              </span>
            </h2>
            <p className="text-muted-foreground mt-1 text-[13px]">
              Only the import and initializer change. Everything else
              stays the same.
            </p>
          </div>
          <CodeBlock
            language="typescript"
            key={activeProvider.id}
            className="w-full"
            highlightLines={[2, 4]}
            headerLeft={
              <div className="flex gap-1">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setActiveProvider(p)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      p.id === activeProvider.id
                        ? 'bg-foreground/10 text-foreground'
                        : 'text-muted-foreground hover:text-foreground/70'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            }
          >
            {providerCode(activeProvider)}
          </CodeBlock>
          <p className="text-muted-foreground/60 mt-3 text-center font-mono text-[12px]">
            Lines 2–3 are the only difference across all providers
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
