import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

type Meta = { proxy: string; upstream_default: string; version: string };
type Health = { status: string };

/**
 * Compact pill that polls /api/_meta (BFF) and /proxy/health (upstream).
 * Renders three states: probing, healthy, error.
 */
export function UpstreamBadge() {
  const { settings } = useSettings();
  const meta = useQuery<Meta>({
    queryKey: ["/api/_meta"],
    refetchInterval: 30_000,
  });
  const health = useQuery<Health>({
    queryKey: ["/proxy/health"],
    refetchInterval: 30_000,
  });

  const probing = meta.isLoading || health.isLoading;
  const ok = meta.data?.proxy === "ok" && (health.data?.status ?? "").toLowerCase() === "ok";
  const upstreamShown = settings.apiBaseUrl || meta.data?.upstream_default || "—";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs",
        probing && "border-border bg-muted/40 text-muted-foreground",
        !probing && ok && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        !probing && !ok && "border-destructive/40 bg-destructive/10 text-destructive",
      )}
      data-testid="badge-upstream"
      title={upstreamShown}
    >
      {probing ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : ok ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <AlertCircle className="h-3 w-3" />
      )}
      <span className="font-mono truncate max-w-[20ch]">
        {probing ? "probing…" : ok ? "upstream live" : "upstream down"}
      </span>
    </div>
  );
}
