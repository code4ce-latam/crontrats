import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserCog, KeyRound, Image } from "lucide-react";
import { ProfileForm } from "@/components/profile-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ProfilePictureUpload } from "@/components/profile-picture-upload";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    redirect("/auth/login");
  }

  const email = user.email || "";
  const firstName =
    user.user_metadata?.first_name ||
    user.user_metadata?.full_name?.split(" ")[0] ||
    "";
  const lastName =
    user.user_metadata?.last_name ||
    user.user_metadata?.full_name?.split(" ").slice(1).join(" ") ||
    "";

  // Obtener avatar_url de la tabla profiles (no de user_metadata)
  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('user_id', user.id)
    .single();

  const avatarUrl = profile?.avatar_url || null;

  // Verificar si el usuario se autenticó con email/password
  // Los usuarios con OAuth tienen providers como 'google', 'github', etc.
  // Los usuarios con email/password tienen 'email' en app_metadata.providers
  const providers = user.app_metadata?.providers || [];
  const isEmailPasswordUser = providers.includes("email") || providers.length === 0;

  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      {/* Page Title */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Configuración de Perfil
        </h1>
        <p className="text-sm text-muted-foreground">
          Administra la configuración y preferencias de tu cuenta.
        </p>
      </div>

      {/* Personal Details Card */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-md bg-accent">
            <UserCog className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Detalles personales
            </h2>
            <p className="text-sm text-muted-foreground">
              Edita tu información personal.
            </p>
          </div>
        </div>

        <ProfileForm
          firstName={firstName}
          lastName={lastName}
          email={email}
          userId={user.id}
        />
      </div>

      {/* Change Password Card - Solo para usuarios con email/password */}
      {isEmailPasswordUser && (
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-accent">
              <KeyRound className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Cambiar contraseña
              </h2>
              <p className="text-sm text-muted-foreground">
                Cambia la contraseña de tu cuenta.
              </p>
            </div>
          </div>

          <ChangePasswordForm />
        </div>
      )}

      {/* Profile Picture Card */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-md bg-accent">
            <Image className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Foto de Perfil
            </h2>
            <p className="text-sm text-muted-foreground">
              Sube una nueva imagen para tu perfil.
            </p>
          </div>
        </div>

        <ProfilePictureUpload currentAvatarUrl={avatarUrl} />
      </div>
    </div>
  );
}

