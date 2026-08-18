import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CourseHighlightInput } from "@/hooks/useCourseEditorQueries";

export function HighlightsListEditor({
  title,
  onTitleChange,
  highlights,
  onChange,
  canEdit,
  busy,
}: {
  title: string;
  onTitleChange: (next: string) => void;
  highlights: CourseHighlightInput[];
  onChange: (next: CourseHighlightInput[]) => void;
  canEdit: boolean;
  busy?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="why-title">Section title</Label>
        <Input
          id="why-title"
          className="mt-1.5"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={!canEdit || busy}
          placeholder="Why this course?"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Optional. Leave empty to hide this block on the public page.</p>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Highlights</Label>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onChange([...highlights, { heading: "", description: "" }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add highlight
            </Button>
          ) : null}
        </div>
        {highlights.length === 0 ? (
          <p className="text-sm text-muted-foreground">No highlights yet. Optional — does not block save.</p>
        ) : (
          highlights.map((h, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <Input
                value={h.heading}
                disabled={!canEdit || busy}
                placeholder="Heading"
                onChange={(e) =>
                  onChange(highlights.map((row, j) => (j === i ? { ...row, heading: e.target.value } : row)))
                }
              />
              <Textarea
                value={h.description}
                disabled={!canEdit || busy}
                placeholder="Description"
                rows={2}
                onChange={(e) =>
                  onChange(
                    highlights.map((row, j) => (j === i ? { ...row, description: e.target.value } : row)),
                  )
                }
              />
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => onChange(highlights.filter((_, j) => j !== i))}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
