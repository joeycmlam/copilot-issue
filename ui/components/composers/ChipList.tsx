import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Lightweight chip-style list editor for free-form strings (labels, assignees).
 */
export function ChipList({
  values,
  onChange,
  placeholder,
  testId,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  testId: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
  };
  const remove = (v: string) => onChange(values.filter((x) => x !== v));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          data-testid={`${testId}-input`}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={add}
          data-testid={`${testId}-add`}
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => remove(v)}
              className="pill hover-elevate group"
              data-testid={`${testId}-chip-${v}`}
              title="Click to remove"
            >
              <span>{v}</span>
              <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
