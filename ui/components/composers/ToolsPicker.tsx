import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TOOLS, TOOL_TYPES, type ToolType } from "@/lib/registry";
import type { ToolRef } from "@shared/schema";

export function ToolsPicker({
  value,
  onChange,
}: {
  value: ToolRef[];
  onChange: (next: ToolRef[]) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ToolType>("mcp");

  const add = (n: string, t: ToolType) => {
    const trimmed = n.trim();
    if (!trimmed) return;
    if (value.some((x) => x.name === trimmed)) return;
    onChange([...value, { name: trimmed, type: t }]);
  };

  const addManual = () => {
    add(name, type);
    setName("");
  };

  const remove = (n: string) => onChange(value.filter((x) => x.name !== n));

  const known = new Set(value.map((x) => x.name));
  const suggestions = TOOLS.filter((t) => !known.has(t.name));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto_auto] gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="tool name (e.g. github)"
          data-testid="input-tool-name"
        />
        <Select value={type} onValueChange={(v) => setType(v as ToolType)}>
          <SelectTrigger data-testid="select-tool-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOOL_TYPES.map((t) => (
              <SelectItem key={t} value={t} data-testid={`option-tool-type-${t}`}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" onClick={addManual} variant="secondary" data-testid="button-tool-add">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" data-testid="button-tool-registry">
              Catalogue
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[420px] p-0">
            <div className="p-3 border-b border-border">
              <div className="text-sm font-semibold">Tool catalogue</div>
              <div className="text-xs text-muted-foreground">
                Common firm tools — agents bind these via MCP / built-ins.
              </div>
            </div>
            <div className="max-h-[280px] overflow-y-auto p-1.5">
              {suggestions.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">
                  All catalogue tools already added.
                </div>
              ) : (
                suggestions.map((t) => (
                  <button
                    type="button"
                    key={t.name}
                    onClick={() => add(t.name, t.type)}
                    className="w-full text-left rounded-md px-2.5 py-2 hover-elevate flex items-center justify-between gap-3"
                    data-testid={`button-tool-pick-${t.name}`}
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.hint}</div>
                    </div>
                    <Badge variant="secondary" className="font-mono text-[11px] shrink-0">
                      {t.type}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <button
              type="button"
              key={t.name}
              onClick={() => remove(t.name)}
              className="pill hover-elevate"
              data-testid={`chip-tool-${t.name}`}
              title="Click to remove"
            >
              <span>{t.name}</span>
              <span className="opacity-60">·{t.type}</span>
              <X className="h-3 w-3 opacity-60" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
