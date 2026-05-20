import React from 'react';
import {
  Paykit as PaykitIcon,
  StellarTools as StellarToolsIcon,
} from '@/components/icons';
import { SiteHeader } from '@/components/site-header';
import { Separator, Button, Badge, Card } from '@paykit-sdk/ui';
import {
  Linkedin,
  Zap,
  Github,
  ArrowRight,
  Package,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
    <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
  </svg>
);

export const dynamic = 'force-dynamic';

const Index = () => {
  return (
    <div className="font-inter bg-background font-pt-sans min-h-screen">
      <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center space-x-3">
            <PaykitIcon className="text-foreground size-4" />
            <span className="text-xl font-bold tracking-tight">
              PayKit
            </span>
          </Link>

          <SiteHeader />
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-12 pb-24">
        {/* Hero Section */}
        <div className="mb-20 space-y-6 text-center">
          <div className="bg-muted/50 inline-flex items-center space-x-2 rounded-full border px-4 py-2 text-sm">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="text-muted-foreground">
              Payment Infrastructure
            </span>
            <Badge variant="secondary" className="ml-2">
              TypeScript
            </Badge>
          </div>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            The missing infrastructure
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              between payment providers and developers
            </span>
          </h1>

          <p className="text-muted-foreground mx-auto max-w-3xl text-xl leading-relaxed md:text-2xl">
            We build tools that make payments simpler, more portable,
            and more accessible for developers everywhere.
          </p>
        </div>

        <section id="products" className="scroll-mt-20">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Our products
            </h2>
            <p className="text-muted-foreground mt-3 text-lg">
              A focused lab for portable payment tools.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card.Root className="border-2 transition-colors hover:border-blue-500/50">
              <Card.Header>
                <div className="mb-2 flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-500" />
                  <Card.Title className="text-xl">
                    PayKit SDK
                  </Card.Title>
                </div>
                <Card.Description className="text-base leading-relaxed">
                  Swap payment providers with 2 lines of code. A
                  consistent TypeScript API across Stripe, PayPal,
                  Polar, and more.
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <Button asChild variant="outline" size="sm">
                  <Link href="/sdk">
                    View SDK
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </Card.Content>
            </Card.Root>

            <Card.Root className="border-2 transition-colors hover:border-purple-500/50">
              <Card.Header>
                <div className="mb-2 flex items-center gap-2">
                  <StellarToolsIcon className="h-5 w-5 text-purple-500" />
                  <Card.Title className="text-xl">
                    StellarTools
                  </Card.Title>
                </div>
                <Card.Description className="text-base leading-relaxed">
                  Accept Stellar payments at checkout. Built for
                  merchants who want crypto-native, wallet-connect
                  powered payment flows.
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href="https://stellartools.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit StellarTools
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </Card.Content>
            </Card.Root>
          </div>
        </section>
      </main>

      <footer className="bg-muted/30 border-t">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <PaykitIcon className="size-5 text-blue-500" />
                <span className="text-lg font-bold">PayKit</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Payment infrastructure for developers.
              </p>
              <div className="flex items-center space-x-1">
                <Button asChild variant="ghost" size="sm">
                  <Link
                    target="_blank"
                    rel="noopener noreferrer"
                    href="https://www.linkedin.com/company/usepaykit"
                  >
                    <Linkedin className="size-4" />
                  </Link>
                </Button>

                <Button asChild variant="ghost" size="sm">
                  <Link
                    href="https://github.com/usepaykit"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="size-4" />
                  </Link>
                </Button>

                <Button asChild variant="ghost" size="sm">
                  <Link
                    href="https://x.com/usepaykit"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TwitterIcon className="size-4" />
                  </Link>
                </Button>

                <Button asChild variant="ghost" size="sm">
                  <Link
                    href="https://discord.gg/SXKv64tq9W"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Discord"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="currentColor"
                      className="size-4"
                      viewBox="0 0 16 16"
                    >
                      <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
                    </svg>
                  </Link>
                </Button>
              </div>
            </div>

            <div />

            <div className="space-y-4">
              <h3 className="font-semibold">Product</h3>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li>
                  <Link
                    href="/sdk"
                    className="hover:text-foreground transition-colors"
                  >
                    PayKit SDK
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://stellartools.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    StellarTools
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <Separator className="my-8" />

          <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="relative h-8 w-8 overflow-hidden rounded-full">
                <Image
                  src="/odii.png"
                  alt="Emmanuel Odii"
                  className="h-full w-full object-cover"
                  width={32}
                  height={32}
                />
              </div>
              <p className="text-muted-foreground text-sm">
                Hey Curious 👋 I’m
                <Link
                  href="https://odii.vercel.app"
                  target="_blank"
                  className="text-foreground ml-1 font-medium hover:underline"
                >
                  Emmanuel
                </Link>
                , the creator of PayKit. You can follow my work on
                <Link
                  href="https://x.com/devodii_"
                  target="_blank"
                  className="text-foreground ml-1 font-medium underline hover:underline"
                >
                  Twitter
                </Link>{' '}
                or
                <Link
                  href="https://www.linkedin.com/in/emmanuelodii/"
                  target="_blank"
                  className="text-foreground ml-1 font-medium underline hover:underline"
                >
                  LinkedIn
                </Link>
              </p>
            </div>

            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} PayKit. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
