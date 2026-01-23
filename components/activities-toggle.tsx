"use client";

import { Activity } from "lucide-react";
import { Button } from "./ui/button";
import { useActivities } from "./activities-context";
import { cn } from "@/lib/utils";

export function ActivitiesToggle() {
  const { isOpen, toggle } = useActivities();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={cn(
        "h-9 w-9",
        isOpen && "bg-accent text-accent-foreground"
      )}
      aria-label={isOpen ? "Ocultar actividades" : "Mostrar actividades"}
      title={isOpen ? "Ocultar actividades" : "Mostrar actividades"}
    >
      <Activity className="h-5 w-5" />
    </Button>
  );
}

