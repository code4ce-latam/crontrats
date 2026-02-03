"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DrawerContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Drawer({ open, onOpenChange, children }: DrawerProps) {
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    if (open) {
      window.addEventListener("keydown", onKeyDown);
    }
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <DrawerContext.Provider value={{ open, setOpen: onOpenChange }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function DrawerContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(DrawerContext);
  if (!ctx || !ctx.open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40">
      <div
        className={cn(
          "w-full max-w-md rounded-t-2xl bg-white shadow-lg animate-in slide-in-from-bottom",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function DrawerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-b border-zinc-200 px-4 py-3",
        className
      )}
      {...props}
    />
  );
}

export function DrawerTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-sm font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}
