import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-4 mb-6",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight" data-testid="page-title">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground max-w-prose">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
