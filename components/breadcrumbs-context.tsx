"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface BreadcrumbContextType {
  dynamicData: Record<string, string> | undefined;
  setDynamicData: (data: Record<string, string> | undefined) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

export function BreadcrumbsProvider({ children }: { children: ReactNode }) {
  const [dynamicData, setDynamicData] = useState<Record<string, string> | undefined>(undefined);

  return (
    <BreadcrumbContext.Provider value={{ dynamicData, setDynamicData }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbs() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error("useBreadcrumbs must be used within BreadcrumbsProvider");
  }
  return context;
}

