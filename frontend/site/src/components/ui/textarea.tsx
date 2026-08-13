import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, id, name, ...props }, ref) => {
    const uid = React.useId();
    const resolvedId = id ?? (name != null && name !== "" ? String(name) : uid);
    const resolvedName = name ?? (id != null && id !== "" ? String(id) : uid);

    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
        id={resolvedId}
        name={resolvedName}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
