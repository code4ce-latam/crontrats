"use client";

import { useLayoutEffect } from "react";
import { useBreadcrumbs } from "./breadcrumbs-context";

interface BreadcrumbsWrapperProps {
  title?: string;
  children: React.ReactNode;
}

/**
 * Wrapper component para páginas que necesitan pasar datos dinámicos a breadcrumbs
 * Uso: Envolver el contenido de la página con este componente
 * 
 * IMPORTANTE: Este componente establece el título de forma síncrona usando useLayoutEffect
 * para evitar errores de hidratación. El título debe estar disponible en el servidor.
 */
export function BreadcrumbsWrapper({ title, children }: BreadcrumbsWrapperProps) {
  const { setDynamicData } = useBreadcrumbs();

  // useLayoutEffect se ejecuta síncronamente antes de que el navegador pinte
  // Esto asegura que el título esté establecido antes del primer render del cliente
  useLayoutEffect(() => {
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

