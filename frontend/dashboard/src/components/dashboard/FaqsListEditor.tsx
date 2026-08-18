import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type FaqDraft = {
  id?: string;
  question: string;
  answer: string;
};

export function FaqsListEditor({
  items,
  onChange,
  canEdit,
  busy,
}: {
  items: FaqDraft[];
  onChange: (next: FaqDraft[]) => void;
  canEdit: boolean;
  busy?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>FAQs</Label>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onChange([...items, { question: "", answer: "" }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add FAQ
          </Button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No FAQs yet. Optional — does not block save.</p>
      ) : (
        items.map((row, i) => (
          <div key={row.id || `faq-${i}`} className="space-y-2 rounded-lg border border-border p-3">
            <Input
              value={row.question}
              disabled={!canEdit || busy}
              placeholder="Question"
              onChange={(e) =>
                onChange(items.map((f, j) => (j === i ? { ...f, question: e.target.value } : f)))
              }
            />
            <Textarea
              value={row.answer}
              disabled={!canEdit || busy}
              placeholder="Answer"
              rows={3}
              onChange={(e) =>
                onChange(items.map((f, j) => (j === i ? { ...f, answer: e.target.value } : f)))
              }
            />
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={busy}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
              </Button>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
