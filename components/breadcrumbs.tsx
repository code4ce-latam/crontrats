"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { shouldShowBreadcrumb, generateBreadcrumbs } from "@/lib/breadcrumb-config";
import { useBreadcrumbs } from "./breadcrumbs-context";
import { cn } from "@/lib/utils";

export function Breadcrumbs() {
  const pathname = usePathname();
  const { dynamicData } = useBreadcrumbs();

  // No mostrar breadcrumbs si no es necesario
  if (!shouldShowBreadcrumb(pathname)) {
    return null;
  }

  const breadcrumbs = generateBreadcrumbs(pathname, dynamicData);

  // Si solo hay un breadcrumb (Inicio), no mostrar
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="flex h-10 items-center gap-2 px-4 md:px-5">
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;

            return (
              <li key={crumb.href} className="flex items-center gap-1.5">
                {index === 0 ? (
                  <Link
                    href={crumb.href}
                    className={cn(
                      "flex items-center gap-1.5 transition-colors hover:text-foreground",
                      isLast && "text-foreground font-medium"
                    )}
                  >
                    <Home className="h-3.5 w-3.5" />
                    <span>{crumb.label}</span>
                  </Link>
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    {isLast ? (
                      <span className="text-foreground font-medium">{crumb.label}</span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="transition-colors hover:text-foreground"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

