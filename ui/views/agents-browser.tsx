import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Search, ChevronDown, ChevronUp, Eye } from "lucide-react";

import { useSettings } from "@/lib/settings";
import { PageHeader } from "@/components/layout/PageHeader";
import { RepoFields } from "@/components/composers/RepoFields";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";

// Mirrors CustomAgent from the FastAPI service
type AgentSummary = {
  name: string;
  scope: "repo" | "org" | "enterprise" | "service";
  source_repo: string;
  path: string;
  description?: string | null;
  tools?: string[];
  handoffs?: string[];
  target?: "vscode" | "github-copilot" | "any";
  allowed_teams?: string[];
};

// API returns { scope, agents, resolution_order }
type AgentListResponse = {
  scope: string;
  agents: AgentSummary[];
  resolution_order?: string[];
};

function normalize(data: AgentListResponse | undefined): AgentSummary[] {
  if (!data) return [];
  return data.agents ?? [];
}

function scopeColor(scope: AgentSummary["scope"]) {
  return scope === "repo"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : scope === "org"
      ? "border-primary/40 bg-accent text-accent-foreground"
      : scope === "service"
        ? "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400"
        : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400";
}

function AgentCard({ agent, onViewContext }: { agent: AgentSummary; onViewContext: (a: AgentSummary) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="hover-elevate" data-testid={`card-agent-${agent.name}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="font-mono text-sm truncate">{agent.name}</CardTitle>
          <div className="text-[11px] text-muted-foreground font-mono truncate" title={agent.path}>
            {agent.source_repo}/{agent.path}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="View context"
            onClick={() => onViewContext(agent)}
            data-testid={`button-context-${agent.name}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Badge variant="outline" className={`${scopeColor(agent.scope)} font-mono text-[11px]`}>
            {agent.scope}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {agent.description && (
          <p className="text-sm text-muted-foreground">{agent.description}</p>
        )}
        {agent.tools && agent.tools.length > 0 && (
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Tools</div>
            <div className="flex flex-wrap gap-1.5">
              {agent.tools.map((t) => (
                <span key={t} className="pill text-[11px]">{t}</span>
              ))}
            </div>
          </div>
        )}
        {agent.allowed_teams && agent.allowed_teams.length > 0 && (
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Restricted to</div>
            <div className="flex flex-wrap gap-1.5">
              {agent.allowed_teams.map((t) => (
                <span key={t} className="pill text-[11px]">{t}</span>
              ))}
            </div>
          </div>
        )}
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 gap-1 text-[11px] text-muted-foreground -ml-2">
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {open ? "Less" : "More context"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-1">
            <Separator />
            {agent.handoffs && agent.handoffs.length > 0 && (
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Handoffs</div>
                <div className="flex flex-wrap gap-1.5">
                  {agent.handoffs.map((h) => (
                    <span key={h} className="pill text-[11px]">{h}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-muted-foreground">Target: </span>
                <span className="font-mono">{agent.target ?? "any"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Scope: </span>
                <span className="font-mono">{agent.scope}</span>
              </div>
            </div>
            <div className="text-[11px]">
              <span className="text-muted-foreground">Source: </span>
              <span className="font-mono break-all">{agent.source_repo}</span>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function AgentList({
  agents,
  loading,
  error,
  filter,
  emptyHint,
  onViewContext,
}: {
  agents: AgentSummary[];
  loading: boolean;
  error: Error | null;
  filter: string;
  emptyHint: string;
  onViewContext: (a: AgentSummary) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6" data-testid="state-loading">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading agents…
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-sm text-destructive p-6 font-mono whitespace-pre-wrap" data-testid="state-error">
        {error.message}
      </div>
    );
  }
  const f = filter.trim().toLowerCase();
  const filtered = f
    ? agents.filter(
        (a) =>
          a.name.toLowerCase().includes(f) ||
          (a.description ?? "").toLowerCase().includes(f) ||
          (a.tools ?? []).some((t) => t.toLowerCase().includes(f)) ||
          (a.handoffs ?? []).some((h) => h.toLowerCase().includes(f)),
      )
    : agents;

  if (filtered.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-6" data-testid="state-empty">
        {agents.length === 0 ? emptyHint : "No agents match that filter."}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="grid-agents">
      {filtered.map((a) => (
        <AgentCard key={`${a.scope}-${a.name}`} agent={a} onViewContext={onViewContext} />
      ))}
    </div>
  );
}

type AgentBodyResponse = {
  name: string;
  scope: string;
  body: string;
};

function AgentContextSheet({
  agent,
  onClose,
}: {
  agent: AgentSummary | null;
  onClose: () => void;
}) {
  const bodyQ = useQuery<AgentBodyResponse>({
    queryKey: ["/proxy/agents/content", agent?.scope, agent?.source_repo, agent?.path],
    enabled: agent != null,
    queryFn: async () => {
      const params = new URLSearchParams({
        scope: agent!.scope,
        source_repo: agent!.source_repo,
        path: agent!.path,
      });
      const res = await fetch(`/api/proxy/agents/content?${params}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  return (
    <Sheet open={agent != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SheetTitle className="font-mono text-sm">{agent?.name}</SheetTitle>
            {agent && (
              <Badge variant="outline" className={`${scopeColor(agent.scope)} font-mono text-[11px]`}>
                {agent.scope}
              </Badge>
            )}
          </div>
          {agent && (
            <p className="text-[11px] text-muted-foreground font-mono break-all mt-0.5">
              {agent.source_repo}/{agent.path}
            </p>
          )}
        </SheetHeader>
        <div className="flex-1 min-h-0">
          {bodyQ.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {bodyQ.error && (
            <div className="text-sm text-destructive p-6 font-mono whitespace-pre-wrap">
              {(bodyQ.error as Error).message}
            </div>
          )}
          {bodyQ.data && (
            <ScrollArea className="h-full">
              <pre className="text-xs font-mono p-6 whitespace-pre-wrap break-words leading-relaxed">
                {bodyQ.data.body}
              </pre>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AgentsBrowser() {
  const { settings } = useSettings();
  const qc = useQueryClient();
  const [owner, setOwner] = useState(settings.defaultOwner);
  const [repo, setRepo] = useState(settings.defaultRepo);
  const [enterprise, setEnterprise] = useState(settings.defaultEnterprise);
  const [filter, setFilter] = useState("");
  const [teams, setTeams] = useState("");
  const [contextAgent, setContextAgent] = useState<AgentSummary | null>(null);

  const repoQ = useQuery<AgentListResponse>({
    queryKey: ["/proxy/agents/repo", owner, repo],
    enabled: Boolean(owner && repo),
  });
  const orgQ = useQuery<AgentListResponse>({
    queryKey: ["/proxy/agents/org", owner],
    enabled: Boolean(owner),
  });
  const entQ = useQuery<AgentListResponse>({
    queryKey: ["/proxy/agents/enterprise", enterprise],
    enabled: Boolean(enterprise),
  });
  const svcQ = useQuery<AgentListResponse>({
    queryKey: ["/proxy/agents/service", teams],
    queryFn: async () => {
      const url = teams.trim()
        ? `/api/proxy/agents/service?teams=${encodeURIComponent(teams.trim())}`
        : `/api/proxy/agents/service`;
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
  const allQ = useQuery<AgentListResponse>({
    queryKey: ["/proxy/agents", owner, repo, "all"],
    enabled: Boolean(owner && repo),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/proxy/agents/repo"] });
    qc.invalidateQueries({ queryKey: ["/proxy/agents/org"] });
    qc.invalidateQueries({ queryKey: ["/proxy/agents/enterprise"] });
    qc.invalidateQueries({ queryKey: ["/proxy/agents/service"] });
    qc.invalidateQueries({ queryKey: ["/proxy/agents"] });
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Agents"
        description="Browse .agent.md profiles: GitHub-hosted (repo → org → enterprise) and service-level agents bundled with this API."
        actions={
          <Button variant="outline" onClick={refresh} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <RepoFields owner={owner} repo={repo} onChange={(n) => { setOwner(n.owner); setRepo(n.repo); }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="field-enterprise">Enterprise owner (optional)</Label>
              <Input
                id="field-enterprise"
                value={enterprise}
                onChange={(e) => setEnterprise(e.target.value)}
                placeholder="acme-enterprise"
                className="font-mono"
                data-testid="input-enterprise"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-teams">Your teams (optional)</Label>
              <Input
                id="field-teams"
                value={teams}
                onChange={(e) => setTeams(e.target.value)}
                placeholder="platform, devops"
                className="font-mono"
                data-testid="input-teams"
              />
              <p className="text-[11px] text-muted-foreground">Comma-separated team slugs — unlocks restricted service agents.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 relative">
        <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="field-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="search by name, description, tool…"
          className="pl-8"
          data-testid="input-filter"
        />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            All <Badge variant="secondary" className="ml-2 font-mono text-[10px]">{normalize(allQ.data).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="repo" data-testid="tab-repo">
            Repo <Badge variant="secondary" className="ml-2 font-mono text-[10px]">{normalize(repoQ.data).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="org" data-testid="tab-org">
            Org <Badge variant="secondary" className="ml-2 font-mono text-[10px]">{normalize(orgQ.data).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="enterprise" data-testid="tab-enterprise">
            Enterprise <Badge variant="secondary" className="ml-2 font-mono text-[10px]">{normalize(entQ.data).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="service" data-testid="tab-service">
            Service <Badge variant="secondary" className="ml-2 font-mono text-[10px]">{normalize(svcQ.data).length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="pt-4">
          <AgentList
            agents={normalize(allQ.data)}
            loading={allQ.isLoading && Boolean(owner && repo)}
            error={(allQ.error as Error) ?? null}
            filter={filter}
            emptyHint={owner && repo ? "No agents resolved for this repo." : "Set owner and repo above to load agents."}
            onViewContext={setContextAgent}
          />
        </TabsContent>
        <TabsContent value="repo" className="pt-4">
          <AgentList
            agents={normalize(repoQ.data)}
            loading={repoQ.isLoading && Boolean(owner && repo)}
            error={(repoQ.error as Error) ?? null}
            filter={filter}
            emptyHint={owner && repo ? "No repo-level agents found in .github/agents/." : "Set owner and repo to load."}
            onViewContext={setContextAgent}
          />
        </TabsContent>
        <TabsContent value="org" className="pt-4">
          <AgentList
            agents={normalize(orgQ.data)}
            loading={orgQ.isLoading && Boolean(owner)}
            error={(orgQ.error as Error) ?? null}
            filter={filter}
            emptyHint={owner ? "No org-level agents found in .github-private/agents/." : "Set an owner to load."}
            onViewContext={setContextAgent}
          />
        </TabsContent>
        <TabsContent value="enterprise" className="pt-4">
          <AgentList
            agents={normalize(entQ.data)}
            loading={entQ.isLoading && Boolean(enterprise)}
            error={(entQ.error as Error) ?? null}
            filter={filter}
            emptyHint="Set an enterprise owner to load enterprise-level agents."
            onViewContext={setContextAgent}
          />
        </TabsContent>
        <TabsContent value="service" className="pt-4">
          <AgentList
            agents={normalize(svcQ.data)}
            loading={svcQ.isLoading}
            error={(svcQ.error as Error) ?? null}
            filter={filter}
            emptyHint="No service-level agents found. Add .agent.md files to api/agents/."
            onViewContext={setContextAgent}
          />
        </TabsContent>
      </Tabs>

      <AgentContextSheet agent={contextAgent} onClose={() => setContextAgent(null)} />
    </div>
  );
}
