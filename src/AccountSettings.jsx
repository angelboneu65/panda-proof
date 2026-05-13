import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  supabase,
  uploadAvatar,
  updateAuthDisplayName,
  changePassword,
} from "./supabase";
import { authedFetch } from "./api";

// ── Mini UI primitives ────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", disabled = false, full = false, small = false, loading = false, type = "button" }) {
  const base = `rounded-2xl font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${full ? "w-full" : ""} ${small ? "px-4 py-2 text-xs" : "px-5 py-3.5 text-sm"}`;
  const styles =
    variant === "primary"   ? "bg-white text-black hover:bg-white/90 active:scale-[0.98]"
    : variant === "danger"  ? "border border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 active:scale-[0.98]"
    : variant === "success" ? "bg-emerald-500 text-white hover:bg-emerald-400 active:scale-[0.98]"
    :                         "border border-white/15 bg-white/5 text-white hover:bg-white/10 active:scale-[0.98]";
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={`${base} ${styles} flex items-center justify-center gap-2`}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current" />}
      {children}
    </button>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "", hint, error, readOnly = false }) {
  return (
    <div>
      {label && <label className="mb-1.5 block text-xs font-black text-white/70">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full rounded-2xl border bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition ${
          readOnly ? "cursor-default border-white/5 text-white/40" : "border-white/10 focus:border-cyan-400/60"
        } ${error ? "border-red-400/50" : ""}`}
      />
      {hint  && !error && <p className="mt-1 text-[11px] text-white/30">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
      <div className="mb-5">
        <h3 className="text-base font-black">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-white/40">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Toast({ message, variant = "success" }) {
  if (!message) return null;
  const colors = variant === "success"
    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
    : "border-red-400/30 bg-red-500/15 text-red-200";
  return (
    <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${colors}`}>
      <span>{variant === "success" ? "✓" : "⚠"}</span>
      {message}
    </div>
  );
}

// ── AvatarSection ─────────────────────────────────────────────────────────────
function AvatarSection({ profile, session, onUpdate }) {
  const fileRef      = useRef(null);
  const [preview,    setPreview]  = useState(profile?.avatar_url || null);
  const [uploading,  setUploading] = useState(false);
  const [toast,      setToast]    = useState(null);
  const userName     = profile?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split("@")[0] || "?";

  const showToast = (msg, v = "success") => { setToast({ msg, v }); setTimeout(() => setToast(null), 3500); };

  const handleFile = async (file) => {
    if (!file?.type.startsWith("image/")) return;
    // Mostrar preview inmediato
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setUploading(true);
    try {
      const publicUrl = await uploadAvatar(file);
      // Actualizar perfil en server
      const res = await authedFetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      setPreview(publicUrl);
      onUpdate({ avatar_url: publicUrl });
      showToast("Foto de perfil actualizada");
    } catch (err) {
      showToast(err.message || "Error al subir foto", "error");
      setPreview(profile?.avatar_url || null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SectionCard title="Foto de perfil" subtitle="Sube una imagen cuadrada para mejores resultados. PNG, JPG. Máx 5 MB.">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        {/* Avatar circle */}
        <div className="relative flex-shrink-0">
          <div
            className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-cyan-400 ring-4 ring-white/10 shadow-xl"
            style={{ fontSize: 36 }}
          >
            {preview
              ? <img src={preview} alt="Avatar" className="h-full w-full object-cover" />
              : <span className="font-black text-white">{userName[0]?.toUpperCase()}</span>
            }
          </div>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          )}
        </div>

        {/* Upload controls */}
        <div className="flex flex-col gap-3 flex-1 w-full">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Btn
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            loading={uploading}
            variant="ghost"
          >
            {uploading ? "Subiendo…" : "📷 Cambiar foto"}
          </Btn>
          {preview && (
            <Btn
              onClick={async () => {
                setUploading(true);
                try {
                  const res = await authedFetch("/api/me", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ avatar_url: "" }),
                  });
                  if (!res.ok) throw new Error("No se pudo eliminar");
                  setPreview(null);
                  onUpdate({ avatar_url: null });
                  showToast("Foto eliminada");
                } catch (err) {
                  showToast(err.message, "error");
                } finally { setUploading(false); }
              }}
              variant="danger"
              small
              disabled={uploading}
            >
              Eliminar foto
            </Btn>
          )}
          {toast && <Toast message={toast.msg} variant={toast.v} />}
        </div>
      </div>
    </SectionCard>
  );
}

