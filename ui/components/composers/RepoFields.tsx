import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings";

export function RepoFields({
  owner,
  repo,
  onChange,
}: {
  owner: string;
  repo: string;
  onChange: (next: { owner: string; repo: string }) => void;
}) {
  const { settings } = useSettings();
  const useDefaults = () =>
    onChange({
      owner: settings.defaultOwner || owner,
      repo: settings.defaultRepo || repo,
    });
  const hasDefaults = Boolean(settings.defaultOwner && settings.defaultRepo);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-start">
      <div className="space-y-1.5">
        <Label htmlFor="field-owner">Owner / org</Label>
        <Input
          id="field-owner"
          value={owner}
          onChange={(e) => {
            // Sanitize input: extract only the username/org from a GitHub URL or similar input
            let value = e.target.value.trim();
            // Remove protocol and domain if present
            value = value.replace(/^https?:\/\/(www\.)?github.com\//, "");
            // Remove trailing slash if present
            value = value.replace(/\/$/, "");
            // Only take the first path segment (in case user pastes a repo URL)
            value = value.split("/")[0];
            onChange({ owner: value, repo });
          }}
          placeholder="e.g. acme-corp or github username/org"
          className="font-mono"
          data-testid="input-owner"
        />
        <div className="text-xs text-muted-foreground mt-1">
          Enter only the GitHub username or org (not a full URL).
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="field-repo">Repository</Label>
        <Input
          id="field-repo"
          value={repo}
          onChange={(e) => onChange({ owner, repo: e.target.value })}
          placeholder="payments-svc"
          className="font-mono"
          data-testid="input-repo"
        />
      </div>
      {hasDefaults && (
        <Button
          type="button"
          variant="outline"
          onClick={useDefaults}
          data-testid="button-use-defaults"
        >
          Use defaults
        </Button>
      )}
    </div>
  );
}
