"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);

  const toggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <SidebarContext.Provider value={{ isOpen, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    // Durante SSR o si el contexto no está disponible, retornar valores por defecto
    // en lugar de lanzar un error, para evitar problemas de hidratación
    if (typeof window === 'undefined') {
      return { isOpen: true, toggle: () => {} };
    }
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

