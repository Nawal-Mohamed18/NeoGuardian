import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground border-border",
        high: "border-red-200 bg-red-50 text-red-700",
        medium: "border-amber-200 bg-amber-50 text-amber-700",
        low: "border-emerald-200 bg-emerald-50 text-emerald-700",
        critical: "border-red-200 bg-red-50 text-red-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        info: "border-sky-200 bg-sky-50 text-sky-700",
        active: "border-emerald-200 bg-emerald-50 text-emerald-700",
        scheduled: "border-blue-200 bg-blue-50 text-blue-700",
        followup: "border-amber-200 bg-amber-50 text-amber-700",
        discharged: "border-slate-200 bg-slate-50 text-slate-600",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
