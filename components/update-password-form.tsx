// Requiere "use client" porque usa hooks de React (useState, useRouter)
// y maneja estado local del formulario con interacciones del usuario
"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, ArrowRight, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Verificar inmediatamente si hay parámetros de recuperación en la URL
  const hasRecoveryParamsInitial = typeof window !== 'undefined' && (
    window.location.hash.includes('access_token') ||
    window.location.hash.includes('refresh_token') ||
    window.location.hash.includes('token_hash') ||
    window.location.search.includes('access_token') ||
    window.location.search.includes('refresh_token') ||
    window.location.search.includes('token_hash')
  );

  const [isCheckingSession, setIsCheckingSession] = useState(hasRecoveryParamsInitial);
  const [isSuccess, setIsSuccess] = useState(false);
  const [userInfo, setUserInfo] = useState<{ email: string; name: string | null } | null>(null);
  const [showInvalidSessionError, setShowInvalidSessionError] = useState(!hasRecoveryParamsInitial);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  const router = useRouter();

  // Verificar si hay una sesión activa al cargar el componente
  // Esto es necesario porque Supabase procesa el token del hash en el cliente
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      
      // Verificar si hay parámetros de recuperación en la URL (hash o query params)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const urlParams = new URLSearchParams(window.location.search);
      
      const accessToken = hashParams.get('access_token') || urlParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || urlParams.get('refresh_token');
      const type = hashParams.get('type') || urlParams.get('type');
      const tokenHash = hashParams.get('token_hash') || urlParams.get('token_hash');
      
      // Si no hay ningún parámetro de recuperación en la URL, el enlace es inválido
      if (!accessToken && !refreshToken && !tokenHash && !type) {
        setShowInvalidSessionError(true);
        setIsCheckingSession(false);
        setHasCheckedSession(true);
        return;
      }
      
      // Si hay un token_hash y type, intentar verificar el OTP
      if (tokenHash && type) {
        try {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: type as any,
            token_hash: tokenHash,
          });
          
          if (verifyError) {
            console.error("[UpdatePasswordForm] Error verificando OTP:", verifyError);
            setShowInvalidSessionError(true);
            setIsCheckingSession(false);
            setHasCheckedSession(true);
            return;
          }
        } catch (err) {
          console.error("[UpdatePasswordForm] Error procesando token:", err);
          setShowInvalidSessionError(true);
          setIsCheckingSession(false);
          setHasCheckedSession(true);
          return;
        }
      }
      
      // Si hay access_token y refresh_token en el hash, establecer la sesión
      if (accessToken && refreshToken) {
        try {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (sessionError) {
            console.error("[UpdatePasswordForm] Error estableciendo sesión:", sessionError);
            setShowInvalidSessionError(true);
            setIsCheckingSession(false);
            setHasCheckedSession(true);
            return;
          }
        } catch (err) {
          console.error("[UpdatePasswordForm] Error estableciendo sesión:", err);
          setShowInvalidSessionError(true);
          setIsCheckingSession(false);
          setHasCheckedSession(true);
          return;
        }
      }
      
      // Verificar si hay una sesión activa
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Esperar un momento para que Supabase procese el hash si está presente
        setTimeout(async () => {
          const { data: { user: retryUser } } = await supabase.auth.getUser();
          if (!retryUser) {
            setShowInvalidSessionError(true);
          } else {
            // Obtener información del usuario
            const userName = 
              retryUser.user_metadata?.full_name ||
              retryUser.user_metadata?.name ||
              `${retryUser.user_metadata?.first_name || ''} ${retryUser.user_metadata?.last_name || ''}`.trim() ||
              null;
            setUserInfo({
              email: retryUser.email || '',
              name: userName,
            });
          }
          setIsCheckingSession(false);
          setHasCheckedSession(true);
        }, 1500);
      } else {
        // Obtener información del usuario
        const userName = 
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() ||
          null;
        setUserInfo({
          email: user.email || '',
          name: userName,
        });
        setIsCheckingSession(false);
        setHasCheckedSession(true);
      }
    };

    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      // Mostrar mensaje de éxito
      setIsSuccess(true);
      
      // Esperar 2 segundos para que el usuario vea el mensaje de éxito
      setTimeout(async () => {
        // Cerrar sesión automáticamente
        await supabase.auth.signOut();
        // Redirigir al login
        router.push("/auth/login?message=password_updated");
      }, 2000);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error al actualizar la contraseña");
      setIsLoading(false);
    }
  };

  // Si hay error de sesión inválida, mostrar solo el mensaje de error
  if (showInvalidSessionError) {
    return (
      <div className={cn("w-full max-w-md", className)} {...props}>
        <div className="bg-white rounded-2xl shadow-xl p-5 md:p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Enlace Inválido
          </h1>
          
          <p className="text-sm text-gray-600 mb-4">
            Este enlace de recuperación no es válido o ha expirado. Por favor, usa el enlace del email de recuperación o solicita uno nuevo.
          </p>
          
          <Button asChild className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
            <Link href="/auth/login">
              Ir al Inicio de Sesión
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-md", className)} {...props}>
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

        {/* Título e Instrucciones */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
            Nueva Contraseña
          </h1>
          <p className="text-gray-500 mb-4">
            Ingresa tu nueva contraseña a continuación
          </p>
          {userInfo && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Usuario:</span>{" "}
                {userInfo.name ? (
                  <>
                    <span className="font-semibold text-blue-900">{userInfo.name}</span>
                    <span className="text-gray-500"> ({userInfo.email})</span>
                  </>
                ) : (
                  <span className="font-semibold text-blue-900">{userInfo.email}</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Mensaje de verificación de sesión */}
        {isCheckingSession && !showInvalidSessionError && !hasCheckedSession && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Verificando sesión...
            </p>
          </div>
        )}

        {/* Mensaje de éxito */}
        {isSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-800 font-medium">
                ¡Contraseña actualizada exitosamente! Cerrando sesión...
              </p>
            </div>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleUpdatePassword} className="space-y-6" style={{ display: isSuccess ? 'none' : 'block' }}>
          {/* Campo Nueva Contraseña */}
          <div className="space-y-2 group">
            <Label htmlFor="password" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600">
              Nueva Contraseña
            </Label>
            <div className="relative transition-transform duration-200 focus-within:scale-[1.01]">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-blue-500" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12 bg-gray-50/50 border-gray-200 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Campo Confirmar Contraseña */}
          <div className="space-y-2 group">
            <Label htmlFor="confirmPassword" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600">
              Confirmar Contraseña
            </Label>
            <div className="relative transition-transform duration-200 focus-within:scale-[1.01]">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-blue-500" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repite tu nueva contraseña"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10 h-12 bg-gray-50/50 border-gray-200 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
              {error}
            </p>
          )}

          {/* Botón de Guardar */}
          <Button
            type="submit"
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? (
              "Guardando..."
            ) : (
              <>
                Guardar Nueva Contraseña
                <CheckCircle2 className="w-5 h-5" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
