import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  GitBranch,
  Users,
  Settings as SettingsIcon,
  Activity,
  ExternalLink,
  Wand2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { useSettings } from "@/lib/settings";

type Meta = { proxy: string; upstream_default: string; version: string };
type Health = { status: string };

function StatRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

const QUICK_ACTIONS = [
  {
    href: "/create",
    title: "Create & assign",
    description:
      "Open a new issue, attach skills/tools/knowledge, and hand it to the Copilot agent in one call.",
    icon: Sparkles,
    testId: "card-action-create",
  },
  {
    href: "/assign",
    title: "Assign existing",
    description:
      "Hand an open issue to Copilot. Pick a custom agent and set the model.",
    icon: GitBranch,
    testId: "card-action-assign",
  },
  {
    href: "/agents",
    title: "Browse agents",
    description:
      "List repo, org, and enterprise agents that Copilot will resolve by name.",
    icon: Users,
    testId: "card-action-agents",
  },
  {
    href: "/settings",
    title: "Settings",
    description:
      "Configure the upstream API base, your PAT override, and default owner/repo/branch.",
    icon: SettingsIcon,
    testId: "card-action-settings",
  },
];

export default function Dashboard() {
  const { settings } = useSettings();
  const meta = useQuery<Meta>({ queryKey: ["/api/_meta"] });
  const health = useQuery<Health>({ queryKey: ["/proxy/health"] });

  const apiOk = meta.data?.proxy === "ok";
  const upstreamOk = (health.data?.status ?? "").toLowerCase() === "ok";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Console"
        description="A thin façade over the GitHub Copilot coding agent — compose issues, hand them off, browse the agent registry."
        actions={
          <Button asChild data-testid="button-quick-create">
            <Link href="/create">
              <Wand2 className="h-4 w-4 mr-1.5" />
              New issue
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <Card data-testid="card-status-bff">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proxy (BFF)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant={apiOk ? "default" : "destructive"}
                data-testid="badge-bff-status"
              >
                {meta.isLoading ? "probing" : apiOk ? "healthy" : "down"}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
                v{meta.data?.version ?? "—"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Forwards <code className="font-mono">/api/proxy/*</code> to the upstream FastAPI service.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-status-upstream">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upstream API</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant={upstreamOk ? "default" : "destructive"}
                data-testid="badge-upstream-status"
              >
                {health.isLoading ? "probing" : upstreamOk ? "healthy" : "unreachable"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate" title={settings.apiBaseUrl || meta.data?.upstream_default || ""}>
              {settings.apiBaseUrl || meta.data?.upstream_default || "—"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-status-defaults">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Defaults</CardTitle>
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1.5">
            <StatRow
              label="Owner / repo"
              value={
                settings.defaultOwner && settings.defaultRepo
                  ? `${settings.defaultOwner}/${settings.defaultRepo}`
                  : "—"
              }
              testId="text-default-owner-repo"
            />
            <StatRow
              label="Base branch"
              value={settings.defaultBaseBranch || "main"}
              testId="text-default-branch"
            />
            <StatRow
              label="Enterprise"
              value={settings.defaultEnterprise || "—"}
              testId="text-default-enterprise"
            />
            <StatRow
              label="PAT override"
              value={settings.pat ? "set" : "—"}
              testId="text-pat-state"
            />
          </CardContent>
        </Card>
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Workflows
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} data-testid={a.testId}>
            <Card className="h-full hover-elevate cursor-pointer">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <div className="rounded-md bg-accent/60 p-2 text-accent-foreground">
                  <a.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{a.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1.5">{a.description}</p>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-8 mb-3">
        Architecture map
      </h2>
      <Card>
        <CardContent className="pt-6">
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span>Human entry point</span>
              <Badge variant="secondary">this UI + API</Badge>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Supervisor / orchestrator</span>
              <Badge variant="outline">GitHub Issue + Copilot</Badge>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Role agents</span>
              <Badge variant="outline">.agent.md profiles</Badge>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Skill registry</span>
              <Badge variant="secondary">named refs</Badge>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Tool gateway</span>
              <Badge variant="outline">MCP + builtins</Badge>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Firm knowledge / RAG</span>
              <Badge variant="secondary">knowledge_refs</Badge>
            </li>
          </ul>
          <div className="mt-4 text-xs text-muted-foreground">
            <a
              className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
              href="https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-custom-agents"
              target="_blank"
              rel="noreferrer noopener"
            >
              About custom agents <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
