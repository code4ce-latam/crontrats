import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function InvalidInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Invitación Inválida
        </h1>
        
        <p className="text-gray-600 mb-6">
          Esta invitación no es válida o ha expirado. Por favor, contacta al administrador para obtener una nueva invitación.
        </p>
        
        <Button asChild className="w-full">
          <Link href="/auth/login">
            Ir al Inicio de Sesión
          </Link>
        </Button>
      </div>
    </div>
  );
}

