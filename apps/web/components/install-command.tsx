'use client';

import { useCopy } from '@/hooks/use-copy';
import { Terminal, Check, Copy } from 'lucide-react';

export function InstallCommand({ pkg }: { pkg: string }) {
  const cmd = `pnpm add @paykit-sdk/core ${pkg}`;
  const { copied, handleCopy } = useCopy();
  return (
    <div className="border-border bg-muted/30 dark:bg-muted/10 inline-flex max-w-full items-center gap-3 rounded-xl border px-4 py-2.5 font-mono text-sm">
      <Terminal
        size={13}
        className="text-muted-foreground shrink-0"
      />
      <span className="text-foreground/80 truncate">{cmd}</span>
      <button
        onClick={() => handleCopy({ text: cmd })}
        aria-label={copied ? 'Copied' : 'Copy command'}
        className="text-muted-foreground hover:text-foreground ml-1 shrink-0 transition-colors"
      >
        {copied ? (
          <Check size={13} className="text-green-500" />
        ) : (
          <Copy size={13} />
        )}
      </button>
    </div>
  );
}
