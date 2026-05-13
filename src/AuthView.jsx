import React, { useState, useEffect } from "react";
import { signIn, signUp, signInWithGoogle, sendPasswordReset, changePassword, supabase } from "./supabase";
import { BRAND } from "./brand";

export default function AuthView({ onSuccess }) {
  const [mode, setMode]     = useState("signin"); // signin | signup | reset | recovery
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [pwd, setPwd]       = useState("");
  const [pwd2, setPwd2]     = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [info, setInfo]     = useState(null);

  // ── Detecta si el usuario llegó desde un enlace de recuperación ──────────────
  useEffect(() => {
    if (!supabase) return;
    // Caso 1: URL trae ?recovery=1 (de nuestro redirectTo)
    const params = new URLSearchParams(window.location.search);
    if (params.get("recovery") === "1") {
      setMode("recovery");
      // limpia el query string para que no se quede
      window.history.replaceState({}, "", window.location.pathname);
    }
    // Caso 2: Supabase emite evento PASSWORD_RECOVERY al detectar el token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("recovery");
    });
    return () => subscription?.unsubscribe();
  }, []);

  const handleGoogle = async () => {
    setError(null); setInfo(null); setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // signInWithOAuth redirige fuera de la página; nada que hacer aquí
    } catch (err) {
      setError(err.message || "No se pudo iniciar con Google");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);
    try {
      if (mode === "signup") {
        if (!name.trim())            throw new Error("Tu nombre es requerido");
        if (pwd.length < 6)          throw new Error("La contraseña debe tener mínimo 6 caracteres");
        const data = await signUp({ email, password: pwd, name: name.trim() });
        if (data?.session) {
          onSuccess(data.session);
        } else {
          setInfo("Cuenta creada. Revisa tu correo para confirmar (si está activado).");
        }
      } else if (mode === "signin") {
        const data = await signIn({ email, password: pwd });
        if (data?.session) onSuccess(data.session);
      } else if (mode === "reset") {
        if (!email.trim()) throw new Error("Ingresa tu correo");
        await sendPasswordReset(email.trim());
        setInfo("Te enviamos un correo con el enlace para restablecer tu contraseña. Revísalo (incluye spam).");
      } else if (mode === "recovery") {
        if (pwd.length < 6) throw new Error("Mínimo 6 caracteres");
        if (pwd !== pwd2)   throw new Error("Las contraseñas no coinciden");
        await changePassword(pwd);
        setInfo("Contraseña actualizada. Ya puedes iniciar sesión.");
        setTimeout(() => {
          setMode("signin");
          setPwd(""); setPwd2(""); setInfo(null);
        }, 1500);
      }
    } catch (err) {
      setError(err.message || "Error al autenticar");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null); setInfo(null);
    setPwd(""); setPwd2("");
  };

  // ── Helpers de copy según modo ───────────────────────────────────────────────
  const title = {
    signin:   "Bienvenido de vuelta",
    signup:   `Únete a ${BRAND.appName}`,
    reset:    "Recupera tu contraseña",
    recovery: "Crea tu nueva contraseña",
  }[mode];

  const subtitle = {
    signin:   "Ingresa para ver tus análisis y obtener nuevos Panda Scores.",
    signup:   "Crea tu cuenta y guarda automáticamente todos tus análisis.",
    reset:    "Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.",
    recovery: "Elige una nueva contraseña segura. Luego podrás iniciar sesión con ella.",
  }[mode];

  const submitText = {
    signin:   { idle: "🐼 Entrar",                 busy: "Iniciando…" },
    signup:   { idle: "🐼 Crear mi cuenta",        busy: "Creando cuenta…" },
    reset:    { idle: "Enviar enlace de recuperación", busy: "Enviando…" },
    recovery: { idle: "Guardar nueva contraseña",  busy: "Guardando…" },
  }[mode];

  const showTabs        = mode === "signin" || mode === "signup";
  const showGoogle      = mode === "signin" || mode === "signup";
  const showName        = mode === "signup";
  const showEmail       = mode !== "recovery";
  const showPassword    = mode === "signin" || mode === "signup" || mode === "recovery";
  const showConfirmPwd  = mode === "recovery";
  const showForgotLink  = mode === "signin";
  const showBackLink    = mode === "reset" || mode === "recovery";

  return (
    <div className="min-h-screen bg-[#070812] text-white flex items-center justify-center p-4">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-pink-600/20 blur-3xl" />
      <div className="pointer-events-none fixed right-[-100px] top-40 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-150px] left-1/3 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Logo + name */}
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={BRAND.logo} alt={BRAND.appName} className="h-20 w-20 rounded-3xl bg-white object-contain p-1 shadow-2xl" />
          <h1 className="mt-3 text-2xl font-black tracking-tight">{BRAND.appName}</h1>
          <p className="text-xs font-medium text-white/40">{BRAND.tagline}</p>
          <p className="mt-2 text-[10px] uppercase tracking-widest text-white/25">{BRAND.signature}</p>
        </div>

        {/* Card */}
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl shadow-2xl sm:p-8">

          {/* Tabs solo en signin/signup */}
          {showTabs && (
            <div className="mb-6 flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`flex-1 rounded-xl py-2.5 text-sm font-black transition ${mode === "signin" ? "bg-white text-black" : "text-white/55 hover:bg-white/5"}`}
              >Iniciar sesión</button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`flex-1 rounded-xl py-2.5 text-sm font-black transition ${mode === "signup" ? "bg-white text-black" : "text-white/55 hover:bg-white/5"}`}
              >Crear cuenta</button>
            </div>
          )}

          <h2 className="mb-1 text-xl font-black">{title}</h2>
          <p className="mb-6 text-sm text-white/40">{subtitle}</p>

          {/* Google OAuth button */}
          {showGoogle && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
                className="mb-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/[0.10] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {googleLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continuar con Google
              </button>

              <div className="mb-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/30">
                <span className="h-px flex-1 bg-white/10" />
                <span>o con correo</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {showName && (
              <div>
                <label className="mb-1.5 block text-xs font-black text-white/70">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-cyan-400/60"
                />
              </div>
            )}
            {showEmail && (
              <div>
                <label className="mb-1.5 block text-xs font-black text-white/70">Correo</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-cyan-400/60"
                />
              </div>
            )}
            {showPassword && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-black text-white/70">
                    {mode === "recovery" ? "Nueva contraseña" : "Contraseña"}
                  </label>
                  {showForgotLink && (
                    <button
                      type="button"
                      onClick={() => switchMode("reset")}
                      className="text-[11px] font-bold text-cyan-300 hover:text-cyan-200"
                    >¿Olvidaste tu contraseña?</button>
                  )}
                </div>
                <input
                  type="password"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder={mode === "recovery" || mode === "signup" ? "Mínimo 6 caracteres" : "Tu contraseña"}
                  required
                  minLength={6}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-cyan-400/60"
                />
              </div>
            )}
            {showConfirmPwd && (
              <div>
                <label className="mb-1.5 block text-xs font-black text-white/70">Confirmar contraseña</label>
                <input
                  type="password"
                  value={pwd2}
                  onChange={(e) => setPwd2(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  minLength={6}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-cyan-400/60"
                />
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs text-red-300">
                ⚠️ {error}
              </div>
            )}
            {info && (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-300">
                ✓ {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-black transition hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  {submitText.busy}
                </span>
              ) : submitText.idle}
            </button>

            {showBackLink && (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold text-white/60 transition hover:bg-white/10"
              >← Volver al inicio de sesión</button>
            )}
          </form>

          <p className="mt-6 text-center text-[11px] text-white/30">
            {mode === "signin"  && "¿No tienes cuenta? Crea una arriba."}
            {mode === "signup"  && "Al crear una cuenta aceptas el uso ético de los datos solo para tu evaluación."}
            {mode === "reset"   && "Revisa tu bandeja de entrada después de enviar el enlace."}
            {mode === "recovery"&& "Una vez actualizada, podrás cerrar y abrir sesión normalmente."}
          </p>
        </div>
      </div>
    </div>
  );
}
