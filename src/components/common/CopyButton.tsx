import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/utils/cn";

export function CopyButton({ value, className, label = "Copy" }: { value: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          })
          .catch(() => undefined);
      }}
      aria-label={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg",
        className,
      )}
    >
      {copied ? <Check className="size-3.5 text-green" /> : <Copy className="size-3.5" />}
    </button>
  );
}
