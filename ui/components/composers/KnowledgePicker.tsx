import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KNOWLEDGE_KINDS, type KnowledgeKind } from "@/lib/registry";
import type { KnowledgeRef } from "@shared/schema";

export function KnowledgePicker({
  value,
  onChange,
}: {
  value: KnowledgeRef[];
  onChange: (next: KnowledgeRef[]) => void;
}) {
  const [val, setVal] = useState("");
  const [kind, setKind] = useState<KnowledgeKind>("repo_path");

  const add = () => {
    const v = val.trim();
    if (!v) return;
    if (value.some((k) => k.kind === kind && k.value === v)) return;
    onChange([...value, { kind, value: v }]);
    setVal("");
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const placeholder =
    kind === "repo_path"
      ? "docs/adr/0007-idempotency.md"
      : kind === "url"
        ? "https://wiki.firm.com/page"
        : "glossary term";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2">
        <Select value={kind} onValueChange={(v) => setKind(v as KnowledgeKind)}>
          <SelectTrigger data-testid="select-knowledge-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KNOWLEDGE_KINDS.map((k) => (
              <SelectItem key={k} value={k} data-testid={`option-knowledge-kind-${k}`}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          data-testid="input-knowledge-value"
        />
        <Button type="button" onClick={add} variant="secondary" data-testid="button-knowledge-add">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {value.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {value.map((k, i) => (
            <li
              key={`${k.kind}-${k.value}`}
              className="flex items-center justify-between gap-3 px-3 py-2"
              data-testid={`row-knowledge-${i}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="pill shrink-0">{k.kind}</span>
                <span className="font-mono text-xs truncate">{k.value}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                aria-label="Remove knowledge ref"
                data-testid={`button-knowledge-remove-${i}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
