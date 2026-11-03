import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.055em] [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-line-strong bg-surface-2 text-fg-muted",
        violet: "border-violet/25 bg-violet-soft text-[color:color-mix(in_oklab,var(--violet)_78%,white)]",
        cyan: "border-cyan/25 bg-cyan/10 text-cyan",
        green: "border-green/25 bg-green/10 text-green",
        red: "border-red/25 bg-red/10 text-red",
        amber: "border-amber/25 bg-amber/10 text-amber",
        outline: "border-line-strong bg-transparent text-fg-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
