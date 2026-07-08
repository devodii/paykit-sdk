"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Terminal, ArrowRight, Check, Copy } from "lucide-react"
import type { SVGProps } from "react"
import { CodeBlock } from "@/components/code-block"
import { useCopy } from "@/hooks/use-copy"
import { Navbar } from "@/components/navbar"
const PROVIDERS = [
  { id: "stripe", name: "Stripe", description: "Global payment processing",  pkg: "@paykit-sdk/stripe", fn: "stripe" },
  { id: "paypal", name: "PayPal", description: "PayPal payments",             pkg: "@paykit-sdk/paypal", fn: "paypal" },
  { id: "polar",  name: "Polar",  description: "Open source monetization",    pkg: "@paykit-sdk/polar",  fn: "polar"  },
  { id: "gopay",  name: "GoPay",  description: "Monetization in Czechia",     pkg: "@paykit-sdk/gopay",  fn: "goPay" },
]

function providerCode(p: (typeof PROVIDERS)[0]) {
  return `import { PayKit } from '@paykit-sdk/core';
import { ${p.fn} } from '${p.pkg}';

const provider = ${p.fn}();
const paykit = new PayKit(provider);

const customer = await paykit.customers.create({
  email: 'customer@example.com',
});

const checkout = await paykit.checkouts.create({
  customer_id: customer.id,
  metadata: { order_id: '123' },
  session_type: 'one_time',
  item_id: 'price_123',
});`
}


function InstallCommand({ pkg }: { pkg: string }) {
  const cmd = `pnpm add @paykit-sdk/core ${pkg}`
  const { copied, handleCopy } = useCopy()
  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-border bg-muted/30 dark:bg-muted/10 px-4 py-2.5 font-mono text-sm max-w-full">
      <Terminal size={13} className="text-muted-foreground shrink-0" />
      <span className="text-foreground/80 truncate">{cmd}</span>
      <button
        onClick={() => handleCopy({ text: cmd })}
        aria-label={copied ? "Copied" : "Copy command"}
        className="ml-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
      </button>
    </div>
  )
}


function SdkLogo({ size = 22, priority = false }: { size?: number; priority?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <Image src="/payment-light.png" alt="" fill className="object-contain rounded-[5px] dark:hidden" priority={priority} />
      <Image src="/payment-dark.png" alt="" fill className="object-contain rounded-[5px] hidden dark:block" priority={priority} />
    </span>
  )
}

function Payroutes(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="414" height="414" viewBox="0 0 414 414" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path fillRule="evenodd" clipRule="evenodd" d="M211.622 188.301C225.3 261.901 248.491 332.961 282.897 398.721C297.216 393.061 310.754 385.841 323.31 377.301C275.967 321.321 238.738 257.141 215.287 187.401C215.146 187.001 214.726 186.781 214.305 186.901C213.644 187.101 212.944 187.261 212.263 187.381C211.822 187.461 211.542 187.881 211.622 188.301Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M224.639 181.541C224.098 181.981 223.538 182.421 222.957 182.821C222.596 183.081 222.496 183.561 222.757 183.921C263.05 242.461 310.253 295.421 364.706 340.061C373.918 329.201 382.029 317.401 388.858 304.801C327.877 273.561 272.283 232.241 225.721 181.621C225.44 181.301 224.96 181.281 224.639 181.561V181.541Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M95.4871 221.741C125.567 208.061 154.846 192.381 183.264 174.961C189.813 170.941 196.321 166.841 202.79 162.621V69.9606H227.182C240.741 69.9606 252.216 80.5606 252.636 94.1006C253.057 108.161 241.722 119.741 227.723 119.741L210.901 119.641V162.621C217.369 166.821 223.878 170.941 230.447 174.961C286.361 209.221 345.68 236.781 407.823 255.581C411.788 239.341 413.811 222.361 413.671 204.881C412.77 90.9006 320.487 -0.279357 206.335 0.00064315C92.1827 0.280643 0 92.6606 0 206.561C0 223.441 2.02269 239.861 5.86781 255.581C36.4485 246.341 66.3483 234.981 95.4871 221.721V221.741Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M198.404 187.401C174.953 257.141 137.723 321.301 90.3803 377.301C102.937 385.861 116.475 393.081 130.794 398.741C150.02 361.981 165.761 323.581 178.277 283.981C188.151 252.761 196.041 220.781 202.069 188.341C202.149 187.901 201.869 187.501 201.428 187.421C200.727 187.281 200.046 187.121 199.365 186.941C198.965 186.821 198.524 187.041 198.404 187.441V187.401Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M190.714 182.801C190.133 182.401 189.572 181.981 189.052 181.521C188.731 181.241 188.251 181.281 187.95 181.581C141.388 232.201 85.8143 273.521 24.813 304.761C31.6421 317.361 39.7529 329.181 48.9652 340.041C103.418 295.381 150.621 242.421 190.914 183.901C191.155 183.541 191.074 183.041 190.714 182.801Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M206.054 328.481C201.729 356.761 195.34 384.761 187.029 412.201C193.538 412.821 200.146 413.141 206.835 413.141C213.524 413.141 220.113 412.821 226.622 412.201C218.331 384.761 211.942 356.761 207.596 328.481C207.456 327.581 206.175 327.581 206.034 328.481H206.054Z" fill="currentColor" />
    </svg>
  )
}

