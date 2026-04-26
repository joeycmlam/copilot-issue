import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { useSettings } from "@/lib/settings";
import { useToast } from "@/hooks/use-toast";

import { PageHeader } from "@/components/layout/PageHeader";
import { RepoFields } from "@/components/composers/RepoFields";
import { AgentBlock } from "@/components/composers/AgentBlock";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { AssignCopilotInput, AgentAssignment } from "@shared/schema";

type AssignResult = {
  number?: number;
  html_url?: string;
  assignees?: string[];
  state?: string;
};

const EMPTY_AGENT: AgentAssignment = {
  custom_instructions: "",
  custom_agent: "",
  model: "",
};

export default function AssignExisting() {
  const { settings } = useSettings();
  const { toast } = useToast();

  const [owner, setOwner] = useState(settings.defaultOwner);
  const [repo, setRepo] = useState(settings.defaultRepo);
  const [issueNumber, setIssueNumber] = useState("");
  const [keepExistingAssignees, setKeepExistingAssignees] = useState(true);
  const [agent, setAgent] = useState<AgentAssignment>({
    ...EMPTY_AGENT,
    base_branch: settings.defaultBaseBranch || "main",
  });
  const [result, setResult] = useState<AssignResult | null>(null);

  const buildPayload = (): AssignCopilotInput => ({
    keep_existing_assignees: keepExistingAssignees,
    agent: {
      ...agent,
      target_repo: agent.target_repo?.trim() || undefined,
      base_branch: agent.base_branch?.trim() || undefined,
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const num = parseInt(issueNumber, 10);
      if (!owner || !repo) throw new Error("Owner and repo are required.");
      if (!Number.isFinite(num) || num <= 0) throw new Error("Issue number must be a positive integer.");
      const url = `/proxy/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${num}/assign-copilot`;
      const res = await apiRequest("POST", url, buildPayload());
      return (await res.json()) as AssignResult;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Issue handed off to Copilot",
        description: `#${data.number ?? issueNumber}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Assignment failed", description: err.message, variant: "destructive" });
    },
  });

  const valid = Boolean(owner && repo && issueNumber.trim());

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="Assign existing"
        description="Hand an open GitHub Issue to the Copilot coding agent. Pick a custom agent, set the model, and forward."
        actions={
          <Button
            onClick={() => submit.mutate()}
            disabled={!valid || submit.isPending}
            data-testid="button-submit"
          >
            {submit.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1.5" />
            )}
            Assign Copilot
          </Button>
        }
      />

      {result && (
        <Card className="mb-6 border-emerald-500/30 bg-emerald-500/5" data-testid="card-result-success">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  Issue #{result.number ?? issueNumber} updated
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  assignees: {(result.assignees ?? []).join(", ") || "—"}
                </div>
              </div>
            </div>
            {result.html_url && (
              <Button asChild variant="outline" size="sm" data-testid="link-view-issue">
                <a href={result.html_url} target="_blank" rel="noreferrer noopener">
                  Open <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {submit.isError && (
        <Card className="mb-6 border-destructive/40 bg-destructive/5" data-testid="card-result-error">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <pre className="font-mono text-xs whitespace-pre-wrap">
              {(submit.error as Error)?.message}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RepoFields owner={owner} repo={repo} onChange={(n) => { setOwner(n.owner); setRepo(n.repo); }} />
            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="field-issue-number">Issue number</Label>
                <Input
                  id="field-issue-number"
                  value={issueNumber}
                  onChange={(e) => setIssueNumber(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="1234"
                  inputMode="numeric"
                  className="font-mono"
                  data-testid="input-issue-number"
                />
              </div>
              <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3" data-testid="row-keep-assignees">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Keep existing assignees</div>
                  <div className="text-xs text-muted-foreground">
                    Adds Copilot alongside current assignees instead of replacing them.
                  </div>
                </div>
                <Switch
                  checked={keepExistingAssignees}
                  onCheckedChange={setKeepExistingAssignees}
                  data-testid="switch-keep-assignees"
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <AgentBlock value={agent} onChange={setAgent} owner={owner} repo={repo} />
      </div>
    </div>
  );
}
