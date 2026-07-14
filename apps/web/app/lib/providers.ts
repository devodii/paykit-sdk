export interface Provider {
  id: string;
  name: string;
  tagline: string;
  region: string;
  packageName: string;
  initFn: string;
  website: string;
  docsUrl: string;
  logo: string | null;
}

// TODO: move to the DB once the provider registry ships. Keep IDs stable —
// they're the public slug in /providers/[providerId] and get linked from
// partner docs.
export const PROVIDERS: Provider[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    tagline: 'Global payment processing',
    region: 'Global',
    packageName: '@paykit-sdk/stripe',
    initFn: 'stripe',
    website: 'https://stripe.com',
    docsUrl: 'https://docs.usepaykit.dev/providers/stripe',
    logo: '/providers/stripe.jpeg',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    tagline: 'Online payments and checkout',
    region: 'Global',
    packageName: '@paykit-sdk/paypal',
    initFn: 'paypal',
    website: 'https://paypal.com',
    docsUrl: 'https://docs.usepaykit.dev/providers/paypal',
    logo: '/providers/paypal.webp',
  },
  {
    id: 'polar',
    name: 'Polar',
    tagline: 'Open source monetization for developers',
    region: 'Global',
    packageName: '@paykit-sdk/polar',
    initFn: 'polar',
    website: 'https://polar.sh',
    docsUrl: 'https://docs.usepaykit.dev/providers/polar',
    logo: '/providers/polar.jpg',
  },
  {
    id: 'gopay',
    name: 'GoPay',
    tagline: 'Payment gateway for Central Europe',
    region: 'Czech Republic',
    packageName: '@paykit-sdk/gopay',
    initFn: 'gopay',
    website: 'https://gopay.com',
    docsUrl: 'https://docs.usepaykit.dev/providers/gopay',
    logo: null,
  },
  {
    id: 'paystack',
    name: 'Paystack',
    tagline: 'Payments infrastructure for Africa',
    region: 'Africa',
    packageName: '@paykit-sdk/paystack',
    initFn: 'paystack',
    website: 'https://paystack.com',
    docsUrl: 'https://docs.usepaykit.dev/providers/paystack',
    logo: null,
  },
  {
    id: 'monnify',
    name: 'Monnify',
    tagline: 'Payment collections by Moniepoint',
    region: 'Nigeria',
    packageName: '@paykit-sdk/monnify',
    initFn: 'monnify',
    website: 'https://monnify.com',
    docsUrl: 'https://docs.usepaykit.dev/providers/monnify',
    logo: null,
  },
  {
    id: 'comgate',
    name: 'Comgate',
    tagline: 'Payment gateway for Central Europe',
    region: 'Czech Republic',
    packageName: '@paykit-sdk/comgate',
    initFn: 'comgate',
    website: 'https://comgate.cz',
    docsUrl: 'https://docs.usepaykit.dev/providers/comgate',
    logo: null,
  },
  {
    id: 'redsys',
    name: 'Redsys',
    tagline: 'Card payment processing for Spain',
    region: 'Spain',
    packageName: '@paykit-sdk/redsys',
    initFn: 'redsys',
    website: 'https://redsys.es',
    docsUrl: 'https://docs.usepaykit.dev/providers/redsys',
    logo: null,
  },
  {
    id: 'moneygram',
    name: 'MoneyGram',
    tagline: 'Global money transfer and remittance',
    region: 'Global',
    packageName: '@paykit-sdk/moneygram',
    initFn: 'moneygram',
    website: 'https://moneygram.com',
    docsUrl: 'https://docs.usepaykit.dev/providers/moneygram',
    logo: null,
  },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find(p => p.id === id);
}
