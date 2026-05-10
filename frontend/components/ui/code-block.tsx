"use client";

import { useState } from "react";
import { Clipboard, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}

export function CodeBlock({
  code,
  language = "typescript",
  filename,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border-primary overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between bg-bg-secondary px-4 py-2 border-b border-border-primary">
        <span className="text-xs font-mono text-text-tertiary">
          {filename ?? language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check size={13} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Clipboard size={13} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="bg-bg-tertiary overflow-x-auto p-4 m-0">
        <code className="text-sm font-mono text-text-primary whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
}
