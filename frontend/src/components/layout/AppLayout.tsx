import { cn } from "@/lib/utils";
import { TopNav } from "./TopNav";
import { MobileNav } from "./MobileNav";
import { useSidebarUi } from "@/context/SidebarUiContext";

interface AppLayoutProps {
  children: React.ReactNode;
  alertCount?: number;
  /** Chat-style pages: fill viewport, no page scroll, keep composer above mobile nav */
  immersive?: boolean;
}

export function AppLayout({ children, alertCount, immersive = false }: AppLayoutProps) {
  const { expanded: sidebarExpanded } = useSidebarUi();

  return (
    <div className={cn("bg-background", immersive ? "h-dvh overflow-hidden" : "min-h-screen")}>
      <div
        className={cn(
          "flex min-w-0 flex-col transition-[padding] duration-300 ease-out",
          immersive ? "h-full" : "min-h-screen",
          sidebarExpanded ? "lg:pl-56" : "lg:pl-16"
        )}
      >
        <TopNav alertCount={alertCount} />
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            immersive
              ? "overflow-hidden p-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:overflow-hidden lg:p-4 lg:pb-4"
              : "overflow-y-auto p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:p-5 lg:pb-5"
          )}
        >
          <div
            className={cn(
              "mx-auto w-full",
              immersive ? "flex h-full min-h-0 max-w-[96rem] flex-1 flex-col" : "max-w-7xl"
            )}
          >
            {children}
          </div>
        </main>
        <MobileNav />
        {!immersive && (
          <footer className="hidden border-t border-border bg-card px-4 py-1.5 text-center text-[11px] text-muted-foreground lg:block">
            AI-generated risk estimates support clinical judgment only — not a diagnosis. Verify all findings with standard care.
          </footer>
        )}
      </div>
    </div>
  );
}
