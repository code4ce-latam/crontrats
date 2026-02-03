import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      {children}
    </TooltipContext.Provider>
  );
}

export function TooltipTrigger({
  children,
}: {
  children: React.ReactElement;
}) {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) return children;

  const { setOpen } = ctx;

  return React.cloneElement(children, {
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
  });
}

export function TooltipContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(TooltipContext);
  if (!ctx || !ctx.open) return null;

  return (
    <div
      className={cn(
        "z-50 rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-50 shadow-md",
        "relative -mt-1 translate-y-full",
        className
      )}
    >
      {children}
    </div>
  );
}


