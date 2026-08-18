import { cn } from "@/lib/utils";

export type FormTab = {
  id: string;
  label: string;
  error?: boolean;
};

export function FormTabNav({
  tabs,
  value,
  onChange,
}: {
  tabs: FormTab[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              active ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.error ? (
              <span
                className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-destructive"
                aria-label="This tab has validation issues"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
