"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import { Button } from "./ui/button";
import { type MenuItem } from "@/lib/menu-utils";
import { getMenuIcon } from "@/lib/menu-icon-map";

interface SidebarContentProps {
  menuItems: MenuItem[];
  settingsItem: MenuItem | null;
}

export function SidebarContent({ menuItems, settingsItem }: SidebarContentProps) {
  const pathname = usePathname();
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const { isOpen, toggle } = useSidebar();

  const isActive = (href: string) => {
    if (href === "/protected") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Overlay para móviles */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300"
          onClick={toggle}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed md:static w-64 min-h-screen bg-background border-r border-border flex flex-col shrink-0 overflow-y-auto overflow-x-hidden z-50 transition-transform duration-300 ease-in-out",
          isOpen 
            ? "translate-x-0" 
            : "-translate-x-full md:hidden"
        )}
      >
        <div className="flex justify-end p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="h-9 w-9"
            aria-label="Ocultar menú"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 px-4 pb-4 space-y-1">
          {/* Items principales */}
          {menuItems.map((item) => {
            const Icon = getMenuIcon(item.key);
            const active = isActive(item.path);
            return (
              <Link
                key={item.key}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  active &&
                    "bg-accent text-accent-foreground font-semibold"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Sección Configuración */}
          {settingsItem && settingsItem.children && settingsItem.children.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setIsConfigOpen(!isConfigOpen)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                )}
                aria-expanded={isConfigOpen}
                aria-label="Toggle configuración"
              >
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = getMenuIcon(settingsItem.key);
                    return <Icon className="h-5 w-5" />;
                  })()}
                  <span>{settingsItem.label}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isConfigOpen && "transform rotate-180"
                  )}
                />
              </button>

              {/* Subitems de Configuración */}
              {isConfigOpen && (
                <div className="mt-1 ml-6 space-y-1">
                  {settingsItem.children.map((item) => {
                    const Icon = getMenuIcon(item.key);
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.key}
                        href={item.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          active && "bg-accent text-accent-foreground font-medium"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}

