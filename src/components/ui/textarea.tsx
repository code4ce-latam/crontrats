import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => {
    return (
      <textarea
        rows={rows}
        className={cn(
          "flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-offset-background placeholder:text-zinc-400 focus-visible:border-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";


