interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** Title + optional action pinned top-right (mobile-friendly); description under title. */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {action ? <div className="shrink-0 justify-self-end">{action}</div> : null}
        {description ? (
        <p className="col-start-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
