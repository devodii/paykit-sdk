'use client';

import { useState } from 'react';
import type { SVGProps } from 'react';
import { Sun, Moon, Menu, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import Link from 'next/link';

function Payroutes(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="414"
      height="414"
      viewBox="0 0 414 414"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M211.622 188.301C225.3 261.901 248.491 332.961 282.897 398.721C297.216 393.061 310.754 385.841 323.31 377.301C275.967 321.321 238.738 257.141 215.287 187.401C215.146 187.001 214.726 186.781 214.305 186.901C213.644 187.101 212.944 187.261 212.263 187.381C211.822 187.461 211.542 187.881 211.622 188.301Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M224.639 181.541C224.098 181.981 223.538 182.421 222.957 182.821C222.596 183.081 222.496 183.561 222.757 183.921C263.05 242.461 310.253 295.421 364.706 340.061C373.918 329.201 382.029 317.401 388.858 304.801C327.877 273.561 272.283 232.241 225.721 181.621C225.44 181.301 224.96 181.281 224.639 181.561V181.541Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M95.4871 221.741C125.567 208.061 154.846 192.381 183.264 174.961C189.813 170.941 196.321 166.841 202.79 162.621V69.9606H227.182C240.741 69.9606 252.216 80.5606 252.636 94.1006C253.057 108.161 241.722 119.741 227.723 119.741L210.901 119.641V162.621C217.369 166.821 223.878 170.941 230.447 174.961C286.361 209.221 345.68 236.781 407.823 255.581C411.788 239.341 413.811 222.361 413.671 204.881C412.77 90.9006 320.487 -0.279357 206.335 0.00064315C92.1827 0.280643 0 92.6606 0 206.561C0 223.441 2.02269 239.861 5.86781 255.581C36.4485 246.341 66.3483 234.981 95.4871 221.721V221.741Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M198.404 187.401C174.953 257.141 137.723 321.301 90.3803 377.301C102.937 385.861 116.475 393.081 130.794 398.741C150.02 361.981 165.761 323.581 178.277 283.981C188.151 252.761 196.041 220.781 202.069 188.341C202.149 187.901 201.869 187.501 201.428 187.421C200.727 187.281 200.046 187.121 199.365 186.941C198.965 186.821 198.524 187.041 198.404 187.441V187.401Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M190.714 182.801C190.133 182.401 189.572 181.981 189.052 181.521C188.731 181.241 188.251 181.281 187.95 181.581C141.388 232.201 85.8143 273.521 24.813 304.761C31.6421 317.361 39.7529 329.181 48.9652 340.041C103.418 295.381 150.621 242.421 190.914 183.901C191.155 183.541 191.074 183.041 190.714 182.801Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M206.054 328.481C201.729 356.761 195.34 384.761 187.029 412.201C193.538 412.821 200.146 413.141 206.835 413.141C213.524 413.141 220.113 412.821 226.622 412.201C218.331 384.761 211.942 356.761 207.596 328.481C207.456 327.581 206.175 327.581 206.034 328.481H206.054Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SdkLogo({
  size = 32,
  priority = false,
}: {
  size?: number;
  priority?: boolean;
}) {
  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src="/payment-light.png"
        alt=""
        fill
        className="rounded-[6px] object-contain dark:hidden"
        priority={priority}
      />
      <Image
        src="/payment-dark.png"
        alt=""
        fill
        className="hidden rounded-[6px] object-contain dark:block"
        priority={priority}
      />
    </span>
  );
}

function GitHubMark() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

const MOBILE_LINKS = [
  { label: 'Docs', href: '/docs' },
  { label: 'Changelog', href: '/changelog' },
  {
    label: 'GitHub',
    href: 'https://github.com/payrouteshq/paykit-sdk',
    external: true,
  },
];

export function Navbar() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleTheme() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }

  return (
    <>
      <header className="bg-background/90 border-border/50 fixed inset-x-0 top-0 z-50 h-14 border-b backdrop-blur-md">
        <div className="mx-auto flex h-full w-full max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-5">
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
            <Link
              href="https://payroutes.sh"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Payroutes"
              className="transition-opacity hover:opacity-80"
            >
              <Payroutes
                className="text-foreground h-6 w-6"
                aria-hidden="true"
              />
            </Link>
            <span className="text-muted-foreground/40 text-base font-light select-none">
              /
            </span>
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2 sm:gap-2.5"
              aria-label="Payment SDK home"
            >
              <SdkLogo size={30} priority />
              <span className="text-foreground hidden truncate text-[14px] leading-none font-semibold tracking-tight sm:inline">
                Payment{' '}
                <span className="text-muted-foreground font-normal">
                  SDK
                </span>
              </span>
            </Link>
          </div>

          <div className="hidden min-w-0 flex-1 items-center gap-0.5 md:flex">
            <Link
              href="/docs"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex h-8 items-center rounded-md px-3 text-[13px] transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/changelog"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex h-8 items-center rounded-md px-3 text-[13px] transition-colors"
            >
              Changelog
            </Link>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              href="https://github.com/payrouteshq/paykit-sdk"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50 hidden h-8 w-8 items-center justify-center rounded-md transition-colors md:flex"
            >
              <GitHubMark />
            </Link>

            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex h-8 w-8 items-center justify-center rounded-md transition-colors"
            >
              {resolvedTheme === 'dark' ? (
                <Sun size={15} strokeWidth={1.75} />
              ) : (
                <Moon size={15} strokeWidth={1.75} />
              )}
            </button>

            <Link
              href="/docs/getting-started"
              className="bg-foreground text-background ml-1 hidden h-8 items-center rounded-md px-3.5 text-[13px] font-medium transition-opacity hover:opacity-80 md:inline-flex"
            >
              Get started
            </Link>

            <button
              onClick={() => setMobileOpen(open => !open)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex h-8 w-8 items-center justify-center rounded-md transition-colors md:hidden"
            >
              {mobileOpen ? (
                <X size={16} strokeWidth={2} />
              ) : (
                <Menu size={16} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="bg-background/60 fixed inset-0 top-14 z-30 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="border-border bg-background fixed inset-x-0 top-14 z-40 max-h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-contain border-b md:hidden">
            <div className="px-4 py-4">
              <div className="space-y-0.5">
                {MOBILE_LINKS.map(item => (
                  <Link
                    key={item.label}
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    rel={
                      item.external
                        ? 'noopener noreferrer'
                        : undefined
                    }
                    onClick={() => setMobileOpen(false)}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center rounded-xl px-2 py-2.5 text-[13px] transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              <div className="mt-4">
                <Link
                  href="/docs/getting-started"
                  onClick={() => setMobileOpen(false)}
                  className="bg-foreground text-background flex h-9 items-center justify-center rounded-xl text-[13px] font-medium"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
