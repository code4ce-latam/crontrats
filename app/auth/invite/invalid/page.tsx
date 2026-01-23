import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function InvalidInvitePage() {
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
              Invitación Inválida
            </h1>
            <div className="relative w-fit">
              <p className="text-xl text-gray-600 leading-relaxed overflow-hidden border-r-4 border-blue-500 whitespace-nowrap animate-typing">
                Esta invitación no es válida
              </p>
              <p className="text-xl text-gray-600 leading-relaxed mt-2 animate-fadeIn opacity-0" style={{ animationDelay: "3.5s" }}>
                o ha expirado.
              </p>
            </div>
          </div>
        </div>

        {/* Sección derecha - Mensaje */}
        <div className="w-full lg:w-1/2 flex items-center justify-center pl-8 pr-6 md:pr-10 py-6 md:py-10 bg-white relative">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-xl p-5 md:p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Invitación Inválida
              </h1>
              
              <p className="text-sm text-gray-600 mb-4">
                Esta invitación no es válida o ha expirado. Por favor, contacta al administrador para obtener una nueva invitación.
              </p>
              
              <Button asChild className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
                <Link href="/auth/login">
                  Ir al Inicio de Sesión
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

