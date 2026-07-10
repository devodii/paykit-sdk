'use client';

import * as React from 'react';
import { Toaster } from '@paykit-sdk/ui';
import { ThemeProvider } from 'next-themes';
import { initMixpanel } from '@/app/lib/analytics';

export const AppProviders = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  React.useEffect(() => {
    initMixpanel();
  }, []);

  const Provider = ThemeProvider as React.ComponentType<any>;

  return (
    <Provider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <Toaster />
    </Provider>
  );
};
