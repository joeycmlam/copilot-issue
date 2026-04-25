import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Send,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Bot,
  CircleDot,
  CircleCheck,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { useSettings } from "@/lib/settings";
import { useToast } from "@/hooks/use-toast";

import { PageHeader } from "@/components/layout/PageHeader";
import { RepoFields } from "@/components/composers/RepoFields";
import { ChipList } from "@/components/composers/ChipList";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

import { SUGGESTED_MODELS } from "@/lib/registry";

import type {
  CreateAndAssignInput,
  AgentAssignment,
  IssueListItem,
  AgentListResponse,
  CustomAgent,
} from "@shared/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CreatedIssue = {
  number?: number;
  html_url?: string;
  state?: string;
  title?: string;
};

const EMPTY_AGENT: AgentAssignment = {
  custom_instructions: "",
  custom_agent: "",
  model: "",
};

// ---------------------------------------------------------------------------
// AgentSelector — loads custom agents from API and renders a Select.
// ---------------------------------------------------------------------------

function AgentSelector({
  value,
  onChange,
  owner,
  repo,
}: {
  value: string;
  onChange: (next: string, agent?: CustomAgent) => void;
  owner: string;
  repo: string;
}) {
  const canFetch = Boolean(owner && repo);
  const agents = useQuery<AgentListResponse>({
    queryKey: ["/proxy/agents", owner, repo, "all"],
    enabled: canFetch,
    select: (data) => data,
  });

  const agentList = agents.data?.agents ?? [];

  // Group by scope for a nicer select menu.
  const byScope: Record<string, typeof agentList> = {};
  for (const a of agentList) {
    (byScope[a.scope] ??= []).push(a);
  }
  const scopeOrder = ["repo", "org", "enterprise"] as const;
  const selected = agentList.find((a) => a.name === value);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="agent-select">
        Assign to agent
        {canFetch && agents.isLoading && (
          <span className="ml-2 text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> loading…
          </span>
        )}
      </Label>
      <Select
        value={value || "__default__"}
        onValueChange={(v) => {
          const resolved = v === "__default__" ? "" : v;
          const agent = agentList.find((a) => a.name === resolved);
          onChange(resolved, agent);
        }}
      >
        <SelectTrigger id="agent-select" data-testid="select-agent">
          <SelectValue placeholder="Default Copilot agent" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__default__">
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
              Default Copilot agent
            </div>
          </SelectItem>
          {agentList.length > 0 && <Separator className="my-1" />}
          {scopeOrder.map((scope) => {
            const group = byScope[scope];
            if (!group?.length) return null;
            return (
              <SelectGroup key={scope}>
                <SelectLabel className="capitalize">{scope}</SelectLabel>
                {group.map((a) => (
                  <SelectItem key={`${scope}-${a.name}`} value={a.name}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-sm">{a.name}</span>
                      {a.description && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                          {a.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
          {!canFetch && (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              Set owner/repo to load available agents.
            </div>
          )}
          {canFetch && !agents.isLoading && agentList.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              No custom agents found in this repo.
            </div>
          )}
        </SelectContent>
      </Select>
      {/* Agent context panel — shown when a specific agent is selected */}
      {selected && (
        <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2 text-[11px]">
          {selected.description && (
            <p className="text-muted-foreground">{selected.description}</p>
          )}
          {selected.tools && selected.tools.length > 0 && (
            <div>
              <span className="font-medium text-foreground/70 uppercase tracking-wide">Tools: </span>
              <span className="font-mono text-muted-foreground">{selected.tools.join(", ")}</span>
            </div>
          )}
          {selected.handoffs && selected.handoffs.length > 0 && (
            <div>
              <span className="font-medium text-foreground/70 uppercase tracking-wide">Handoffs: </span>
              <span className="font-mono text-muted-foreground">{selected.handoffs.join(", ")}</span>
            </div>
          )}
          <div className="flex gap-4">
            <div>
              <span className="text-muted-foreground">Scope: </span>
              <span className="font-mono">{selected.scope}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Target: </span>
              <span className="font-mono">{selected.target ?? "any"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// IssueRow — single row in the issue list
// ---------------------------------------------------------------------------

function stateBadge(state: string) {
  if (state === "closed") {
    return (
      <Badge
        variant="outline"
        className="border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400 gap-1 font-mono text-[11px]"
      >
        <CircleCheck className="h-3 w-3" />
        closed
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1 font-mono text-[11px]"
    >
      <CircleDot className="h-3 w-3" />
      open
    </Badge>
  );
}

function IssueRow({ issue }: { issue: IssueListItem }) {
  return (
    <div
      className="flex items-start justify-between gap-3 py-3 px-4 hover:bg-accent/40 transition-colors rounded-md"
      data-testid={`issue-row-${issue.number}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span className="font-mono text-xs text-muted-foreground mt-0.5 shrink-0">
          #{issue.number}
        </span>
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium truncate">{issue.title}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {stateBadge(issue.state)}
            {issue.custom_agent && (
              <Badge variant="secondary" className="font-mono text-[11px] gap-1">
                <Bot className="h-3 w-3" />
                {issue.custom_agent}
              </Badge>
            )}
            {issue.labels.map((lbl) => (
              <Badge key={lbl} variant="outline" className="text-[11px]">
                {lbl}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <a
        href={issue.html_url}
        target="_blank"
        rel="noreferrer noopener"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
        data-testid={`link-issue-${issue.number}`}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Issues page
// ---------------------------------------------------------------------------

export default function Issues() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Shared repo target
  const [owner, setOwner] = useState(settings.defaultOwner);
  const [repo, setRepo] = useState(settings.defaultRepo);

  // Form state
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [customAgent, setCustomAgent] = useState("");
  const [model, setModel] = useState("");
  const [baseBranch, setBaseBranch] = useState(settings.defaultBaseBranch || "main");
  const [customInstructions, setCustomInstructions] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [created, setCreated] = useState<CreatedIssue | null>(null);

  // Issue list state
  const [stateFilter, setStateFilter] = useState<"all" | "open" | "closed">("all");

  // Build the create-and-assign payload
  const buildPayload = (): CreateAndAssignInput => ({
    title: title.trim(),
    prompt: prompt.trim(),
    labels,
    assignees: [],
    skills: [],
    tools: [],
    knowledge_refs: [],
    agent: {
      custom_agent: customAgent,
      custom_instructions: customInstructions.trim(),
      base_branch: baseBranch.trim() || undefined,
      model: model.trim(),
    },
  });

  // Submit mutation
  const submit = useMutation({
    mutationFn: async () => {
      if (!owner || !repo) throw new Error("Owner and repo are required.");
      if (!title.trim()) throw new Error("Title is required.");
      if (!prompt.trim()) throw new Error("Prompt is required.");
      const url = `/proxy/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/create-and-assign`;
      const res = await apiRequest("POST", url, buildPayload());
      return (await res.json()) as CreatedIssue;
    },
    onSuccess: (data) => {
      setCreated(data);
      toast({
        title: "Issue created and assigned",
        description: `#${data.number ?? "—"} · ${data.title ?? title}`,
      });
      // Reset form
      setTitle("");
      setPrompt("");
      setLabels([]);
      setCustomAgent("");
      setModel("");
      setCustomInstructions("");
      // Refresh issue list
      qc.invalidateQueries({ queryKey: ["/proxy/repos", owner, repo, "issues"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Submission failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Issue list query
  const issuesQuery = useQuery<{ items: IssueListItem[] }>({
    queryKey: ["/proxy/repos", owner, repo, "issues", stateFilter],
    enabled: Boolean(owner && repo),
    queryFn: async () => {
      const url = `/api/proxy/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${stateFilter}&per_page=50`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const issues = issuesQuery.data?.items ?? [];
  const valid = Boolean(owner && repo && title.trim() && prompt.trim());

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        title="Issues"
        description="Create a GitHub issue and assign it to the Copilot coding agent with an optional custom agent profile."
        actions={
          <Button
            onClick={() => submit.mutate()}
            disabled={!valid || submit.isPending}
            data-testid="button-submit"
          >
            {submit.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-1.5" />
            )}
            Create & assign
          </Button>
        }
      />

      {/* Success / error banners */}
      {created && (
        <Card
          className="mb-6 border-emerald-500/30 bg-emerald-500/5"
          data-testid="card-result-success"
        >
          <CardContent className="flex items-center justify-between gap-3 pt-5 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  Issue #{created.number ?? "—"} created and assigned to Copilot
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {created.html_url ?? ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {created.html_url && (
                <Button asChild variant="outline" size="sm" data-testid="link-view-issue">
                  <a href={created.html_url} target="_blank" rel="noreferrer noopener">
                    Open <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreated(null)}
                data-testid="button-dismiss-success"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {submit.isError && (
        <Card
          className="mb-6 border-destructive/40 bg-destructive/5"
          data-testid="card-result-error"
        >
          <CardContent className="flex items-start gap-3 pt-5 pb-4">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-medium">Submission failed</div>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                {(submit.error as Error)?.message}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[480px_1fr] gap-6">
        {/* ------------------------------------------------------------------ */}
        {/* Create form                                                         */}
        {/* ------------------------------------------------------------------ */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Target repository</CardTitle>
            </CardHeader>
            <CardContent>
              <RepoFields
                owner={owner}
                repo={repo}
                onChange={(n) => {
                  setOwner(n.owner);
                  setRepo(n.repo);
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Issue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="issue-title">Title</Label>
                <Input
                  id="issue-title"
                  placeholder="Fix the authentication timeout bug"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="issue-prompt">Prompt / description</Label>
                <Textarea
                  id="issue-prompt"
                  placeholder="Describe what you want Copilot to do. Include acceptance criteria, constraints, and any relevant context."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  data-testid="input-prompt"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Labels</Label>
                <ChipList
                  values={labels}
                  onChange={setLabels}
                  placeholder="Add label…"
                  testId="chip-labels"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-primary" />
                Copilot agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AgentSelector
                value={customAgent}
                onChange={(v) => setCustomAgent(v)}
                owner={owner}
                repo={repo}
              />

              <div className="space-y-1.5">
                <Label htmlFor="issue-model">
                  LLM model <span className="text-muted-foreground font-normal">(optional override)</span>
                </Label>
                <Input
                  id="issue-model"
                  list="model-suggestions-issues"
                  placeholder="e.g. claude-sonnet-4.5"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="font-mono"
                  data-testid="input-model"
                />
                <datalist id="model-suggestions-issues">
                  {SUGGESTED_MODELS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs">
                    {advancedOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    Advanced options
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="base-branch">Base branch</Label>
                    <Input
                      id="base-branch"
                      placeholder="main"
                      value={baseBranch}
                      onChange={(e) => setBaseBranch(e.target.value)}
                      className="font-mono"
                      data-testid="input-base-branch"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-instructions">Custom instructions</Label>
                    <Textarea
                      id="custom-instructions"
                      placeholder="Follow ADR-007. Keep the PR under 400 LOC."
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      rows={3}
                      className="font-mono text-xs"
                      data-testid="input-custom-instructions"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <p className="text-[11px] text-muted-foreground">
                GitHub resolves the custom agent in order: repo → org → enterprise. Leave
                blank to use the default Copilot agent.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Issues list                                                          */}
        {/* ------------------------------------------------------------------ */}
        <div className="space-y-4">
          <Card className="flex flex-col min-h-[400px]">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-base">
                Issues assigned to Copilot
                {issues.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({issues.length})
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select
                  value={stateFilter}
                  onValueChange={(v) =>
                    setStateFilter(v as "all" | "open" | "closed")
                  }
                >
                  <SelectTrigger className="h-7 w-[90px] text-xs" data-testid="select-state-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() =>
                    qc.invalidateQueries({
                      queryKey: ["/proxy/repos", owner, repo, "issues"],
                    })
                  }
                  disabled={issuesQuery.isFetching}
                  data-testid="button-refresh-issues"
                  title="Refresh issues"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${issuesQuery.isFetching ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-0">
              {!owner || !repo ? (
                <div
                  className="flex items-center justify-center h-40 text-sm text-muted-foreground"
                  data-testid="state-no-repo"
                >
                  Set owner and repo to load issues.
                </div>
              ) : issuesQuery.isLoading ? (
                <div
                  className="flex items-center justify-center gap-2 h-40 text-sm text-muted-foreground"
                  data-testid="state-loading"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading issues…
                </div>
              ) : issuesQuery.isError ? (
                <div
                  className="p-4 text-sm text-destructive font-mono whitespace-pre-wrap"
                  data-testid="state-error"
                >
                  {(issuesQuery.error as Error)?.message}
                </div>
              ) : issues.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center gap-2 h-40 text-sm text-muted-foreground"
                  data-testid="state-empty"
                >
                  <Bot className="h-8 w-8 opacity-20" />
                  No Copilot-assigned issues found.
                </div>
              ) : (
                <div className="divide-y divide-border px-1 pb-1" data-testid="issues-list">
                  {issues.map((issue) => (
                    <IssueRow key={issue.number} issue={issue} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
