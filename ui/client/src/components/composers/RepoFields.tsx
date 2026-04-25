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
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
      <div className="space-y-1.5">
        <Label htmlFor="field-owner">Owner / org</Label>
        <Input
          id="field-owner"
          value={owner}
          onChange={(e) => onChange({ owner: e.target.value, repo })}
          placeholder="acme-corp"
          className="font-mono"
          data-testid="input-owner"
        />
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
