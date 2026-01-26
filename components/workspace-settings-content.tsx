"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { getTimezones, getTimezonesByRegion, isValidTimezone, type TimezoneOption } from "@/lib/timezones";

interface WorkspaceSettingsContentProps {
  initialWorkspaceName: string;
  initialTimezone?: string | null;
  workspaceId: string;
}

export function WorkspaceSettingsContent({
  initialWorkspaceName,
  initialTimezone,
  workspaceId,
}: WorkspaceSettingsContentProps) {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName);
  const [timezone, setTimezone] = useState(initialTimezone || 'UTC');
  const [timezones, setTimezones] = useState<TimezoneOption[]>([]);
  const [isLoadingTimezones, setIsLoadingTimezones] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [timezoneSuccess, setTimezoneSuccess] = useState(false);

  // Cargar zonas horarias cuando el componente se monte (solo en cliente)
  useEffect(() => {
    setIsLoadingTimezones(true);
    const allTimezones = getTimezones();
    setTimezones(allTimezones);
    setIsLoadingTimezones(false);
  }, []);

  // Agrupar zonas horarias por región
  const groupedTimezones = useMemo(() => {
    return getTimezonesByRegion(timezones);
  }, [timezones]);

  const handleSave = async () => {
    if (!workspaceName.trim()) {
      setError("El nombre del workspace es requerido");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/workspace/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: workspaceName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al actualizar el workspace");
      }

      setSuccess(true);
      // Recargar después de un breve delay para mostrar el mensaje de éxito
      setTimeout(() => {
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Error al actualizar el workspace");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTimezone = async () => {
    if (!timezone || !isValidTimezone(timezone)) {
      setTimezoneError("Por favor selecciona una zona horaria válida");
      return;
    }

    setIsSavingTimezone(true);
    setTimezoneError(null);
    setTimezoneSuccess(false);

    try {
      const response = await fetch("/api/workspace/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          timezone: timezone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al actualizar la zona horaria");
      }

      setTimezoneSuccess(true);
      // Recargar después de un breve delay para mostrar el mensaje de éxito
      setTimeout(() => {
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setTimezoneError(err.message || "Error al actualizar la zona horaria");
    } finally {
      setIsSavingTimezone(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Información del workspace */}
      <Card>
        <CardHeader>
          <CardTitle>Información del workspace</CardTitle>
          <CardDescription>
            Actualiza el nombre de tu workspace. Los cambios se aplicarán inmediatamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="workspace-name" className="text-sm font-medium">
              Nombre del workspace
            </label>
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Nombre del workspace"
              className="mt-2"
              disabled={isSaving}
            />
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-md bg-green-50 text-green-700 text-sm border border-green-200">
              Workspace actualizado correctamente
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !workspaceName.trim() || workspaceName.trim() === initialWorkspaceName}
            >
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preferencias horarias */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Preferencias horarias</CardTitle>
          </div>
          <CardDescription>
            Esto establecerá la zona horaria para toda la cuenta. Esto es especialmente importante para las <strong>notificaciones</strong>. Todas las notificaciones se enviarán desde esta zona horaria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="timezone" className="text-sm font-medium">
              Zona horaria:
            </label>
            {isLoadingTimezones ? (
              <div className="flex h-9 w-full items-center justify-center rounded-md border border-input bg-muted/50 mt-2 text-sm text-muted-foreground">
                Cargando zonas horarias...
              </div>
            ) : (
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  setTimezoneError(null);
                  setTimezoneSuccess(false);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-2"
                disabled={isSavingTimezone}
              >
                {Object.entries(groupedTimezones).map(([region, tzs]) => (
                  <optgroup key={region} label={region}>
                    {tzs.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {timezoneError && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {timezoneError}
            </div>
          )}

          {timezoneSuccess && (
            <div className="p-3 rounded-md bg-green-50 text-green-700 text-sm border border-green-200">
              Zona horaria actualizada correctamente
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={isSavingTimezone}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateTimezone} 
              disabled={isSavingTimezone || timezone === (initialTimezone || 'UTC')}
            >
              {isSavingTimezone ? "Actualizando..." : "Actualizar zona horaria"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

