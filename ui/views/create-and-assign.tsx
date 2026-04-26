import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { useSettings } from "@/lib/settings";
import { useToast } from "@/hooks/use-toast";

import { PageHeader } from "@/components/layout/PageHeader";
import { RepoFields } from "@/components/composers/RepoFields";
import { ChipList } from "@/components/composers/ChipList";
import { SkillsPicker } from "@/components/composers/SkillsPicker";
import { ToolsPicker } from "@/components/composers/ToolsPicker";
import { KnowledgePicker } from "@/components/composers/KnowledgePicker";
import { AgentBlock } from "@/components/composers/AgentBlock";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import type {
  CreateAndAssignInput,
  SkillRef,
  ToolRef,
  KnowledgeRef,
  AgentAssignment,
} from "@shared/schema";

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

export default function CreateAndAssign() {
  const { settings } = useSettings();
  const { toast } = useToast();

  const [owner, setOwner] = useState(settings.defaultOwner);
  const [repo, setRepo] = useState(settings.defaultRepo);

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [skills, setSkills] = useState<SkillRef[]>([]);
  const [tools, setTools] = useState<ToolRef[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeRef[]>([]);
  const [agent, setAgent] = useState<AgentAssignment>({
    ...EMPTY_AGENT,
    base_branch: settings.defaultBaseBranch || "main",
  });

  const [created, setCreated] = useState<CreatedIssue | null>(null);

  const buildPayload = (): CreateAndAssignInput => ({
    title: title.trim(),
    prompt: prompt.trim(),
    labels,
    assignees,
    skills,
    tools,
    knowledge_refs: knowledge,
    agent: {
      ...agent,
      target_repo: agent.target_repo?.trim() || undefined,
      base_branch: agent.base_branch?.trim() || undefined,
    },
  });

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
        title: "Issue created and handed off",
        description: `#${data.number ?? "—"} · ${data.title ?? title}`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Submission failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const reset = () => {
    setTitle("");
    setPrompt("");
    setLabels([]);
    setAssignees([]);
    setSkills([]);
    setTools([]);
    setKnowledge([]);
    setAgent({ ...EMPTY_AGENT, base_branch: settings.defaultBaseBranch || "main" });
    setCreated(null);
  };

  const previewPayload = buildPayload();
  const valid = Boolean(owner && repo && title.trim() && prompt.trim());

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Create & assign"
        description="Compose an issue, attach skills/tools/knowledge, and forward it to the Copilot coding agent in one request."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={reset}
              data-testid="button-reset"
            >
              Reset
            </Button>
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
              Create & assign
            </Button>
          </div>
        }
      />

      {created && (
        <Card className="mb-6 border-emerald-500/30 bg-emerald-500/5" data-testid="card-result-success">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  Issue #{created.number ?? "—"} created and assigned
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {created.html_url ?? "—"}
                </div>
              </div>
            </div>
            {created.html_url && (
              <Button asChild variant="outline" size="sm" data-testid="link-view-issue">
                <a href={created.html_url} target="_blank" rel="noreferrer noopener">
                  Open in GitHub <ExternalLink className="h-3 w-3 ml-1" />
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
            <div className="text-sm">
              <div className="font-medium">Submission failed</div>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                {(submit.error as Error)?.message}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RepoFields owner={owner} repo={repo} onChange={(n) => { setOwner(n.owner); setRepo(n.repo); }} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="field-title">Title</Label>
                <Input
                  id="field-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add idempotency keys to /v1/payments"
                  data-testid="input-title"
                  maxLength={256}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="field-prompt">
                  Prompt <span className="text-muted-foreground font-normal">— user story, AC, context</span>
                </Label>
                <Textarea
                  id="field-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={8}
                  placeholder={"As a payments client\nI want idempotency keys on POST /v1/payments\nSo that retries don't double-charge.\n\nAcceptance criteria:\n- Idempotency-Key header is required and 36 chars\n- Same key + same body within 24h returns the original response\n- Same key + different body returns 409\n"}
                  className="font-mono text-xs"
                  data-testid="input-prompt"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Labels</Label>
                  <ChipList values={labels} onChange={setLabels} placeholder="enhancement" testId="labels" />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Extra assignees <span className="text-muted-foreground font-normal">(Copilot is added automatically)</span>
                  </Label>
                  <ChipList values={assignees} onChange={setAssignees} placeholder="github-handle" testId="assignees" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="skills">
                <TabsList className="grid grid-cols-3 w-full sm:w-auto">
                  <TabsTrigger value="skills" data-testid="tab-skills">
                    Skills <Badge variant="secondary" className="ml-2 font-mono text-[10px]">{skills.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="tools" data-testid="tab-tools">
                    Tools <Badge variant="secondary" className="ml-2 font-mono text-[10px]">{tools.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="knowledge" data-testid="tab-knowledge">
                    Knowledge <Badge variant="secondary" className="ml-2 font-mono text-[10px]">{knowledge.length}</Badge>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="skills" className="pt-4">
                  <SkillsPicker value={skills} onChange={setSkills} />
                </TabsContent>
                <TabsContent value="tools" className="pt-4">
                  <ToolsPicker value={tools} onChange={setTools} />
                </TabsContent>
                <TabsContent value="knowledge" className="pt-4">
                  <KnowledgePicker value={knowledge} onChange={setKnowledge} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <AgentBlock value={agent} onChange={setAgent} owner={owner} repo={repo} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Request preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-2 font-mono">
                POST /repos/{owner || "{owner}"}/{repo || "{repo}"}/issues/create-and-assign
              </div>
              <pre
                className="text-[11px] leading-relaxed font-mono bg-muted/50 rounded-md p-3 max-h-[480px] overflow-auto"
                data-testid="text-payload-preview"
              >
                {JSON.stringify(previewPayload, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
