import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SUGGESTED_AGENTS, SUGGESTED_MODELS } from "@/lib/registry";
import type { AgentAssignment } from "@shared/schema";

type AgentSummary = {
  name: string;
  scope: "repo" | "org" | "enterprise";
  description?: string | null;
  tools?: string[];
  model?: string | null;
};

/**
 * AgentBlock — lets the user shape the `agent_assignment` payload that the
 * upstream service forwards to GitHub. Includes the model text input the
 * user explicitly asked for, plus a live picker driven by the all-agents
 * endpoint so the user can pick known agents in the current owner/repo.
 */
export function AgentBlock({
  value,
  onChange,
  owner,
  repo,
  showRepoFields = true,
}: {
  value: AgentAssignment;
  onChange: (next: AgentAssignment) => void;
  owner?: string;
  repo?: string;
  showRepoFields?: boolean;
}) {
  const canFetch = Boolean(owner && repo);
  const allAgents = useQuery<{ items: AgentSummary[] } | AgentSummary[]>({
    queryKey: ["/proxy/agents", owner, repo, "all"],
    enabled: canFetch,
  });

  // Normalise the response — the upstream might shape this either way.
  const agentList: AgentSummary[] = Array.isArray(allAgents.data)
    ? allAgents.data
    : (allAgents.data?.items ?? []);

  // Combine live agents with hard-coded suggestions so the picker is useful
  // before the user has wired credentials.
  const combined = (() => {
    const seen = new Set<string>();
    const out: { name: string; scope?: string; role?: string }[] = [];
    for (const a of agentList) {
      if (seen.has(a.name)) continue;
      seen.add(a.name);
      out.push({ name: a.name, scope: a.scope, role: a.description ?? undefined });
    }
    for (const a of SUGGESTED_AGENTS) {
      if (seen.has(a.name)) continue;
      seen.add(a.name);
      out.push({ name: a.name, role: a.role });
    }
    return out;
  })();

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Agent assignment
        </CardTitle>
        <Badge variant="secondary" className="font-mono text-[11px]">
          copilot-swe-agent[bot]
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {showRepoFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="agent-target-repo">Target repo (override)</Label>
              <Input
                id="agent-target-repo"
                placeholder={owner && repo ? `${owner}/${repo}` : "owner/repo"}
                value={value.target_repo ?? ""}
                onChange={(e) =>
                  onChange({ ...value, target_repo: e.target.value || undefined })
                }
                data-testid="input-agent-target-repo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-base-branch">Base branch</Label>
              <Input
                id="agent-base-branch"
                placeholder="main"
                value={value.base_branch ?? ""}
                onChange={(e) =>
                  onChange({ ...value, base_branch: e.target.value || undefined })
                }
                data-testid="input-agent-base-branch"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="agent-custom-agent">
              Custom agent <span className="text-muted-foreground font-normal">(repo → org → enterprise)</span>
            </Label>
            <Input
              id="agent-custom-agent"
              list="custom-agent-suggestions"
              placeholder="backend-agent"
              value={value.custom_agent}
              onChange={(e) => onChange({ ...value, custom_agent: e.target.value })}
              className="font-mono"
              data-testid="input-agent-custom-agent"
            />
            <datalist id="custom-agent-suggestions">
              {combined.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.scope ? `${a.scope} · ` : ""}{a.role ?? ""}
                </option>
              ))}
            </datalist>
            {canFetch && allAgents.isLoading && (
              <div className="text-[11px] text-muted-foreground">loading agents…</div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agent-model">
              Model <span className="text-muted-foreground font-normal">(LLM identifier)</span>
            </Label>
            <Input
              id="agent-model"
              list="model-suggestions"
              placeholder="claude-sonnet-4.5"
              value={value.model}
              onChange={(e) => onChange({ ...value, model: e.target.value })}
              className="font-mono"
              data-testid="input-agent-model"
            />
            <datalist id="model-suggestions">
              {SUGGESTED_MODELS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-custom-instructions">Custom instructions</Label>
          <Textarea
            id="agent-custom-instructions"
            placeholder="Follow ADR 0007 strictly. Keep PR under 400 LOC. Open a draft if any test fails."
            value={value.custom_instructions}
            onChange={(e) =>
              onChange({ ...value, custom_instructions: e.target.value })
            }
            rows={4}
            className="font-mono text-xs"
            data-testid="input-agent-custom-instructions"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          GitHub resolves <code className="font-mono">custom_agent</code> in the order
          repo → org → enterprise. Leave it blank to use the default Copilot agent.
        </p>
      </CardContent>
    </Card>
  );
}
