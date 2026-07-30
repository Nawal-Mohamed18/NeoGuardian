import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveStaffAvatar } from "@/lib/avatarImage";
import { cn } from "@/lib/utils";

function initialsFromName(name: string) {
  return (
    name
      .replace(/^Dr\.\s+/i, "")
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

const SIZE_CLASS = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

/** One consistent staff portrait: custom upload, else role/username default, else initials. */
export function StaffAvatar({
  name,
  username,
  role,
  avatarData,
  size = "md",
  className,
  fallbackClassName,
}: {
  name: string;
  username?: string | null;
  role?: string | null;
  avatarData?: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  fallbackClassName?: string;
}) {
  const src = resolveStaffAvatar({ avatarData, username, role });
  return (
    <Avatar className={cn("shrink-0 border border-border/60", SIZE_CLASS[size], className)}>
      {src ? <AvatarImage src={src} alt="" className="object-cover" /> : null}
      <AvatarFallback className={cn("font-semibold", fallbackClassName)}>
        {initialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  );
}
