import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, id, name, ...props }, ref) => {
    const uid = React.useId();
    const resolvedId = id ?? (name != null && name !== "" ? String(name) : uid);
    const resolvedName = name ?? (id != null && id !== "" ? String(id) : uid);

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
Input.displayName = "Input";

export { Input };
