import { Activity } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="force-light min-h-screen bg-linear-to-br from-slate-200/80 via-slate-100 to-teal-50/60 p-4 lg:p-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-slate-400/25 lg:grid-cols-2">
          <div className="relative hidden overflow-hidden lg:block">
            <img
              src="/auth-hero.png"
              alt="Nurse cradling a newborn in a neonatal care unit"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 top-0 h-2/5 bg-linear-to-b from-white/95 via-white/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-teal-950/75 via-teal-900/25 to-transparent" />

            <div className="relative flex h-full min-h-[560px] flex-col p-9">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-teal-400 to-primary shadow-sm">
                    <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
                  </div>
                  <span className="text-xl font-bold text-slate-900">
                    Neo<span className="text-primary">Guardian</span>
                  </span>
                </div>

                <h1 className="mt-10 text-3xl font-bold leading-snug text-slate-900">
                  Stratify <span className="text-primary">neonatal risk</span>
                  <br />
                  at the earliest moment
                </h1>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-600">
                  AI-supported 28-day clinical risk estimates for NICU teams — decision support, not a diagnosis.
                </p>

                <svg viewBox="0 0 260 40" className="mt-5 h-8 w-56 text-primary/70" fill="none">
                  <path
                    d="M0 20 H55 l8 -15 l10 30 l8 -22 l6 12 H130 l8 -16 l10 32 l7 -18 H260"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-sm">
              {children}
              <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
                Risk estimates are clinical decision support only — not a diagnosis. Always verify with clinical judgment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
