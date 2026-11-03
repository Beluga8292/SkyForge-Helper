import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/utils/cn";

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function Tooltip({
  children,
  content,
  side = "top",
  align = "center",
  delay = 250,
  bare = false,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delay?: number;
  /** Render content without the default panel chrome (used by item tooltips). */
  bare?: boolean;
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-[100] data-[state=delayed-open]:animate-[fade-in_120ms_ease-out]",
            bare
              ? "max-w-[calc(100vw-2rem)] outline-none"
              : "max-w-72 rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-[11.5px] leading-snug text-fg shadow-[0_12px_30px_rgba(0,0,0,0.45)]",
          )}
        >
          {content}
          {!bare ? (
            <TooltipPrimitive.Arrow className="fill-[var(--surface-2)]" width={10} height={5} />
          ) : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
