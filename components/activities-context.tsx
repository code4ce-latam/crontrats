"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface ActivitiesContextType {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const ActivitiesContext = createContext<ActivitiesContextType | undefined>(undefined);

export function ActivitiesProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // Cargar preferencia del usuario desde localStorage
  useEffect(() => {
    const saved = localStorage.getItem('activities-panel-open');
    if (saved !== null) {
      setIsOpen(saved === 'true');
    } else {
      // Por defecto, el panel está cerrado
      setIsOpen(false);
    }
  }, []);

  const toggle = () => {
    setIsOpen((prev) => {
      const newValue = !prev;
      localStorage.setItem('activities-panel-open', String(newValue));
      return newValue;
    });
  };

  const open = () => {
    setIsOpen(true);
    localStorage.setItem('activities-panel-open', 'true');
  };

  const close = () => {
    setIsOpen(false);
    localStorage.setItem('activities-panel-open', 'false');
  };

  return (
    <ActivitiesContext.Provider value={{ isOpen, toggle, open, close }}>
      {children}
    </ActivitiesContext.Provider>
  );
}

export function useActivities() {
  const context = useContext(ActivitiesContext);
  if (context === undefined) {
    throw new Error("useActivities must be used within an ActivitiesProvider");
  }
  return context;
}

