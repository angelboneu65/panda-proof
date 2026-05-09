import React, { useState } from "react";
import { signIn, signUp } from "./supabase";
import { BRAND } from "./brand";

export default function AuthView({ onSuccess }) {
  const [mode, setMode]     = useState("signin"); // signin | signup
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [pwd, setPwd]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [info, setInfo]     = useState(null);

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
      } else {
        const data = await signIn({ email, password: pwd });
        if (data?.session) onSuccess(data.session);
      }
    } catch (err) {
      setError(err.message || "Error al autenticar");
    } finally {
      setLoading(false);
    }
  };

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

          {/* Tabs */}
          <div className="mb-6 flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-black transition ${mode === "signin" ? "bg-white text-black" : "text-white/55 hover:bg-white/5"}`}
            >Iniciar sesión</button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-black transition ${mode === "signup" ? "bg-white text-black" : "text-white/55 hover:bg-white/5"}`}
            >Crear cuenta</button>
          </div>

          <h2 className="mb-1 text-xl font-black">
            {mode === "signin" ? "Bienvenido de vuelta" : `Únete a ${BRAND.appName}`}
          </h2>
          <p className="mb-6 text-sm text-white/40">
            {mode === "signin"
              ? "Ingresa para ver tus análisis y obtener nuevos Panda Scores."
              : "Crea tu cuenta y guarda automáticamente todos tus análisis."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
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
            <div>
              <label className="mb-1.5 block text-xs font-black text-white/70">Contraseña</label>
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "Tu contraseña"}
                required
                minLength={6}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-cyan-400/60"
              />
            </div>

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
              disabled={loading}
              className="w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-black transition hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  {mode === "signin" ? "Iniciando…" : "Creando cuenta…"}
                </span>
              ) : mode === "signin" ? "🐼 Entrar" : "🐼 Crear mi cuenta"}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-white/30">
            {mode === "signin"
              ? "¿No tienes cuenta? Crea una arriba."
              : "Al crear una cuenta aceptas el uso ético de los datos solo para tu evaluación."}
          </p>
        </div>
      </div>
    </div>
  );
}
