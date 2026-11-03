import * as React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuGroup = DropdownPrimitive.Group;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[95] min-w-52 overflow-hidden rounded-xl border border-line-strong bg-surface-2 p-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] data-[state=open]:animate-[fade-in_120ms_ease-out]",
        className,
      )}
      {...props}
    />
  </DropdownPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { active?: boolean }
>(({ className, active, children, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-fg-muted outline-none transition-colors focus:bg-surface-3 focus:text-fg data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-4",
      active && "bg-surface-3 text-fg",
      className,
    )}
    {...props}
  >
    {children}
    {active ? <Check className="ml-auto size-3.5 text-violet" /> : null}
  </DropdownPrimitive.Item>
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Label ref={ref} className={cn("px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-subtle", className)} {...props} />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export function DropdownMenuSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className={cn("my-1 h-px bg-line", className)} {...props} />;
}
