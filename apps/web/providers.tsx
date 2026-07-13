'use client';

import * as React from 'react';
import { initMixpanel } from '@/app/lib/analytics';
import { Toaster } from '@/components/ui/toast';
import { ThemeProvider } from 'next-themes';

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
