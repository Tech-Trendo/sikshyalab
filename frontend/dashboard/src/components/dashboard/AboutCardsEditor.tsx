import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AboutCardItem } from "@/lib/about-cms";

export function AboutCardsEditor({
  label,
  hint,
  items,
  onChange,
  showIcon = true,
  disabled,
}: {
  label: string;
  hint?: string;
  items: AboutCardItem[];
  onChange: (next: AboutCardItem[]) => void;
  showIcon?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>{label}</Label>
          {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([...items, { title: "", description: "", icon: "" }])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries yet. Add as many as you need.</p>
      ) : (
        items.map((item, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <Input
              value={item.title}
              disabled={disabled}
              placeholder="Title"
              onChange={(e) =>
                onChange(items.map((row, j) => (j === i ? { ...row, title: e.target.value } : row)))
              }
            />
            <Textarea
              value={item.description}
              disabled={disabled}
              placeholder="Description"
              rows={3}
              onChange={(e) =>
                onChange(
                  items.map((row, j) => (j === i ? { ...row, description: e.target.value } : row)),
                )
              }
            />
            {showIcon ? (
              <Input
                value={item.icon || ""}
                disabled={disabled}
                placeholder="Optional icon image URL"
                onChange={(e) =>
                  onChange(items.map((row, j) => (j === i ? { ...row, icon: e.target.value } : row)))
                }
              />
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={disabled}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