const FOOTER_LINKS = [
  { label: "Docs", href: "/docs" },
  { label: "Changelog", href: "/changelog" },
  { label: "GitHub", href: "https://github.com/payrouteshq/paykit-sdk" },
  { label: "Get started", href: "/docs/getting-started" },
]

const FOOTER_SOCIAL = [
  { label: "X", href: "https://x.com/devodii" },
]

function XLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/twitter.svg"
      alt=""
      width={16}
      height={16}
      className={`size-4 invert dark:invert-0 ${className ?? ""}`}
    />
  )
}

function GitHubMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  )
}

export default function Page() {
  const [activeProvider, setActiveProvider] = useState(PROVIDERS[0])

  return (
    <main className="flex flex-col min-h-screen">
      <Navbar />
      <section className="relative flex flex-col items-center text-center pt-40 pb-20 px-5 overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[500px] dark:hidden" style={{ background: "radial-gradient(ellipse 70% 40% at 50% 0%, oklch(0.92 0 0 / 0.6) 0%, transparent 100%)" }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[500px] hidden dark:block" style={{ background: "radial-gradient(ellipse 70% 40% at 50% 0%, oklch(0.3 0 0 / 0.4) 0%, transparent 100%)" }} />

        <p className="relative mb-8 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          A Payroutes Company.
        </p>

        <h1 className="relative font-heading text-[clamp(2.8rem,7vw,5rem)] leading-[1.04] tracking-[-0.02em] text-foreground max-w-3xl">
          Build payments
          <br />
          <span className="text-muted-foreground">without vendor lock-in</span>
        </h1>

        <p className="relative mt-6 max-w-xl text-[15px] text-muted-foreground leading-relaxed">
          A consistent TypeScript API across Stripe, PayPal, Polar, and more.
          Swap providers with{" "}
          <span className="text-foreground font-medium">2 lines of code.</span>
        </p>

        <div className="relative mt-8 flex items-center gap-3 flex-wrap justify-center">
          <Link href="/docs" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-foreground text-background text-[13px] font-medium hover:opacity-85 transition-opacity">
            Read Documentation <ArrowRight size={13} />
          </Link>
          <Link href="https://github.com/payrouteshq/paykit-sdk" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-[13px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
            <GitHubMark /> View on GitHub
          </Link>
        </div>

        <div className="relative mt-6">
          <InstallCommand pkg={activeProvider.pkg} />
        </div>
      </section>

      <section className="px-5 pb-24 flex flex-col items-center gap-16">

        <div className="w-full max-w-4xl flex flex-col items-center">
          <div className="mb-5 flex flex-col items-center gap-1 text-center">
            <p className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-widest">Live demo</p>
            <h2 className="font-heading text-2xl text-foreground">
              Switch providers with{" "}
              <span className="text-muted-foreground">just 2 lines of code</span>
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              Only the import and initializer change. Everything else stays the same.
            </p>
          </div>
          <CodeBlock
            language="typescript"
            key={activeProvider.id}
            className="w-full"
            highlightLines={[2, 4]}
            headerLeft={
              <div className="flex gap-1">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActiveProvider(p)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      p.id === activeProvider.id
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground/70"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            }
          >
            {providerCode(activeProvider)}
          </CodeBlock>
          <p className="mt-3 text-center text-[12px] text-muted-foreground/60 font-mono">
            Lines 2–3 are the only difference across all providers
          </p>
        </div>

      </section>

      <footer className="border-t border-border mt-auto px-6 py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <Link href="/" className="flex items-center gap-2">
              <SdkLogo size={22} priority />
              <span className="text-foreground text-sm font-semibold">Payment SDK</span>
            </Link>
            <p className="text-muted-foreground text-xs">universal payment adapter</p>
            <Link href="https://payroutes.sh" target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">by</span>
              <Payroutes className="text-foreground size-4" />
              <span className="text-muted-foreground text-xs font-medium">Payroutes</span>
            </Link>
          </div>

          <div className="flex flex-col items-start gap-4 sm:items-end">
            <nav className="flex flex-wrap gap-x-8 gap-y-2 sm:justify-end">
              {FOOTER_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  target={l.href.startsWith("http") ? "_blank" : undefined}
                  rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              {FOOTER_SOCIAL.map(({ label, href }) => (
                <Link key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="text-muted-foreground hover:text-foreground transition-colors">
                  <XLogo />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
