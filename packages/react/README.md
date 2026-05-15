# @paykit-sdk/react

PayKit React is a toolkit designed to simplify payment processing in React applications. It provides hooks and components that work seamlessly with any PayKit provider (Stripe, Polar, Gumroad, etc.) to handle customers, subscriptions, and checkouts.

## Installation

```bash
npm install @paykit-sdk/react
```

## Quick Start

### 1. Setup PayKit

```tsx
import { PayKit } from '@paykit-sdk/core';
import { paypal } from '@paykit-sdk/paypal';

const provider = paypal();
const paykit = new PayKit(provider);

export { provider, paykit };
```

### 2. Setup Provider

```tsx
import { provider } from '@lib/paykit';
import { PaykitProvider } from '@paykit-sdk/react';

function App() {
  return (
    <PaykitProvider provider={provider}>
      <YourApp />
    </PaykitProvider>
  );
}
```

### 3. Use Hooks

```tsx
import * as React from 'react';
import { useCustomer, useSubscription, useCheckout } from '@paykit-sdk/react';
import { CustomerView } from './customer-view';

const CustomerDashboard = ({ customerId }: { customerId: string }) => {
  const { retrieve, create, update } = useCustomer();

  React.useEffect(() => {
    retrieve.run(customerId);
  }, [customerId]);

  if (retrieve.loading) return <Spinner />;

  if (retrieve.error) return <Error error={retrieve.error} />;

  return <CustomerView customer={retrieve.data} />;
};
```

## Available Hooks

- `useCustomer()` - Manage customer data
- `useSubscription()` - Handle subscriptions
- `useCheckout()` - Process checkouts

## Providers

Works with any PayKit provider including Stripe, Polar, Gumroad, and more.

## Documentation

- [PayKit Documentation](https://usepaykit.dev/docs)

## TypeScript Support

Full TypeScript support included.

## License

MIT
