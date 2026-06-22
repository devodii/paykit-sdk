# PayKit

The Payment Toolkit for TypeScript developers.

<a href="https://vercel.com/open-source-program"><img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge-2026.svg"/></a>

PayKit is a unified SDK that simplifies payment processing across different providers with a consistent API.

## Quick Start

Choose your preferred way to get started:

### 1. Using the Registry (Recommended)

Install complete integrations using shadcn CLI:

```bash
# Quick start - Direct URLs
npx shadcn@latest add https://usepaykit.dev/r/stripe-nextjs
npx shadcn@latest add https://usepaykit.dev/r/stripe-hono
npx shadcn@latest add https://usepaykit.dev/r/paypal-nextjs

# Or configure once and use namespace
# Add to components.json: "@paykit": "https://usepaykit.dev/r/{name}"
npx shadcn@latest add @paykit/stripe-nextjs
npx shadcn@latest add @paykit/stripe-hono
npx shadcn@latest add @paykit/paypal-nextjs
```

See the [Registry documentation](packages/registry/README.md) for all available integrations.

### 2. Manual Installation

```bash
npm install @paykit-sdk/core @paykit-sdk/stripe
```

Then follow the [Core Package documentation](packages/paykit/README.md) for setup.

## Packages

| Package                                           | Description                         |
| ------------------------------------------------- | ----------------------------------- |
| [`@paykit-sdk/core`](packages/paykit)             | Main PayKit SDK                     |
| [`@paykit-sdk/react`](packages/react)             | React hooks and components          |
| [`@paykit-sdk/registry`](packages/registry)       | Component registry for integrations |
| **Providers**                                     |                                     |
| [`@paykit-sdk/stripe`](packages/stripe)           | Stripe integration                  |
| [`@paykit-sdk/polar`](packages/polar)             | Polar integration                   |
| [`@paykit-sdk/paypal`](packages/paypal)           | PayPal integration                  |
| **Tools**                                         |                                     |
| [`@paykit-sdk/ui`](packages/ui)                   | UI components                       |
| [Custom Provider Guide](packages/custom-provider) | Build your own provider             |

## Documentation

Visit [Paykit](https://usepaykit.dev) for complete documentation, examples, and guides.

---

Maintained by [Emmanuel Odii](https://github.com/devodii)