// ── NameSection ───────────────────────────────────────────────────────────────
function NameSection({ profile, session, onUpdate }) {
  const initial     = profile?.full_name || session?.user?.user_metadata?.name || "";
  const [name,      setName]    = useState(initial);
  const [saving,    setSaving]  = useState(false);
  const [toast,     setToast]   = useState(null);
  const changed     = name.trim() !== initial.trim();

  const showToast = (msg, v = "success") => { setToast({ msg, v }); setTimeout(() => setToast(null), 3000); };

  const handleSave = async () => {
    if (!name.trim() || !changed) return;
    setSaving(true);
    try {
      // Actualiza auth.user metadata (para que session.user.user_metadata.name quede actualizado)
      await updateAuthDisplayName(name.trim());
      // Actualiza profiles table vía server
      const res = await authedFetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name.trim() }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      onUpdate({ full_name: name.trim() });
      showToast("Nombre actualizado");
    } catch (err) {
      showToast(err.message || "Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Nombre de display" subtitle="Así te mostraremos en la app.">
      <div className="space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
        />
        {toast && <Toast message={toast.msg} variant={toast.v} />}
        <Btn onClick={handleSave} disabled={!changed || !name.trim()} loading={saving}>
          Guardar nombre
        </Btn>
      </div>
    </SectionCard>
  );
}

// ── EmailSection ──────────────────────────────────────────────────────────────
function EmailSection({ session }) {
  return (
    <SectionCard title="Correo electrónico" subtitle="Para cambiar tu correo necesitas verificar el nuevo desde tu bandeja.">
      <div className="space-y-3">
        <Input value={session?.user?.email || ""} readOnly label="Email actual" />
        <p className="text-[11px] text-white/30">
          El cambio de email requiere confirmación. Usa la opción "Cambiar email" en la configuración de Supabase o contacta soporte.
        </p>
      </div>
    </SectionCard>
  );
}

// ── PasswordSection ───────────────────────────────────────────────────────────
function PasswordSection() {
  const [form,    setForm]   = useState({ newPass: "", confirm: "" });
  const [saving,  setSaving] = useState(false);
  const [toast,   setToast]  = useState(null);
  const [errors,  setErrors] = useState({});

  const showToast = (msg, v = "success") => { setToast({ msg, v }); setTimeout(() => setToast(null), 4000); };

  const validate = () => {
    const e = {};
    if (form.newPass.length < 8) e.newPass = "Mínimo 8 caracteres";
    if (form.newPass !== form.confirm) e.confirm = "Las contraseñas no coinciden";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await changePassword(form.newPass);
      showToast("Contraseña actualizada correctamente");
      setForm({ newPass: "", confirm: "" });
    } catch (err) {
      showToast(err.message || "Error al cambiar contraseña", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Contraseña" subtitle="Elige una contraseña segura de al menos 8 caracteres.">
      <div className="space-y-3">
        <Input
          label="Nueva contraseña"
          type="password"
          value={form.newPass}
          onChange={(e) => { setForm((f) => ({ ...f, newPass: e.target.value })); setErrors((er) => ({ ...er, newPass: null })); }}
          placeholder="••••••••"
          error={errors.newPass}
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          value={form.confirm}
          onChange={(e) => { setForm((f) => ({ ...f, confirm: e.target.value })); setErrors((er) => ({ ...er, confirm: null })); }}
          placeholder="••••••••"
          error={errors.confirm}
        />
        {toast && <Toast message={toast.msg} variant={toast.v} />}
        <Btn
          onClick={handleSave}
          disabled={!form.newPass || !form.confirm}
          loading={saving}
        >
          Cambiar contraseña
        </Btn>
      </div>
    </SectionCard>
  );
}

// ── PlanSection ───────────────────────────────────────────────────────────────
function PlanSection({ profile, onOpenCredits }) {
  if (!profile) return null;
  const planLabel = {
    free:  "Free",
    basic: "Basic",
    pro:   "Pro",
    admin: "Admin",
  }[profile.plan] || profile.plan;

  return (
    <SectionCard title="Tu plan y créditos" subtitle="Resumen de tu cuenta actual.">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-purple-400/20 bg-purple-400/10 p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-purple-200">Plan</p>
            <p className="mt-1 text-lg font-black text-white">{planLabel}</p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Créditos</p>
            <p className="mt-1 text-lg font-black text-white">
              {profile.is_unlimited ? "∞" : profile.credits_balance}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3 text-[12px] text-emerald-200/90">
          ✨ <strong>AdChat IA incluido</strong> — copies y mensajes sin gastar créditos
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-white/55 space-y-1">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/40">Consumo por acción</p>
          <p>💳 <strong className="text-white/70">Análisis Panda Score</strong> — 5 créditos</p>
          <p>🎨 <strong className="text-white/70">Generar arte optimizado</strong> — 5 créditos</p>
          <p>🖼️ <strong className="text-white/70">Crear otra versión</strong> — 5 créditos</p>
          <p>📷 <strong className="text-white/70">Foto a Campaña (1 arte)</strong> — 5 créditos</p>
          <p>📷 <strong className="text-white/70">Foto a Campaña (5 artes)</strong> — 20 créditos</p>
        </div>

        {!profile.is_unlimited && (
          <Btn onClick={onOpenCredits} variant="ghost" full>
            💳 Comprar créditos / cambiar plan
          </Btn>
        )}
      </div>
    </SectionCard>
  );
}

// ── TransactionsSection ───────────────────────────────────────────────────────
function TransactionsSection() {
  const [txs,     setTxs]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  const load = async () => {
    if (txs) { setOpen((v) => !v); return; }
    setLoading(true);
    try {
      const res = await authedFetch("/api/me/transactions");
      if (res.ok) {
        const data = await res.json();
        setTxs(data.transactions || []);
        setOpen(true);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const fmt = (amount, type) => {
    const abs = Math.abs(amount);
    // Compat: transacciones viejas de rondas las mostramos como créditos equivalentes
    if (type === "round_debit")   return `−5 cr.`;
    if (type === "round_credit")  return `+5 cr.`;
    if (amount < 0) return `-${abs} cr.`;
    return `+${abs} cr.`;
  };

  return (
    <SectionCard title="Historial de créditos" subtitle="Últimas 50 transacciones.">
      <Btn onClick={load} loading={loading} variant="ghost" full>
        {open ? "Ocultar historial" : "Ver historial"}
      </Btn>
      {open && txs && (
        <div className="mt-4 max-h-72 overflow-y-auto space-y-2 pr-1">
          {txs.length === 0 && (
            <p className="text-center text-sm text-white/30 py-4">Sin transacciones aún.</p>
          )}
          {txs.map((tx) => {
            const date = new Date(tx.created_at).toLocaleDateString("es-PR", { day: "2-digit", month: "short" });
            const positive = tx.amount >= 0;
            return (
              <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white/70">{tx.description || tx.transaction_type}</p>
                  <p className="text-[10px] text-white/30">{date}</p>
                </div>
                <span className={`flex-shrink-0 text-xs font-black ${positive ? "text-emerald-300" : "text-red-300"}`}>
                  {fmt(tx.amount, tx.transaction_type)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ── DangerZone ────────────────────────────────────────────────────────────────
function DangerZone({ onLogout }) {
  return (
    <div className="rounded-[24px] border border-red-400/15 bg-red-500/[0.04] p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
      <h3 className="mb-1 text-base font-black text-red-300">Zona de peligro</h3>
      <p className="mb-5 text-xs text-white/35">Estas acciones son irreversibles. Procede con cuidado.</p>
      <div className="space-y-3">
        <Btn onClick={onLogout} variant="danger" full>
          Cerrar sesión
        </Btn>
        <p className="text-center text-[11px] text-white/25">
          Para eliminar tu cuenta permanentemente, contáctanos en soporte.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function AccountSettings({ session, profile: initialProfile, onProfileUpdate, onOpenCredits, onLogout }) {
  const [profile, setProfile] = useState(initialProfile);

  // Sync when parent profile changes (e.g., after refreshProfile())
  useEffect(() => { setProfile(initialProfile); }, [initialProfile]);

  const handleUpdate = (patch) => {
    setProfile((p) => ({ ...p, ...patch }));
    if (onProfileUpdate) onProfileUpdate(patch);
  };

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-5 sm:max-w-2xl lg:max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black sm:text-3xl">Configuración de cuenta</h2>
        <p className="mt-1 text-[13px] text-white/40">Administra tu perfil, seguridad y suscripción.</p>
      </div>

      <AvatarSection   profile={profile} session={session} onUpdate={handleUpdate} />
      <NameSection     profile={profile} session={session} onUpdate={handleUpdate} />
      <EmailSection    session={session} />
      <PasswordSection />
      <PlanSection     profile={profile} onOpenCredits={onOpenCredits} />
      <TransactionsSection />
      <DangerZone      onLogout={onLogout} />
    </div>
  );
}
