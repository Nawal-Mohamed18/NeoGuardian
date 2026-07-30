import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface SectionCardProps {
  title: string;
  icon?: LucideIcon;
  iconClassName?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export function SectionCard({
  title,
  icon: Icon,
  iconClassName,
  viewAllHref,
  viewAllLabel = "View all",
  className,
  bodyClassName,
  children,
}: SectionCardProps) {
  return (
    <Card className={cn("flex flex-col overflow-hidden shadow-sm", className)}>
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn("h-4 w-4 text-muted-foreground", iconClassName)} />}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {viewAllHref && (
          <Link
            to={viewAllHref}
            className="text-xs font-medium text-primary transition-colors hover:text-teal-700"
          >
            {viewAllLabel}
          </Link>
        )}
      </div>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}
