import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { SKILLS } from "@/lib/registry";
import type { SkillRef } from "@shared/schema";

export function SkillsPicker({
  value,
  onChange,
}: {
  value: SkillRef[];
  onChange: (next: SkillRef[]) => void;
}) {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");

  const add = (n: string, v?: string) => {
    const trimmed = n.trim();
    if (!trimmed) return;
    if (value.some((s) => s.name === trimmed)) return;
    const next: SkillRef = v ? { name: trimmed, version: v } : { name: trimmed };
    onChange([...value, next]);
  };

  const addManual = () => {
    add(name, version || undefined);
    setName("");
    setVersion("");
  };

  const remove = (n: string) => onChange(value.filter((s) => s.name !== n));

  const known = new Set(value.map((s) => s.name));
  const suggestions = SKILLS.filter((s) => !known.has(s.name));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto_auto] gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="skill name (e.g. code-generation)"
          data-testid="input-skill-name"
        />
        <Input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="version (opt.)"
          data-testid="input-skill-version"
        />
        <Button type="button" onClick={addManual} variant="secondary" data-testid="button-skill-add">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" data-testid="button-skill-registry">
              From registry
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[420px] p-0">
            <div className="p-3 border-b border-border">
              <div className="text-sm font-semibold">Skill registry</div>
              <div className="text-xs text-muted-foreground">
                Names match firm-wide registry — pick one or type your own above.
              </div>
            </div>
            <div className="max-h-[280px] overflow-y-auto p-1.5">
              {suggestions.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">
                  All registry skills already added.
                </div>
              ) : (
                suggestions.map((s) => (
                  <button
                    type="button"
                    key={s.name}
                    onClick={() => add(s.name, s.suggestedVersion)}
                    className="w-full text-left rounded-md px-2.5 py-2 hover-elevate flex items-center justify-between gap-3"
                    data-testid={`button-skill-pick-${s.name}`}
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm">{s.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.hint}</div>
                    </div>
                    {s.suggestedVersion && (
                      <Badge variant="secondary" className="font-mono text-[11px] shrink-0">
                        {s.suggestedVersion}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <button
              type="button"
              key={s.name}
              onClick={() => remove(s.name)}
              className="pill pill-primary hover-elevate"
              data-testid={`chip-skill-${s.name}`}
              title="Click to remove"
            >
              <span>{s.name}</span>
              {s.version && <span className="opacity-70">@{s.version}</span>}
              <X className="h-3 w-3 opacity-60" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
