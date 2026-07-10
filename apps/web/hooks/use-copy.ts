import { useState } from "react"

export function useCopy() {
  const [copied, setCopied] = useState(false)

  function handleCopy({ text }: { text: string; message?: string }) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return { copied, handleCopy }
}
