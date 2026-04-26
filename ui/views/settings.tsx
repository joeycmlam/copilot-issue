import { useState } from "react";
import { Eye, EyeOff, RotateCcw, Save } from "lucide-react";

import { useSettings } from "@/lib/settings";
import { useToast } from "@/hooks/use-toast";

import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Settings } from "@shared/schema";

export default function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Settings>(settings);
  const [showPat, setShowPat] = useState(false);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    update(draft);
    toast({ title: "Settings saved", description: "Stored in this session only — not persisted to disk." });
  };

  const dirty =
    draft.apiBaseUrl !== settings.apiBaseUrl ||
    draft.pat !== settings.pat ||
    draft.defaultOwner !== settings.defaultOwner ||
    draft.defaultRepo !== settings.defaultRepo ||
    draft.defaultBaseBranch !== settings.defaultBaseBranch ||
    draft.defaultEnterprise !== settings.defaultEnterprise;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        title="Settings"
        description="Configure how this UI talks to the upstream Copilot Issue Assignment API. Values live in this session only — nothing is written to localStorage or disk."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                reset();
                setDraft({
                  apiBaseUrl: "",
                  pat: "",
                  defaultOwner: "",
                  defaultRepo: "",
                  defaultBaseBranch: "main",
                  defaultEnterprise: "",
                });
                toast({ title: "Settings reset" });
              }}
              data-testid="button-reset-all"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
            </Button>
            <Button onClick={save} disabled={!dirty} data-testid="button-save">
              <Save className="h-4 w-4 mr-1.5" /> Save
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="field-api-base">Upstream API base URL</Label>
            <Input
              id="field-api-base"
              value={draft.apiBaseUrl}
              onChange={(e) => set("apiBaseUrl", e.target.value)}
              placeholder="https://copilot-api.firm.internal"
              className="font-mono"
              data-testid="input-api-base-url"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the same-origin proxy bundled with this UI (recommended for local dev).
              When set, requests still go through the proxy but with this base forwarded as <code className="font-mono">X-Upstream-Base</code>.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="field-pat">PAT override</Label>
            <div className="flex gap-2">
              <Input
                id="field-pat"
                type={showPat ? "text" : "password"}
                value={draft.pat}
                onChange={(e) => set("pat", e.target.value)}
                placeholder="ghp_…"
                className="font-mono"
                data-testid="input-pat"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowPat((s) => !s)}
                aria-label={showPat ? "Hide PAT" : "Show PAT"}
                data-testid="button-pat-toggle"
              >
                {showPat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Optional. If set, the proxy forwards it as <code className="font-mono">Authorization: Bearer …</code>,
              overriding the upstream service's own token. Useful when testing your access to a shared deployment.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="field-default-owner">Default owner / org</Label>
              <Input
                id="field-default-owner"
                value={draft.defaultOwner}
                onChange={(e) => set("defaultOwner", e.target.value)}
                placeholder="acme-corp"
                className="font-mono"
                data-testid="input-default-owner"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-default-repo">Default repository</Label>
              <Input
                id="field-default-repo"
                value={draft.defaultRepo}
                onChange={(e) => set("defaultRepo", e.target.value)}
                placeholder="payments-svc"
                className="font-mono"
                data-testid="input-default-repo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-default-branch">Default base branch</Label>
              <Input
                id="field-default-branch"
                value={draft.defaultBaseBranch}
                onChange={(e) => set("defaultBaseBranch", e.target.value)}
                placeholder="main"
                className="font-mono"
                data-testid="input-default-branch"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-default-enterprise">Default enterprise owner</Label>
              <Input
                id="field-default-enterprise"
                value={draft.defaultEnterprise}
                onChange={(e) => set("defaultEnterprise", e.target.value)}
                placeholder="acme-enterprise"
                className="font-mono"
                data-testid="input-default-enterprise"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            These values pre-fill the corresponding fields on the Create, Assign, and Agents pages.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
