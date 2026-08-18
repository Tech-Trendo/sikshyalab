import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type BlogSectionDraft = {
  id?: string;
  title: string;
  description: string;
};

export function emptyBlogSection(): BlogSectionDraft {
  return { title: "", description: "" };
}

export function BlogSectionsEditor({
  sections,
  onChange,
  disabled,
}: {
  sections: BlogSectionDraft[];
  onChange: (next: BlogSectionDraft[]) => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<BlogSectionDraft>) => {
    onChange(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= sections.length) return;
    const copy = [...sections];
    const [row] = copy.splice(index, 1);
    copy.splice(next, 0, row);
    onChange(copy);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Sections</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([...sections, emptyBlogSection()])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Section
        </Button>
      </div>
      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sections yet. Add at least one with a description.</p>
      ) : (
        sections.map((section, i) => (
          <div key={section.id || `new-${i}`} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground">Section {i + 1}</p>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  disabled={disabled || i === 0}
                  aria-label="Move section up"
                  onClick={() => move(i, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  disabled={disabled || i === sections.length - 1}
                  aria-label="Move section down"
                  onClick={() => move(i, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  disabled={disabled || sections.length <= 1}
                  aria-label="Delete section"
                  onClick={() => onChange(sections.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor={`section-title-${i}`}>Title (optional)</Label>
              <Input
                id={`section-title-${i}`}
                className="mt-1.5"
                value={section.title}
                disabled={disabled}
                placeholder="Optional heading for this section"
                onChange={(e) => update(i, { title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor={`section-desc-${i}`}>Description</Label>
              <Textarea
                id={`section-desc-${i}`}
                className="mt-1.5 min-h-[120px]"
                rows={5}
                required
                value={section.description}
                disabled={disabled}
                placeholder="Section body (required)"
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
