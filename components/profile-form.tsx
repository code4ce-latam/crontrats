"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { createClient } from "@/lib/supabase/client";
import { createActivity } from "@/lib/supabase/activities";

interface ProfileFormProps {
  firstName: string;
  lastName: string;
  email: string;
  userId: string;
}

export function ProfileForm({
  firstName: initialFirstName,
  lastName: initialLastName,
  email: initialEmail,
  userId,
}: ProfileFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = createClient();

      // Actualizar los metadatos del usuario
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
        },
      });

      if (updateError) {
        throw updateError;
      }

      // Registrar actividad de actualización de perfil
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await createActivity(supabase, {
            type: 'UPDATE',
            description: `Actualizó su información de perfil`,
            entity_type: 'profile',
            entity_id: user.id,
            metadata: {
              first_name: firstName,
              last_name: lastName,
            },
          });
        }
      } catch (activityError) {
        console.error("[ProfileForm] Error registrando actividad:", activityError);
      }

      setSuccess(true);
      router.refresh();

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Error al guardar los cambios");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {/* First Name and Last Name Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Ingresa tu nombre"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Ingresa tu apellido"
            required
          />
        </div>
      </div>

      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ingresa tu correo electrónico"
          disabled
          className="bg-muted cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground">
          El correo electrónico no se puede modificar desde aquí.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
          Los detalles se han guardado correctamente.
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Guardando..." : "Guardar Detalles"}
        </Button>
      </div>
    </form>
  );
}

