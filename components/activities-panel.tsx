"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserActivities, type Activity } from "@/lib/supabase/activities";
import { useActivities } from "./activities-context";
import { Button } from "./ui/button";
import { ChevronLeft, Activity as ActivityIcon, Clock, FileText, User, Folder, Settings, Image } from "lucide-react";
import { cn } from "@/lib/utils";

// Función para obtener el icono según el tipo de entidad
function getEntityIcon(entityType: string | null) {
  switch (entityType) {
    case 'contract':
    case 'document':
      return FileText;
    case 'folder':
      return Folder;
    case 'user':
    case 'profile':
      return User;
    case 'workspace':
      return Settings;
    case 'avatar':
      return Image;
    default:
      return ActivityIcon;
  }
}

// Función para obtener el color del background según el tipo de entidad
function getEntityIconBgColor(entityType: string | null): string {
  switch (entityType) {
    case 'contract':
    case 'document':
      return 'bg-cyan-600'; // Cian profundo y moderno
    case 'folder':
      return 'bg-teal-600'; // Teal vibrante
    case 'user':
    case 'profile':
      return 'bg-violet-600'; // Violeta intenso
    case 'workspace':
      return 'bg-amber-600'; // Ámbar cálido
    case 'avatar':
      return 'bg-rose-600'; // Rosa profundo
    default:
      return 'bg-slate-600'; // Gris azulado para actividades generales
  }
}

// Función para formatear la fecha relativa
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Hace un momento";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `Hace ${diffInMinutes} ${diffInMinutes === 1 ? 'minuto' : 'minutos'}`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `Hace ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `Hace ${diffInDays} ${diffInDays === 1 ? 'día' : 'días'}`;
  }

  // Para fechas más antiguas, mostrar fecha completa
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function ActivitiesPanel() {
  const { isOpen, close } = useActivities();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Obtener el límite de actividades desde la variable de entorno
  // Por defecto: 20 si no está definida
  const activitiesLimit = parseInt(
    process.env.NEXT_PUBLIC_ACTIVITIES_LIMIT || '20',
    10
  ) || 20;

  useEffect(() => {
    if (!isOpen) return;

    async function loadActivities() {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const data = await getUserActivities(supabase, activitiesLimit);
        setActivities(data);
      } catch (error) {
        console.error("[ActivitiesPanel] Error cargando actividades:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadActivities();

    // Recargar actividades cada 30 segundos cuando el panel está abierto
    const interval = setInterval(loadActivities, 30000);
    return () => clearInterval(interval);
  }, [isOpen, activitiesLimit]);

  if (!isOpen) return null;

  return (
    <div className="absolute left-0 top-0 bottom-0 w-80 bg-background border-r border-border z-20 flex flex-col shadow-lg transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Actividades</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={close}
          className="h-8 w-8"
          aria-label="Cerrar panel de actividades"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <ActivityIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No hay actividades recientes</p>
          </div>
        ) : (
          <div className="p-4 space-y-1.5">
            {activities.map((activity) => {
              const EntityIcon = getEntityIcon(activity.entity_type);
              return (
                <div
                  key={activity.id}
                  className="flex gap-2.5 p-1.5 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shadow-sm",
                      getEntityIconBgColor(activity.entity_type)
                    )}>
                      <EntityIcon className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-2">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatRelativeTime(activity.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

