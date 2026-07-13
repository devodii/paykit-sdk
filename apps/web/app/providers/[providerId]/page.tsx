import {
  getProvider,
  PROVIDERS,
  type Provider,
} from '@/app/lib/providers';
import { CodeBlock } from '@/components/code-block';
import { Footer, SdkLogo } from '@/components/footer';
import { InstallCommand } from '@/components/install-command';
import { Navbar } from '@/components/navbar';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Plus,
} from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ providerId: string }>;
}

export function generateStaticParams() {
  return PROVIDERS.map(p => ({ providerId: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { providerId } = await params;
  const provider = getProvider(providerId);

  if (!provider) return { title: 'Provider not found' };

  const title = `${provider.name} + PayKit`;
  const description = `${provider.tagline}. Add ${provider.name} to your app with the same PayKit API you'd use for any other payment provider.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function providerCode(provider: Provider) {
  return `import { PayKit } from '@paykit-sdk/core';
import { ${provider.initFn} } from '${provider.packageName}';

const paykit = new PayKit(${provider.initFn}());

const checkout = await paykit.checkouts.create({
  customer_id: 'cus_123',
  metadata: { order_id: '123' },
  session_type: 'one_time',
  item_id: 'price_123',
});`;
}

function LogoTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border bg-muted/30 relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border">
      {children}
    </span>
  );
}

function ProviderLogo({ provider }: { provider: Provider }) {
  if (provider.logo) {
    return (
      <LogoTile>
        <Image
          src={provider.logo}
          alt={`${provider.name} logo`}
          fill
          className="object-cover"
          priority
        />
      </LogoTile>
    );
  }

  return (
    <LogoTile>
      <span className="text-foreground font-heading text-2xl">
        {provider.name.charAt(0)}
      </span>
    </LogoTile>
  );
}

function IntegrationLockup({ provider }: { provider: Provider }) {
  return (
    <div className="flex items-center gap-3">
      <ProviderLogo provider={provider} />
      <span className="border-border bg-background text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border">
        <Plus size={12} />
      </span>
      <LogoTile>
        <SdkLogo size={36} priority />
      </LogoTile>
    </div>
  );
}

export default async function ProviderPage({ params }: PageProps) {
  const { providerId } = await params;
  const provider = getProvider(providerId);

  if (!provider) notFound();

  return (
    <main className="flex min-h-screen flex-col">
      <Navbar />

      <section className="relative flex flex-col items-center overflow-hidden px-5 pt-36 pb-20 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[400px] dark:hidden"
          style={{
            background:
              'radial-gradient(ellipse 70% 40% at 50% 0%, oklch(0.92 0 0 / 0.6) 0%, transparent 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-[400px] dark:block"
          style={{
            background:
              'radial-gradient(ellipse 70% 40% at 50% 0%, oklch(0.3 0 0 / 0.4) 0%, transparent 100%)',
          }}
        />

        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground relative mb-8 inline-flex items-center gap-1.5 text-[13px] transition-colors"
        >
          <ArrowLeft size={13} /> PayKit
        </Link>

        <div className="relative flex flex-col items-center gap-5">
          <IntegrationLockup provider={provider} />

          <div className="flex flex-col items-center gap-2">
            <h1 className="font-heading text-foreground text-4xl tracking-[-0.02em]">
              {provider.name}
            </h1>
            <p className="text-muted-foreground max-w-md text-[15px] leading-relaxed">
              {provider.tagline}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 text-xs font-medium">
              {provider.region}
            </span>
            <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 font-mono text-xs font-medium">
              {provider.packageName}
            </span>
          </div>
        </div>

        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-foreground text-background inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-medium transition-opacity hover:opacity-85"
          >
            <BookOpen size={13} /> View PayKit docs
          </Link>
          <Link
            href={provider.website}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 inline-flex h-9 items-center gap-1.5 rounded-lg border px-4 text-[13px] transition-colors"
          >
            Visit {provider.name} <ArrowUpRight size={13} />
          </Link>
        </div>

        <div className="relative mt-6">
          <InstallCommand pkg={provider.packageName} />
        </div>
      </section>

      <section className="flex flex-col items-center gap-16 px-5 pb-24">
        <div className="flex w-full max-w-2xl flex-col items-center">
          <div className="mb-5 flex flex-col items-center gap-1 text-center">
            <p className="text-muted-foreground/60 font-mono text-[11px] tracking-widest uppercase">
              Usage
            </p>
            <h2 className="font-heading text-foreground text-2xl">
              {provider.name} through a{' '}
              <span className="text-muted-foreground">
                single PayKit API
              </span>
            </h2>
            <p className="text-muted-foreground mt-1 text-[13px]">
              Same shape as every other provider. Swap {provider.name}{' '}
              for anything else with two lines of code.
            </p>
          </div>
          <CodeBlock language="typescript" className="w-full">
            {providerCode(provider)}
          </CodeBlock>
        </div>
      </section>

      <Footer />
    </main>
  );
}
