interface DashboardHeroProps {
  displayName: string;
  roleLabel: string;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardHero({ displayName, roleLabel }: DashboardHeroProps) {
  return (
    <section className="dashboard-hero relative overflow-hidden rounded-xl border border-teal-100/80 bg-linear-to-br from-white via-teal-50/40 to-cyan-50/60 px-4 py-4 shadow-sm sm:px-5">
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-teal-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-32 rounded-full bg-cyan-200/20 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700/80">
            {greeting()}, {displayName}
          </p>
          <span className="pulse-dot inline-flex items-center gap-1.5 rounded-full border border-red-200/80 bg-red-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 dark:bg-red-400" />
            AI Live
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]">
          Neonatal Clinical Overview
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          28-day risk stratification for admitted newborns ·{" "}
          <span className="font-medium text-foreground">{roleLabel}</span>
        </p>
      </div>
    </section>
  );
}
