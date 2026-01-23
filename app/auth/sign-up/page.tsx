import { SignUpForm } from "@/components/sign-up-form";

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
              Únete a CODE4CE
            </h1>
            <div className="relative w-fit">
              <p className="text-xl text-gray-600 leading-relaxed overflow-hidden border-r-4 border-blue-500 whitespace-nowrap animate-typing">
                Crea tu cuenta y comienza a gestionar
              </p>
              <p className="text-xl text-gray-600 leading-relaxed mt-2 animate-fadeIn opacity-0" style={{ animationDelay: "3.5s" }}>
                tu negocio de manera eficiente.
              </p>
            </div>
          </div>
        </div>

        {/* Sección derecha - Formulario */}
        <div className="w-full lg:w-1/2 flex items-center justify-center pl-8 pr-6 md:pr-10 py-6 md:py-10 bg-white relative">
          <SignUpForm />
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-sm text-gray-500 bg-white">
        © 2025 Code4ce. All rights reserved.
      </div>
    </div>
  );
}
