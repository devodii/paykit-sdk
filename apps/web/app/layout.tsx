import '@/app/globals.css';
import { AppProviders } from '@/providers';
import { cn } from '@paykit-sdk/ui';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import {
  DM_Sans,
  Instrument_Serif,
  JetBrains_Mono,
} from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
});

const instrumentSerif = Instrument_Serif({
  weight: '400',
  variable: '--font-instrument-serif',
  subsets: ['latin'],
});

const jetBrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});
export const metadata: Metadata = {
  title: {
    default: 'PayKit - Build payments without vendor lock-in',
    template: '%s | PayKit',
  },
  description:
    'The payment toolkit for TypeScript developers. Build locally, deploy anywhere. Switch payment providers with a single line of code.',
  keywords: [
    'payments',
    'typescript',
    'payment gateway',
    'stripe',
    'paypal',
    'open source',
    'developer tools',
  ],
  authors: [
    {
      name: 'Emmanuel Odii',
      url: 'https://odii.vercel.app',
    },
  ],
  creator: 'Emmanuel Odii',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://usepaykit.dev',
    title: 'PayKit - Build payments without vendor lock-in',
    description:
      'The payment toolkit for TypeScript developers. Build locally, deploy anywhere. Switch payment providers with a single line of code.',
    siteName: 'PayKit',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'PayKit - Build payments without vendor lock-in',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PayKit - Build payments without vendor lock-in',
    description:
      'The payment toolkit for TypeScript developers. Build locally, deploy anywhere.',
    images: ['/api/og'],
    creator: '@usepaykit',
    site: '@usepaykit',
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
  },
  metadataBase: new URL('https://usepaykit.dev'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          dmSans.variable,
          instrumentSerif.variable,
          jetBrainsMono.variable,
          'flex min-h-full flex-col antialiased',
        )}
      >
        <NextTopLoader
          color={'hsl(var(--primary))'}
          height={2}
          showSpinner={false}
        />
        <AppProviders>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
