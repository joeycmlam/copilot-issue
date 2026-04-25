import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Search } from "lucide-react";

import { useSettings } from "@/lib/settings";
import { PageHeader } from "@/components/layout/PageHeader";
import { RepoFields } from "@/components/composers/RepoFields";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

type AgentSummary = {
  name: string;
  scope: "repo" | "org" | "enterprise";
  description?: string | null;
  tools?: string[];
  model?: string | null;
  source_path?: string | null;
};

type AgentListResponse = { items: AgentSummary[] } | AgentSummary[];

function normalize(data: AgentListResponse | undefined): AgentSummary[] {
  if (!data) return [];
  return Array.isArray(data) ? data : (data.items ?? []);
}

function scopeColor(scope: AgentSummary["scope"]) {
  return scope === "repo"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : scope === "org"
      ? "border-primary/40 bg-accent text-accent-foreground"
      : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400";
}

function AgentList({
  agents,
  loading,
  error,
  filter,
  emptyHint,
}: {
  agents: AgentSummary[];
  loading: boolean;
  error: Error | null;
  filter: string;
  emptyHint: string;
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
          (a.tools ?? []).some((t) => t.toLowerCase().includes(f)),
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
        <Card key={`${a.scope}-${a.name}`} className="hover-elevate" data-testid={`card-agent-${a.name}`}>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div className="min-w-0 space-y-1">
              <CardTitle className="font-mono text-sm truncate">{a.name}</CardTitle>
              {a.source_path && (
                <div className="text-[11px] text-muted-foreground font-mono truncate" title={a.source_path}>
                  {a.source_path}
                </div>
              )}
            </div>
            <Badge variant="outline" className={`${scopeColor(a.scope)} font-mono text-[11px] shrink-0`}>
              {a.scope}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {a.description && (
              <p className="text-sm text-muted-foreground line-clamp-3">{a.description}</p>
            )}
            {a.tools && a.tools.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {a.tools.slice(0, 8).map((t) => (
                  <span key={t} className="pill text-[11px]">
                    {t}
                  </span>
                ))}
                {a.tools.length > 8 && (
                  <span className="pill text-[11px]">+{a.tools.length - 8}</span>
                )}
              </div>
            )}
            {a.model && (
              <div className="text-[11px] text-muted-foreground font-mono">
                model: <span className="text-foreground">{a.model}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AgentsBrowser() {
  const { settings } = useSettings();
  const qc = useQueryClient();
  const [owner, setOwner] = useState(settings.defaultOwner);
  const [repo, setRepo] = useState(settings.defaultRepo);
  const [enterprise, setEnterprise] = useState(settings.defaultEnterprise);
  const [filter, setFilter] = useState("");

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
  const allQ = useQuery<AgentListResponse>({
    queryKey: ["/proxy/agents", owner, repo, "all"],
    enabled: Boolean(owner && repo),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/proxy/agents/repo"] });
    qc.invalidateQueries({ queryKey: ["/proxy/agents/org"] });
    qc.invalidateQueries({ queryKey: ["/proxy/agents/enterprise"] });
    qc.invalidateQueries({ queryKey: ["/proxy/agents"] });
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Agents"
        description="Browse the .agent.md profiles GitHub will resolve when you reference an agent by name (repo → org → enterprise)."
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
              <Label htmlFor="field-filter">Filter</Label>
              <div className="relative">
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
            </div>
          </div>
        </CardContent>
      </Card>

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
        </TabsList>

        <TabsContent value="all" className="pt-4">
          <AgentList
            agents={normalize(allQ.data)}
            loading={allQ.isLoading && Boolean(owner && repo)}
            error={(allQ.error as Error) ?? null}
            filter={filter}
            emptyHint={owner && repo ? "No agents resolved for this repo." : "Set owner and repo above to load agents."}
          />
        </TabsContent>
        <TabsContent value="repo" className="pt-4">
          <AgentList
            agents={normalize(repoQ.data)}
            loading={repoQ.isLoading && Boolean(owner && repo)}
            error={(repoQ.error as Error) ?? null}
            filter={filter}
            emptyHint={owner && repo ? "No repo-level agents found in .github/agents/." : "Set owner and repo to load."}
          />
        </TabsContent>
        <TabsContent value="org" className="pt-4">
          <AgentList
            agents={normalize(orgQ.data)}
            loading={orgQ.isLoading && Boolean(owner)}
            error={(orgQ.error as Error) ?? null}
            filter={filter}
            emptyHint={owner ? "No org-level agents found in .github-private/agents/." : "Set an owner to load."}
          />
        </TabsContent>
        <TabsContent value="enterprise" className="pt-4">
          <AgentList
            agents={normalize(entQ.data)}
            loading={entQ.isLoading && Boolean(enterprise)}
            error={(entQ.error as Error) ?? null}
            filter={filter}
            emptyHint="Set an enterprise owner to load enterprise-level agents."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
