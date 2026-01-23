import { createClient } from "@/lib/supabase/server";
import { validateInviteToken } from "@/lib/supabase/invitations";
import { redirect } from "next/navigation";
import { AcceptInviteForm } from "@/components/accept-invite-form";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AcceptInvitePage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  // Validar el token
  const invite = await validateInviteToken(supabase, token);

  if (!invite) {
    redirect("/auth/invite/invalid");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* Sección izquierda - Bienvenida */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-50 to-purple-50 relative overflow-hidden">
          <div className="absolute inset-0">
            {/* Formas circulares decorativas */}
            <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400 rounded-full opacity-20 blur-3xl"></div>
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-400 rounded-full opacity-20 blur-3xl"></div>
            <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-blue-300 rounded-full opacity-15 blur-3xl"></div>
          </div>
          <div className="relative z-10 flex flex-col justify-center pl-16 pr-8 text-gray-800">
            <h1 className="text-5xl font-bold mb-6 text-blue-900 animate-fadeIn">
              ¡Bienvenido a CODE4CE!
            </h1>
            <div className="relative w-fit">
              <p className="text-xl text-gray-600 leading-relaxed overflow-hidden border-r-4 border-blue-500 whitespace-nowrap animate-typing">
                Has sido invitado a unirte
              </p>
              <p className="text-xl text-gray-600 leading-relaxed mt-2 animate-fadeIn opacity-0" style={{ animationDelay: "3.5s" }}>
                Crea tu cuenta para comenzar.
              </p>
            </div>
          </div>
        </div>

        {/* Sección derecha - Formulario */}
        <div className="w-full lg:w-1/2 flex items-center justify-center pl-8 pr-6 md:pr-10 py-6 md:py-10 bg-white relative">
          <AcceptInviteForm token={token} inviteEmail={invite.email} inviteDisplayName={invite.display_name} />
        </div>
      </div>
    </div>
  );
}

