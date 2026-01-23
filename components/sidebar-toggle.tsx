"use client";

import { Menu, ChevronLeft } from "lucide-react";
import { Button } from "./ui/button";
import { useSidebar } from "./sidebar-context";

export function SidebarToggle() {
  const { isOpen, toggle } = useSidebar();

  if (isOpen) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="h-9 w-9"
      aria-label="Mostrar menú"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}

