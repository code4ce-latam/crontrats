"use client";

import { useActivities } from "./activities-context";
import { cn } from "@/lib/utils";

export function ActivitiesContentWrapper({ children }: { children: React.ReactNode }) {
  const { isOpen } = useActivities();

  return (
    <main
      className={cn(
        "flex-1 p-4 md:p-5 overflow-x-hidden min-w-0 transition-all duration-300",
        isOpen && "ml-80"
      )}
    >
      {children}
    </main>
  );
}

