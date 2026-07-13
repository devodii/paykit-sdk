import type { SVGProps } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export function SdkLogo({
  size = 22,
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
        className="rounded-[5px] object-contain dark:hidden"
        priority={priority}
      />
      <Image
        src="/payment-dark.png"
        alt=""
        fill
        className="hidden rounded-[5px] object-contain dark:block"
        priority={priority}
      />
    </span>
  );
}

function Payroutes(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="414"
      height="414"
      viewBox="0 0 414 414"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
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

function GitHubMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

function XLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/twitter.svg"
      alt=""
      width={16}
      height={16}
      className={`size-4 invert dark:invert-0 ${className ?? ''}`}
    />
  );
}

const FOOTER_LINKS = [
  { label: 'Docs', href: '/docs' },
  { label: 'Changelog', href: '/changelog' },
  {
    label: 'GitHub',
    href: 'https://github.com/payrouteshq/paykit-sdk',
  },
  { label: 'Get started', href: '/docs/getting-started' },
];

const FOOTER_SOCIAL = [
  { label: 'X', href: 'https://x.com/payrouteshq' },
];

export function Footer() {
  return (
    <footer className="border-border mt-auto border-t px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Link href="/" className="flex items-center gap-2">
            <SdkLogo size={22} priority />
            <span className="text-foreground text-sm font-semibold">
              PayKit SDK
            </span>
          </Link>
          <p className="text-muted-foreground text-xs">
            universal payment adapter
          </p>
          <Link
            href="https://payroutes.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1.5"
          >
            <span className="text-muted-foreground text-xs">by</span>
            <Payroutes className="text-foreground size-4" />
            <span className="text-muted-foreground text-xs font-medium">
              Payroutes
            </span>
          </Link>
        </div>

        <div className="flex flex-col items-start gap-4 sm:items-end">
          <nav className="flex flex-wrap gap-x-8 gap-y-2 sm:justify-end">
            {FOOTER_LINKS.map(l => (
              <Link
                key={l.label}
                href={l.href}
                target={
                  l.href.startsWith('http') ? '_blank' : undefined
                }
                rel={
                  l.href.startsWith('http')
                    ? 'noopener noreferrer'
                    : undefined
                }
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {FOOTER_SOCIAL.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <XLogo />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export { GitHubMark };
