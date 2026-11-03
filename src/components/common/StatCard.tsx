import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

const TONES = {
  violet: "border-violet/20 bg-violet-soft text-violet",
  cyan: "border-cyan/20 bg-cyan/10 text-cyan",
  green: "border-green/20 bg-green/10 text-green",
  amber: "border-amber/20 bg-amber/10 text-amber",
  red: "border-red/20 bg-red/10 text-red",
  neutral: "border-line-strong bg-surface-2 text-fg-muted",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
  loading = false,
  unavailable,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  className?: string;
  loading?: boolean;
  unavailable?: boolean;
}) {
  return (
    <div className={cn("panel relative overflow-hidden p-4", className)}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-fg-subtle">{label}</span>
        {Icon ? (
          <span className={cn("flex size-7 items-center justify-center rounded-lg border", TONES[tone])}>
            <Icon className="size-3.5" />
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-24 animate-pulse rounded bg-surface-3" />
      ) : unavailable ? (
        <p className="mt-3 text-[13px] italic text-fg-subtle">нет данных</p>
      ) : (
        <p className="mt-2 truncate text-[22px] font-semibold leading-tight tracking-[-0.03em] text-fg tabular-nums">{value}</p>
      )}
      {hint ? <p className="mt-1.5 truncate text-[10.5px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}
