"use client"

import * as React from "react"
import Image from "next/image"
import { Check, Copy } from "lucide-react"
import { useTheme } from "next-themes"
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter"
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash"
import json from "react-syntax-highlighter/dist/esm/languages/prism/json"
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx"
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript"
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"

import { useCopy } from "@/hooks/use-copy"
import { useMounted } from "@/hooks/use-mounted"
  import { cn } from "@paykit-sdk/ui"
  import { Button } from "@paykit-sdk/ui"
import { ScrollArea } from "@paykit-sdk/ui"

SyntaxHighlighter.registerLanguage("tsx", tsx)
SyntaxHighlighter.registerLanguage("typescript", typescript)
SyntaxHighlighter.registerLanguage("bash", bash)
SyntaxHighlighter.registerLanguage("json", json)

// ponytail: inlined from @stellartools/core to avoid the dep
type SuggestedString<T extends string> = T | (string & {})

type Language = SuggestedString<"tsx" | "typescript" | "bash" | "json" | "shell" | "sh" | "zsh">

interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  language?: Language
  children: string
  filename?: string
  logo?: string
  showCopyButton?: boolean
  maxHeight?: string | "none"
  theme?: string
  highlightLines?: number[]
  headerLeft?: React.ReactNode
}

export function CodeBlock({
  language = "tsx",
  children,
  filename,
  logo,
  showCopyButton = true,
  className,
  maxHeight = "none",
  theme,
  highlightLines,
  headerLeft,
  ...props
}: CodeBlockProps) {
  const mounted = useMounted()
  const { resolvedTheme } = useTheme()
  const { copied, handleCopy } = useCopy()

  const isShell = ["bash", "sh", "shell", "zsh"].includes(language.toLowerCase())
  const showHeader = !isShell || !!filename || !!headerLeft

  const syntaxTheme = React.useMemo(() => {
    const isDark = theme === "dark" || resolvedTheme === "dark"
    const bg = isDark ? "#0a0a0a" : "#fafafa"
    const base = isDark ? oneDark : oneLight

    return {
      ...base,
      'pre[class*="language-"]': {
        ...base['pre[class*="language-"]'],
        background: bg,
        margin: 0,
        padding: "1.25rem",
        minWidth: "100%",
        width: "max-content",
        overflow: "visible",
      },
      'code[class*="language-"]': {
        ...base['code[class*="language-"]'],
        background: "transparent",
        fontSize: "0.875rem",
        fontFamily: "var(--font-jetbrains-mono), monospace",
      },
    }
  }, [theme, resolvedTheme])

  const isDarkTheme = theme === "dark" || resolvedTheme === "dark"

  if (!mounted) return <div className={cn("bg-muted h-24 w-full animate-pulse rounded-xl", className)} />

  const onCopy = () => handleCopy({ text: children, message: "Copied to clipboard" })

  return (
      <div
        className={cn(
          "group relative flex w-full flex-col overflow-hidden rounded-xl border",
          isDarkTheme ? "border-white/10 bg-[#0a0a0a]" : "border-border bg-muted/50",
          className
        )}
        style={{ height: maxHeight === "none" ? "auto" : maxHeight }}
        {...props}
      >
        {showHeader && (
          <div
            className={cn(
              "sticky top-0 z-20 flex shrink-0 items-center justify-between border-b px-4 py-2",
              isDarkTheme ? "border-white/10 bg-[#111111]" : "border-border bg-muted/50 backdrop-blur-sm"
            )}
          >
            <div className="flex items-center gap-2">
              {logo && <Image src={logo} alt="" width={14} height={14} className="object-contain" />}
              {headerLeft ?? (filename && (
                <span className={cn("text-xs font-medium", isDarkTheme ? "text-white/50" : "text-muted-foreground")}>
                  {filename}
                </span>
              ))}
            </div>
            {showCopyButton && !isShell && <CopyAction copied={copied} onClick={onCopy} isDark={isDarkTheme} />}
          </div>
        )}

        <ScrollArea.Root className="relative min-h-0 w-full flex-1 bg-transparent">
          {highlightLines?.length ? (
            <div style={{ padding: "1.25rem", minWidth: "100%", width: "max-content", background: isDarkTheme ? "#0a0a0a" : "#fafafa" }}>
              {children.trim().split("\n").map((line, i) => {
                const hl = highlightLines.includes(i + 1)
                if (!line) return <div key={i} style={{ height: "1.4em" }} />
                return (
                  <div
                    key={i}
                    className={cn(
                      "[&_pre]:!m-0 [&_pre]:!p-0 [&_*]:!bg-transparent",
                      hl && "-mx-5 border-l-2 border-primary/50 bg-primary/5 pl-[18px] pr-5"
                    )}
                  >
                    <SyntaxHighlighter
                      language={language as string}
                      style={syntaxTheme}
                      customStyle={{ margin: 0, padding: 0, background: "transparent", fontSize: "0.875rem", fontFamily: "var(--font-jetbrains-mono), monospace", lineHeight: "1.6" }}
                    >
                      {line}
                    </SyntaxHighlighter>
                  </div>
                )
              })}
            </div>
          ) : (
            <SyntaxHighlighter
              language={language as string}
              style={syntaxTheme}
              customStyle={{ display: "block", margin: 0 }}
            >
              {children.trim()}
            </SyntaxHighlighter>
          )}

          {!showHeader && showCopyButton && (
            <div className="absolute top-2 right-2 z-20 opacity-0 transition-opacity group-hover:opacity-100">
              <CopyAction copied={copied} onClick={onCopy} isFloating isDark={isDarkTheme} />
            </div>
          )}
        </ScrollArea.Root>
      </div>
  )
}

function CopyAction({
  copied,
  onClick,
  isFloating,
  isDark,
}: {
  copied: boolean
  onClick: () => void
  isFloating?: boolean
  isDark?: boolean
}) {
  return (
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={copied ? "Copied" : "Copy code"}
          className={cn(
            "h-7 w-7",
            isDark
              ? "text-white/50 hover:bg-white/10 hover:text-white"
              : "text-muted-foreground hover:text-foreground",
            isFloating && (isDark ? "border border-white/10 bg-black/80" : "bg-muted/80 border backdrop-blur-sm")
          )}
          onClick={onClick}
        >
          {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </Button>
     
  )
}
