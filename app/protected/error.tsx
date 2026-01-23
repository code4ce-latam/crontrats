"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service
    console.error("Protected page error:", error);
  }, [error]);

  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <div className="w-full">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Error al cargar la página</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {error.message || "Ocurrió un error inesperado al cargar esta página protegida."}
            </p>
            <div className="flex gap-2">
              <Button onClick={reset} variant="outline">
                Intentar de nuevo
              </Button>
              <Button asChild variant="default">
                <Link href="/">Volver al inicio</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

