"use client";

import { useEffect } from "react";
import { useBreadcrumbs } from "./breadcrumbs-context";

interface BreadcrumbsWrapperProps {
  title?: string;
  children: React.ReactNode;
}

/**
 * Wrapper component para páginas que necesitan pasar datos dinámicos a breadcrumbs
 * Uso: Envolver el contenido de la página con este componente
 */
export function BreadcrumbsWrapper({ title, children }: BreadcrumbsWrapperProps) {
  const { setDynamicData } = useBreadcrumbs();

  useEffect(() => {
    if (title) {
      setDynamicData({ title });
    } else {
      setDynamicData(undefined);
    }

    // Limpiar al desmontar
    return () => {
      setDynamicData(undefined);
    };
  }, [title, setDynamicData]);

  return <>{children}</>;
}

