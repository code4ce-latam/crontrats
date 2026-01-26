"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Importación dinámica sin SSR para evitar errores de DOMMatrix
const PdfReviewer = dynamic(() => import("./pdf-reviewer").then(mod => ({ default: mod.PdfReviewer })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-muted-foreground">Cargando visor de PDF...</div>
    </div>
  ),
});

interface PdfReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileVersionId: string;
  storagePath: string;
  mode: 'view' | 'annotate';
  access: 'READ' | 'EDIT' | 'OWNER';
}

export function PdfReviewModal({
  open,
  onOpenChange,
  fileVersionId,
  storagePath,
  mode,
  access,
}: PdfReviewModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] m-0 p-0 max-h-[95vh]">
        <VisuallyHidden>
          <DialogTitle>
            {mode === 'annotate' ? 'Anotar documento' : 'Ver documento'}
          </DialogTitle>
        </VisuallyHidden>
        <div className="flex flex-col h-full">
          <PdfReviewer
            fileVersionId={fileVersionId}
            storagePath={storagePath}
            mode={mode}
            access={access}
            onClose={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

