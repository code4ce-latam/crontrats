import Link from "next/link";
import { CheckCircle2, Mail, ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Page() {
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
              ¡Cuenta Creada!
            </h1>
            <div className="relative w-fit">
              <p className="text-xl text-gray-600 leading-relaxed overflow-hidden border-r-4 border-blue-500 whitespace-nowrap animate-typing">
                Estás a un paso de comenzar
              </p>
              <p className="text-xl text-gray-600 leading-relaxed mt-2 animate-fadeIn opacity-0" style={{ animationDelay: "3.5s" }}>
                Confirma tu email para activar tu cuenta.
              </p>
            </div>
          </div>
        </div>

        {/* Sección derecha - Mensaje de éxito */}
        <div className="w-full lg:w-1/2 flex items-center justify-center pl-8 pr-6 md:pr-10 py-6 md:py-10 bg-white relative">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {/* Logo y Header */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">CODE4CE</h2>
                  <p className="text-sm text-gray-500 font-medium">Management Platform</p>
                </div>
              </div>

              {/* Icono de éxito */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-fadeIn">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>
              </div>

              {/* Título e Instrucciones */}
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight animate-fadeIn">
                  ¡Gracias por registrarte!
                </h1>
                <div className="flex items-center justify-center gap-2 text-gray-600 mb-4">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <p className="text-lg font-medium">Revisa tu correo electrónico</p>
                </div>
                <p className="text-gray-500 leading-relaxed">
                  Te hemos enviado un enlace de confirmación a tu email. Por favor,
                  revisa tu bandeja de entrada y haz clic en el enlace para activar
                  tu cuenta antes de iniciar sesión.
                </p>
              </div>

              {/* Información adicional */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> Si no encuentras el email, revisa tu carpeta de
                  spam o correo no deseado.
                </p>
              </div>

              {/* Botón para ir a Login */}
              <Button
                asChild
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Link href="/auth/login">
                  Ir a Iniciar Sesión
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-sm text-gray-500 bg-white">
        © 2025 Code4ce. All rights reserved.
      </div>
    </div>
  );
}
