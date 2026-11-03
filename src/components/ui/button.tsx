import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium outline-none transition-[background,color,border,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet disabled:pointer-events-none disabled:opacity-45 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-violet text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_6px_20px_-8px_rgba(139,92,246,0.75)] hover:bg-[color-mix(in_oklab,var(--violet)_88%,white)]",
        secondary: "border border-line-strong bg-surface-2 text-fg hover:bg-surface-3",
        outline: "border border-line-strong bg-transparent text-fg hover:border-[color-mix(in_oklab,var(--violet)_45%,transparent)] hover:bg-violet-soft",
        ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
        destructive: "bg-red/10 text-red border border-red/25 hover:bg-red/20",
        link: "text-violet underline-offset-4 hover:underline",
        success: "bg-green/12 text-green border border-green/25 hover:bg-green/18",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 rounded-md px-2.5 text-[13px]",
        lg: "h-11 rounded-xl px-5 text-[15px]",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
