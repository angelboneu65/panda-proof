import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  supabase, supabaseEnabled, getSession, signOut,
  saveAnalysis, listAnalyses, deleteAnalysis, rowToAnalysis,
  saveCampaign, updateCampaign, listCampaigns, getCampaign, deleteCampaign,
  saveResult, listResults, deleteResult,
} from "./supabase";
import AuthView from "./AuthView";
import { CreateView, CampaignFlow } from "./CampaignFlow";
import { BRAND } from "./brand";
import ChatBubble from "./ChatBubble";
import AdminPanel from "./AdminPanel";
import CreditsModal from "./CreditsModal";
import AccountSettings from "./AccountSettings";
import CommunityView from "./CommunityView";
import { useProfile } from "./useProfile";
import { onInsufficientCredits, onCreditCharge } from "./api";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// ── Score gradient ring ───────────────────────────────────────────────────────
const scoreGradient = (s) =>
  s >= 90 ? "from-emerald-400 to-green-500"
  : s >= 80 ? "from-cyan-400 to-teal-400"
  : s >= 70 ? "from-yellow-400 to-amber-400"
  : s >= 60 ? "from-orange-400 to-amber-500"
  : s >= 40 ? "from-orange-500 to-red-500"
  : "from-red-500 to-red-700";

// Score badge class (based on numeric score)
const scoreBadgeClass = (score) => {
  if (score >= 85) return "border-emerald-400/30 bg-emerald-400/15 text-emerald-300";
  if (score >= 70) return "border-cyan-400/30 bg-cyan-400/15 text-cyan-300";
  if (score >= 50) return "border-amber-400/30 bg-amber-400/15 text-amber-300";
  return "border-red-400/30 bg-red-400/15 text-red-300";
};

// Status colors per category status
const STATUS_COLORS = {
  excellent:  { bg: "bg-emerald-400/15", text: "text-emerald-300", border: "border-emerald-400/20", bar: "from-emerald-400 to-green-400" },
  good:       { bg: "bg-cyan-400/15",    text: "text-cyan-300",    border: "border-cyan-400/20",    bar: "from-cyan-400 to-teal-400" },
  needs_work: { bg: "bg-amber-400/15",   text: "text-amber-300",   border: "border-amber-400/20",   bar: "from-amber-400 to-yellow-300" },
  weak:       { bg: "bg-red-400/15",     text: "text-red-300",     border: "border-red-400/20",     bar: "from-red-500 to-orange-400" },
};

const accionMeta = (a) =>
  ({
    "Publicarlo como está":     { bg: "bg-emerald-600", icon: "✅" },
    "Hacer ajustes menores":    { bg: "bg-cyan-700",    icon: "🔧" },
    "Rediseñarlo parcialmente": { bg: "bg-orange-600",  icon: "⚠️" },
    "Rediseñarlo completo":     { bg: "bg-red-600",     icon: "🚫" },
  }[a] ?? { bg: "bg-purple-600", icon: "📋" });

// ── ScoreCircle (animates) ────────────────────────────────────────────────────
function ScoreCircle({ score }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let cur = 0;
    const id = setInterval(() => {
      cur = Math.min(cur + Math.ceil(score / 40), score);
      setDisplay(cur);
      if (cur >= score) clearInterval(id);
    }, 25);
    return () => clearInterval(id);
  }, [score]);

  return (
    <div className={`relative flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br ${scoreGradient(score)} p-[3px] shadow-2xl`}>
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#090A13]">
        <span className="text-5xl font-black text-white">{display}</span>
        <span className="text-xs font-semibold text-white/40">/100</span>
        <span className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-white/25">Panda Score</span>
      </div>
    </div>
  );
}

// ── Bar ───────────────────────────────────────────────────────────────────────
function Bar({ value, max = 100, colorClass = "from-cyan-300 via-purple-400 to-pink-400" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${colorClass} transition-all duration-700`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Form fields ───────────────────────────────────────────────────────────────
function Field({ label, placeholder, value, onChange, error, required, hint }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-black text-white/70">
        {label} {required && <span className="text-pink-400">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full rounded-2xl border bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-cyan-400/60 ${
          error ? "border-red-400/60" : "border-white/10"
        }`}
      />
      {hint  && !error && <p className="mt-1 text-[11px] text-white/30">{hint}</p>}
      {error &&           <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, error, required, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-black text-white/70">
        {label} {required && <span className="text-pink-400">*</span>}
      </label>
      <select
        value={value}
        onChange={onChange}
        className={`w-full rounded-2xl border bg-[#0d0f1c] px-4 py-3 text-sm outline-none transition focus:border-cyan-400/60 ${
          error ? "border-red-400/60" : "border-white/10"
        } ${!value ? "text-white/25" : "text-white"}`}
      >
        <option value="" disabled>Seleccionar…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled = false, full = false, small = false }) {
  const base = `rounded-2xl font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${full ? "w-full" : ""} ${small ? "px-4 py-2 text-xs" : "px-5 py-3.5 text-sm"}`;
  const styles = variant === "primary"
    ? "bg-white text-black hover:bg-white/90 active:scale-[0.98]"
    : "border border-white/15 bg-white/5 text-white hover:bg-white/10";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

// ── Rainbow spinner ───────────────────────────────────────────────────────────
function RainbowLogo({ progress = null }) {
  const R = 58, CIRC = 2 * Math.PI * R;
  const offset = progress === null ? 0 : CIRC * (1 - progress / 100);
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg
        className={`absolute inset-0 h-full w-full -rotate-90${progress === null ? " animate-spin" : ""}`}
        style={progress === null ? { animationDuration: "2.5s" } : {}}
        viewBox="0 0 128 128"
      >
        <defs>
          <linearGradient id="rainbow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#ff6b6b" />
            <stop offset="16%"  stopColor="#ffa94d" />
            <stop offset="33%"  stopColor="#ffe066" />
            <stop offset="50%"  stopColor="#69db7c" />
            <stop offset="66%"  stopColor="#4dabf7" />
            <stop offset="83%"  stopColor="#cc5de8" />
            <stop offset="100%" stopColor="#ff6b6b" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="64" cy="64" r={R} fill="none" stroke="url(#rainbow-grad)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={progress === null ? `${CIRC * 0.25}` : `${offset}`}
          style={progress !== null ? { transition: "stroke-dashoffset 0.4s ease-out" } : {}}
        />
      </svg>
      <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-white/10 bg-white shadow-xl"
           style={{ filter: "drop-shadow(0 0 12px rgba(150,80,255,0.4))" }}>
        <img src={BRAND.logo} alt={BRAND.appName} className="h-full w-full object-contain p-1" />
      </div>
    </div>
  );
}

// ── Category card (shows score + collapsible explanation + recommendation) ────
function CategoryCard({ category }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_COLORS[category.status] || STATUS_COLORS.needs_work;
  return (
    <div className={`rounded-2xl border ${cfg.border} bg-white/[0.02] overflow-hidden`}>
      {/* Header — always visible, click to toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-sm font-bold text-white/85">{category.label}</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ${cfg.bg} ${cfg.text}`}>
                {category.statusLabel}
              </span>
              {category.weight > 0 && (
                <span className="text-[10px] text-white/25">{category.weight}% peso</span>
              )}
            </div>
            <Bar value={category.score} max={100} colorClass={cfg.bar} />
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <div className="text-right">
              <span className="text-xl font-black tabular-nums text-white">{category.score}</span>
              <span className="text-xs text-white/30">/100</span>
            </div>
            <span className={`text-white/35 text-xs transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
              ▼
            </span>
          </div>
        </div>
      </button>

      {/* Explanation + Recommendation — collapsible */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/8 pt-3">
          <p className="text-xs leading-relaxed text-white/55">{category.explanation}</p>
          <div className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-xs text-cyan-400">→</span>
            <p className="text-xs leading-relaxed text-cyan-300/75">{category.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── iOS Install Banner — solo en iPhone Safari, no instalado ─────────────────
function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipod|ipad/.test(ua);
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
    const isStandalone = window.navigator.standalone === true ||
                        window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem("pp-ios-install-dismissed");

    if (isIOS && isSafari && !isStandalone && !dismissed) {
      setTimeout(() => setShow(true), 1500);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem("pp-ios-install-dismissed", "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] rounded-3xl border border-white/15 bg-gradient-to-br from-[#0d0f22]/95 to-[#1a0f2e]/95 p-4 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-w-sm">
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20"
        aria-label="Cerrar"
      >✕</button>
      <div className="flex items-start gap-3 pr-8">
        <img src="/logo.png" alt="" className="h-12 w-12 flex-shrink-0 rounded-2xl bg-white object-contain p-0.5 shadow-lg" />
        <div>
          <p className="text-sm font-black">Instala {BRAND.appName} 🐼</p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Toca <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white/15 text-[10px] font-black">⬆︎</span> en Safari y luego{" "}
            <span className="font-black text-white">«Añadir a Inicio»</span> para abrirla como app.
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// UPLOAD VIEW
// ══════════════════════════════════════════════════════════════════════════════
function UploadView({ onAnalyze, globalError }) {
  const [image,      setImage]      = useState(null);
  const [preview,    setPreview]    = useState(null);
  const [dragging,   setDragging]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [errors,     setErrors]     = useState({});
  const [autoFilled, setAutoFilled] = useState(false);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    nicho: "", producto: "", publico: "", plataforma: "", objetivo: "", oferta: "",
  });

  const handleFile = useCallback(async (file) => {
    if (!file?.type.startsWith("image/")) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setErrors((e) => ({ ...e, image: null }));
    setAutoFilled(false);

    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const { authedFetch } = await import("./api");
      const res  = await authedFetch(`/api/extract`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        setForm({
          nicho:      data.data.nicho      || "",
          producto:   data.data.producto   || "",
          publico:    data.data.publico    || "",
          plataforma: data.data.plataforma || "",
          objetivo:   data.data.objetivo   || "",
          oferta:     data.data.oferta     || "",
        });
        setAutoFilled(true);
      }
    } catch (err) {
      console.error("Error al extraer datos:", err.message);
    } finally {
      setExtracting(false);
    }
  }, []);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!image) errs.image = "Sube una imagen para analizar.";
    ["nicho", "producto", "publico", "plataforma", "objetivo"].forEach((k) => {
      if (!form[k].trim()) errs[k] = "Campo requerido";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    await onAnalyze(image, form);
    setLoading(false);
  };

  return (
    <div className="space-y-5">

      {/* ── Hero ── */}
      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black text-cyan-200 sm:mb-4 sm:px-4 sm:py-1.5 sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Director Creativo IA
        </div>
        <h2 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">
          Tu arte puede verse<br className="hidden sm:block" /> bonito… pero,{" "}
          <span className="bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">
            ¿está listo para vender?
          </span>
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50 sm:mt-4 sm:text-base">
          Sube tu diseño y {BRAND.appName} evaluará su claridad, CTA, legibilidad móvil y
          potencial de conversión. Recibirás un diagnóstico honesto y una versión optimizada.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { icon: "🎯", label: "Panda Score" },
            { icon: "🔍", label: "Diagnóstico de CTA" },
            { icon: "📱", label: "Legibilidad móvil" },
            { icon: "📋", label: "Prompt profesional" },
            { icon: "✨", label: "Arte optimizado" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 sm:rounded-2xl sm:px-3 sm:py-2.5">
              <span className="text-sm sm:text-base">{icon}</span>
              <span className="text-[10px] font-bold text-white/55 sm:text-[11px]">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo snippet ── */}
      <section className="rounded-[20px] border border-white/8 bg-white/[0.02] p-3 backdrop-blur-xl sm:rounded-[28px] sm:p-4">
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/25">Ejemplo de resultado</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-2.5">
            <span className="text-2xl font-black text-yellow-300">74</span>
            <div>
              <p className="text-[10px] font-black text-yellow-300/70">Panda Score</p>
              <p className="text-[10px] text-white/35">Bueno, pero puede convertir mejor</p>
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-xs font-bold text-white/50">
              <span className="text-red-400">⚠</span> El CTA compite con demasiados elementos.
            </p>
            <p className="mt-1 text-[11px] text-white/30">
              → Simplificar a 3 niveles: titular, oferta y CTA dominante.
            </p>
          </div>
        </div>
      </section>

      {globalError && (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm text-red-300">
          ⚠️ {globalError}
        </div>
      )}

      {/* ── Upload + Context columns ── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_370px]">

        {/* LEFT — image drop */}
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
          <h3 className="mb-1 text-lg font-black">Sube tu arte</h3>
          <p className="mb-4 text-xs text-white/40 sm:mb-5">PNG, JPG o captura de pantalla. Máx 20 MB.</p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => !preview && fileRef.current?.click()}
            className={`relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[24px] border-2 transition-all ${
              errors.image ? "border-red-400/50 bg-red-400/5"
              : dragging   ? "border-cyan-400 bg-cyan-400/10"
              : preview    ? "cursor-default border-white/10 bg-transparent"
              : "border-dashed border-white/20 bg-black/25 hover:border-white/40"
            }`}
          >
            {preview ? (
              <>
                <img src={preview} alt="Vista previa" className="max-h-[400px] w-full object-contain" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImage(null); setPreview(null); setAutoFilled(false);
                    setForm({ nicho: "", producto: "", publico: "", plataforma: "", objetivo: "", oferta: "" });
                  }}
                  className="absolute right-3 top-3 rounded-xl bg-black/70 px-3 py-1.5 text-xs font-black text-white/80 hover:bg-black/90"
                >
                  Cambiar
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 shadow-xl">
                  <span className="text-4xl">+</span>
                </div>
                <div>
                  <p className="text-2xl font-black">Sube tu diseño</p>
                  <p className="mt-2 text-sm text-white/40">
                    <span className="hidden sm:inline">Arrastra o </span>toca para seleccionar
                  </p>
                </div>
                <p className="text-[11px] text-white/25">{BRAND.appName} detectará el contexto automáticamente</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => handleFile(e.target.files[0])} />
          {errors.image && <p className="mt-2 text-xs text-red-400">{errors.image}</p>}
        </div>

        {/* RIGHT — context form */}
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="text-lg font-black">Contexto detectado</h3>
            {extracting && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-black text-cyan-300">
                <span className="h-2 w-2 animate-spin rounded-full border-2 border-transparent border-t-cyan-300" />
                Leyendo…
              </span>
            )}
            {autoFilled && !extracting && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-300">
                ✓ Auto-detectado
              </span>
            )}
          </div>

          <div className="mb-5 rounded-2xl border border-cyan-400/10 bg-cyan-400/5 px-4 py-3">
            <p className="text-[11px] leading-relaxed text-cyan-200/70">
              {!image
                ? `🔍 Al subir tu imagen, ${BRAND.appName} detectará el negocio, producto, público y objetivo automáticamente. Podrás editar antes del análisis.`
                : extracting
                ? "🔍 Detectando contexto de tu arte…"
                : autoFilled
                ? "✅ Contexto detectado automáticamente. Revisa y ajusta si algo no está correcto."
                : "✏️ Completa el contexto para que el análisis sea más preciso."}
            </p>
          </div>

          <div className="space-y-4">
            <Field label="Tipo de negocio" placeholder="Ej: Spa, Restaurante, Clínica…"
              value={form.nicho} onChange={set("nicho")} error={errors.nicho} required />
            <Field label="¿Qué se está vendiendo?" placeholder="Ej: Masaje relajante 60 min"
              value={form.producto} onChange={set("producto")} error={errors.producto} required />
            <Field label="Público objetivo" placeholder="Ej: Mujeres 25–45 años"
              value={form.publico} onChange={set("publico")} error={errors.publico} required />
            <SelectField label="Plataforma destino" value={form.plataforma}
              onChange={set("plataforma")} error={errors.plataforma} required
              options={["Instagram Stories","Instagram Feed","Facebook","TikTok",
                        "WhatsApp Status","Google Ads","Web / Landing page","Impreso / Flyer"]} />
            <SelectField label="Objetivo de conversión" value={form.objetivo}
              onChange={set("objetivo")} error={errors.objetivo} required
              options={["Mensajes / WhatsApp","Ventas directas","Reservas","Llamadas",
                        "Tráfico web","Reconocimiento de marca","Captación de leads"]} />
            <Field label="Oferta o precio (opcional)" placeholder="Ej: 50% OFF, desde $29, 2×1"
              value={form.oferta} onChange={set("oferta")}
              hint="Si hay una promoción visible en el arte, detállala aquí" />
          </div>

          <div className="mt-6 space-y-3">
            <Btn onClick={handleSubmit} disabled={loading || extracting} full>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Analizando…
                </span>
              ) : extracting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Detectando contexto…
                </span>
              ) : "🐼 Obtener mi Panda Score"}
            </Btn>
            <p className="text-center text-[11px] text-white/30">El análisis toma entre 15 y 30 segundos</p>
          </div>
        </div>
      </div>

      {/* ── How it works ── */}
      <section className="rounded-[20px] border border-white/8 bg-white/[0.02] p-4 backdrop-blur-xl sm:rounded-[28px] sm:p-5">
        <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-white/25">Así funciona</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { n: "1", label: "Sube tu arte" },
            { n: "2", label: "Panda detecta el contexto" },
            { n: "3", label: "Revisa o ajusta" },
            { n: "4", label: "Obtén tu Panda Score" },
            { n: "5", label: "Arte mejorado listo" },
          ].map(({ n, label }) => (
            <div key={n} className="flex items-center gap-2">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-black text-white/60">{n}</span>
              <span className="text-[11px] font-bold text-white/45">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYZING VIEW
// ══════════════════════════════════════════════════════════════════════════════
function AnalyzingView() {
  const [tick, setTick] = useState(0);
  const steps = [
    "Detectando nicho y contexto del arte…",
    "Evaluando jerarquía visual y estructura…",
    "Midiendo legibilidad móvil…",
    "Analizando fuerza del mensaje y la oferta…",
    "Evaluando CTA y potencial de conversión…",
    "Calculando tu Panda Score…",
  ];
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % steps.length), 1900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center sm:min-h-[70vh] sm:gap-8">
      <RainbowLogo progress={null} />
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black text-cyan-200 sm:mb-4 sm:px-4 sm:py-2 sm:text-xs">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
          Analizando tu arte…
        </div>
        <h2 className="text-xl font-black sm:text-2xl md:text-4xl">Tu director creativo IA trabajando</h2>
        <p className="mt-3 min-h-[3rem] text-sm leading-relaxed text-white/50 transition-all">{steps[tick]}</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULTS VIEW
// ══════════════════════════════════════════════════════════════════════════════
function ResultsView({ analysis, preview, imageFile, formData, onSaveResult }) {
  // Destructure FIRST so all variables are available to hooks below
  const {
    pandaScore            = 0,
    shortLabel            = "—",
    scoreLabel            = "",
    scoreInterpretation   = "",
    profileApplied        = "",
    platformDetected      = "",
    accionRecomendada     = "",
    activeWeights         = {},
    categories            = {},
    mainProblemsDetected  = [],
    topRecommendations    = [],
    regenerationPriorities = [],
    regenerationPrompt    = "",
  } = analysis;
  const analysisId = analysis.id || null;

  const [generating,     setGenerating]     = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [genError,       setGenError]       = useState(null);
  const [genTick,        setGenTick]        = useState(0);
  const [genProgress,    setGenProgress]    = useState(0);
  const [genAnalyzing,   setGenAnalyzing]   = useState(false);
  const [genScore,       setGenScore]       = useState(null);
  const [genShortLabel,  setGenShortLabel]  = useState(null);
  const [customPrompt,   setCustomPrompt]   = useState(regenerationPrompt || "");
  const [showDetails,    setShowDetails]    = useState(false);
  const [showCreateAnother, setShowCreateAnother] = useState(false);
  const [savedId,        setSavedId]        = useState(null);
  const [copiedPrompt,   setCopiedPrompt]   = useState(false);

  // Re-populate textarea if a different analysis is loaded (e.g. from history)
  useEffect(() => {
    setCustomPrompt(regenerationPrompt || "");
  }, [regenerationPrompt]);

  // Reset save state when a new image is generated
  useEffect(() => { setSavedId(null); }, [generatedImage]);

  const genSteps = [
    "Preservando concepto e identidad del arte…",
    "Aplicando correcciones de jerarquía visual…",
    "Ajustando legibilidad y contraste…",
    "Reforzando el CTA para conversión…",
    "Optimizando composición para móvil…",
    "Añadiendo toques finales de calidad…",
  ];

  const meta = accionMeta(accionRecomendada);

  // Sort categories by weight (most important first)
  const sortedCategories = Object.entries(categories)
    .sort(([a], [b]) => (activeWeights[b] ?? 0) - (activeWeights[a] ?? 0));

  const analyzeGeneratedImage = async (base64DataUrl) => {
    if (!formData) return;
    setGenAnalyzing(true);
    try {
      const fetchRes = await fetch(base64DataUrl);
      const blob     = await fetchRes.blob();
      const fd = new FormData();
      fd.append("image", blob, "arte-mejorado.png");
      Object.entries(formData).forEach(([k, v]) => v && fd.append(k, v));
      const { authedFetch } = await import("./api");
      const res  = await authedFetch(`/api/analyze`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Error");
      setGenScore(data.analysis.pandaScore);
      setGenShortLabel(data.analysis.shortLabel);
    } catch (err) {
      console.error("Error analizando imagen generada:", err.message);
    } finally {
      setGenAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!imageFile) return;
    setGenerating(true);
    setGenError(null);
    setGeneratedImage(null);
    setGenScore(null);
    setGenShortLabel(null);
    setGenProgress(0);

    const tickId = setInterval(() => setGenTick((t) => (t + 1) % genSteps.length), 3500);
    const TOTAL_MS = 80000, INTERVAL = 400, MAX_AUTO = 92;
    let elapsed = 0;
    const progressId = setInterval(() => {
      elapsed += INTERVAL;
      setGenProgress(Math.min(MAX_AUTO, Math.round((elapsed / TOTAL_MS) * MAX_AUTO)));
    }, INTERVAL);

    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      if (formData) Object.entries(formData).forEach(([k, v]) => v && fd.append(k, v));
      if (mainProblemsDetected.length)    fd.append("problemas",      mainProblemsDetected.join("; "));
      if (topRecommendations.length)      fd.append("recomendaciones", topRecommendations.join("; "));
      if (regenerationPriorities.length)  fd.append("mejoras",         regenerationPriorities.join("; "));
      if (regenerationPrompt)             fd.append("briefing",         regenerationPrompt);
      if (customPrompt.trim())            fd.append("customInstructions", customPrompt.trim());

      const { authedFetch } = await import("./api");
      const res  = await authedFetch(`/api/generate`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Error al generar imagen");
      setGenProgress(100);
      setGeneratedImage(data.image);
      analyzeGeneratedImage(data.image);
    } catch (err) {
      setGenError(err.message);
    } finally {
      clearInterval(tickId);
      clearInterval(progressId);
      setGenerating(false);
    }
  };

  const handleSaveResult = async () => {
    if (savedId || !generatedImage || !onSaveResult) return;
    const id = await onSaveResult({
      imageUrl:          generatedImage,
      type:              "optimized",
      title:             formData?.producto || analysis.contextUsed?.whatIsBeingSold || "Arte optimizado",
      prompt:            customPrompt || regenerationPrompt || "",
      sourceFlow:        "analysis_result",
      relatedAnalysisId: analysisId,
    });
    if (id) setSavedId(id);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(customPrompt || regenerationPrompt || "");
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (e) { /* ignore */ }
  };

  // Reset state when starting a new generation
  const handleStartGeneration = () => {
    setShowCreateAnother(false);
    handleGenerate();
  };

  return (
    <div className="space-y-5">

      {/* 1. Header — sin botones de acción */}
      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-block rounded-full border px-3 py-1 text-xs font-black ${scoreBadgeClass(pandaScore)}`}>
            {shortLabel}
          </span>
          {profileApplied && (
            <span className="inline-block rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-[10px] font-black text-purple-300">
              {profileApplied}
            </span>
          )}
          {platformDetected && (
            <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold text-white/40">
              📱 {platformDetected}
            </span>
          )}
        </div>
        <h2 className="mt-2 text-2xl font-black sm:text-3xl">Análisis completado</h2>
        {scoreLabel && <p className="mt-1 text-sm text-white/40">{scoreLabel}</p>}
      </section>

      {/* 2. Score circle + acción recomendada */}
      <section className="flex flex-col items-center gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-center backdrop-blur-xl sm:rounded-[32px] sm:p-6">
        <ScoreCircle score={pandaScore} />
        {scoreInterpretation && (
          <p className="max-w-md text-sm leading-relaxed text-white/55">{scoreInterpretation}</p>
        )}
        <div className={`w-full max-w-md rounded-2xl py-2.5 text-sm font-black text-white ${meta.bg}`}>
          {meta.icon} {accionRecomendada}
        </div>
      </section>

      {/* 3. Imagen original */}
      {preview && (
        <section className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl sm:rounded-[32px] sm:p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/30">Arte original</p>
          <img src={preview} alt="Arte original" className="mx-auto w-full max-w-2xl rounded-2xl object-contain" />
          <div className="mt-3 text-center">
            <span className={`inline-block rounded-full border px-3 py-1 text-xs font-black ${scoreBadgeClass(pandaScore)}`}>
              Score: {pandaScore}/100
            </span>
          </div>
        </section>
      )}

      {/* 4a. Estado: SIN imagen optimizada todavía → CTA para generar */}
      {!generatedImage && !generating && !genError && (
        <section className="rounded-[24px] border border-purple-400/20 bg-gradient-to-br from-purple-600/10 via-pink-500/5 to-cyan-500/10 p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
          <div className="mb-5 flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-400 text-3xl shadow-lg">🎨</div>
            <div>
              <p className="text-lg font-black">Arte optimizado en segundos</p>
              <p className="mt-1 max-w-sm text-sm text-white/40">
                El sistema preserva tu concepto, logo y persona principal — solo mejora lo que afecta la conversión.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-black text-white/70">
                Instrucciones adicionales <span className="font-bold text-white/30">opcional</span>
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ej: Mantén el diseño en horizontal, no cambies la modelo, agrega una etiqueta con el descuento…"
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-cyan-400/60"
              />
              <p className="mt-1 text-[10px] text-white/30">Indica detalles específicos que quieras conservar o modificar.</p>
            </div>
            <Btn onClick={handleGenerate} full>🎨 Generar arte optimizado</Btn>
          </div>
        </section>
      )}

      {/* 4b. Estado: GENERANDO */}
      {generating && (
        <section className="rounded-[24px] border border-purple-400/20 bg-gradient-to-br from-purple-600/10 via-pink-500/5 to-cyan-500/10 p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <RainbowLogo progress={genProgress} />
            <span className="text-xs font-black tabular-nums text-white/60">{genProgress}%</span>
            <div>
              <p className="text-lg font-black text-white">Optimizando tu arte…</p>
              <p className="mt-2 text-sm text-white/50 transition-all duration-700">{genSteps[genTick]}</p>
            </div>
          </div>
        </section>
      )}

      {/* 4c. Estado: ERROR */}
      {genError && !generating && (
        <section className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-center">
          <p className="text-sm font-bold text-red-300">⚠️ {genError}</p>
          {genError.includes("OPENAI_API_KEY") && (
            <p className="mt-2 text-xs text-white/40">
              Agrega tu clave de OpenAI como <code className="text-cyan-300">OPENAI_API_KEY=sk-...</code> en las variables de entorno de Render.
            </p>
          )}
          <div className="mt-4"><Btn onClick={handleGenerate}>Intentar de nuevo</Btn></div>
        </section>
      )}

      {/* 5. Arte optimizado (cuando existe) */}
      {generatedImage && !generating && (
        <section className="overflow-hidden rounded-[24px] border border-purple-400/30 bg-white/[0.04] p-3 backdrop-blur-xl sm:rounded-[32px] sm:p-4">
          <p className="mb-3 text-center text-[10px] font-black uppercase tracking-widest text-purple-300">✨ Arte optimizado</p>
          <img src={generatedImage} alt="Arte optimizado" className="mx-auto w-full max-w-2xl rounded-2xl object-contain" />
          <div className="mt-3 flex justify-center">
            {genAnalyzing ? (
              <span className="flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-400/15 px-3 py-1 text-xs font-black text-purple-300">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-transparent border-t-purple-300" />
                Calculando nuevo score…
              </span>
            ) : genScore !== null ? (
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${scoreBadgeClass(genScore)}`}>
                Score: {genScore}/100 — {genShortLabel}
              </span>
            ) : (
              <span className="rounded-full border border-purple-400/30 bg-purple-400/15 px-3 py-1 text-xs font-black text-purple-300">
                ✨ Optimizado con IA
              </span>
            )}
          </div>
        </section>
      )}

      {/* 6. ACCIONES DEL RESULTADO (solo cuando hay imagen optimizada) */}
      {generatedImage && !generating && (
        <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
          <h3 className="text-lg font-black sm:text-xl">Acciones del resultado</h3>
          <p className="mt-1 text-xs text-white/40">Guarda tu arte optimizado o crea una nueva versión.</p>

          {/* Primary button — Guardar */}
          <div className="mt-5">
            <Btn full onClick={handleSaveResult} disabled={!!savedId || !onSaveResult}>
              {savedId ? "✓ Guardado en resultados" : "Guardar en resultados"}
            </Btn>
            {!onSaveResult && (
              <p className="mt-2 text-center text-[10px] text-white/30">Inicia sesión para guardar tus resultados.</p>
            )}
          </div>

          {/* Secondary row */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Btn variant="ghost" full onClick={handleCopyPrompt}>
              {copiedPrompt ? "✓ Copiado" : "📋 Copiar prompt"}
            </Btn>
            <Btn variant="ghost" full onClick={() => setShowCreateAnother((v) => !v)}>
              🔄 Crear otra versión
            </Btn>
          </div>

          {/* Crear otra versión — inline editable */}
          {showCreateAnother && (
            <div className="mt-4 rounded-2xl border border-purple-400/20 bg-purple-400/5 p-4">
              <label className="mb-1.5 block text-xs font-black text-white/70">
                Comando para regenerar <span className="font-bold text-white/30">opcional</span>
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ej: Hazlo más vibrante, agranda el CTA, cambia el fondo a azul…"
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-purple-400/60"
              />
              <p className="mb-3 mt-1 text-[10px] text-white/30">Dile a la IA qué corregir si quieres una variante distinta.</p>
              <Btn full onClick={handleStartGeneration}>🎨 Generar nueva versión</Btn>
            </div>
          )}

          {/* Tertiary — Ver detalles */}
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="mt-5 flex w-full items-center justify-center gap-2 text-xs font-black text-white/45 transition hover:text-white/80"
          >
            Ver detalles del análisis
            <span className={`transition-transform ${showDetails ? "rotate-180" : ""}`}>▾</span>
          </button>
        </section>
      )}

      {/* 7. Detalles del análisis — visible siempre antes de generar, ocultable después */}
      {(showDetails || !generatedImage) && (
        <div className="space-y-5">
          {/* Problemas + Recomendaciones */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-red-400/15 bg-red-400/5 p-4 backdrop-blur-xl sm:rounded-[32px] sm:p-5">
              <h3 className="mb-3 text-sm font-black text-red-300 sm:mb-4">⚠️ Problemas detectados</h3>
              <ul className="space-y-2.5 sm:space-y-3">
                {mainProblemsDetected.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-white/65">
                    <span className="mt-0.5 flex-shrink-0 text-red-400">▸</span>{item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/5 p-4 backdrop-blur-xl sm:rounded-[32px] sm:p-5">
              <h3 className="mb-3 text-sm font-black text-emerald-300 sm:mb-4">✅ Recomendaciones</h3>
              <ul className="space-y-2.5 sm:space-y-3">
                {topRecommendations.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-white/65">
                    <span className="mt-0.5 flex-shrink-0 text-emerald-400">▸</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Panda Score Desglose */}
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">Panda Score — Desglose</h3>
                <p className="mt-0.5 text-[10px] text-white/30">10 criterios evaluados, ponderados por objetivo</p>
              </div>
              {profileApplied && (
                <span className="max-w-[120px] text-right text-[10px] font-black leading-snug text-white/20">{profileApplied}</span>
              )}
            </div>
            <div className="space-y-3">
              {sortedCategories.length > 0
                ? sortedCategories.map(([key, cat]) => (
                    <CategoryCard key={key} category={cat} />
                  ))
                : <p className="text-sm text-white/30">No hay datos de categorías disponibles.</p>
              }
            </div>
          </div>

          {/* Prioridades de regeneración */}
          {regenerationPriorities.length > 0 && (
            <div className="rounded-[20px] border border-purple-400/15 bg-purple-400/5 p-4 backdrop-blur-xl sm:rounded-[28px] sm:p-5">
              <h3 className="mb-3 text-sm font-black text-purple-300">🎯 Prioridades de regeneración</h3>
              <ol className="space-y-2">
                {regenerationPriorities.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm text-white/60">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-400/20 text-[10px] font-black text-purple-300">{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HISTORY VIEW
// ══════════════════════════════════════════════════════════════════════════════
function HistoryCard({ row, onLoad, onDelete }) {
  const a = rowToAnalysis(row);
  const meta = accionMeta(a.accionRecomendada);
  const date = new Date(a.createdAt).toLocaleDateString("es-PR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="group relative w-full rounded-[20px] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl transition hover:border-white/20">
      <button
        onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar este análisis?")) onDelete(a.id); }}
        className="absolute right-3 top-3 z-10 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-black text-white/60 opacity-100 transition hover:bg-red-600/50 hover:text-red-200 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Eliminar"
      >✕</button>

      <div onClick={() => onLoad(row)} className="cursor-pointer">
        {/* Header: score badge + nicho + fecha */}
        <div className="flex items-start gap-3 pr-8">
          <div
            className={`flex flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${scoreGradient(a.pandaScore)} font-black text-white shadow-lg`}
            style={{ width: 56, height: 56, fontSize: 20 }}
          >
            {a.pandaScore}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-snug text-white/90 break-words">
              {a.contextUsed.businessType || "Sin contexto"}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-white/55 break-words line-clamp-2">
              {a.contextUsed.whatIsBeingSold || "—"}
            </p>
            <p className="mt-1 text-[11px] text-white/30">{date}</p>
          </div>
        </div>

        {/* Estado + Objetivo (con etiquetas) */}
        <div className="mt-3 space-y-1 text-[13px] text-white/55">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-white/30">Estado:</span>
            <span className="font-bold">{a.shortLabel || "—"}</span>
          </div>
          {a.profileApplied && (
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-white/30">Objetivo:</span>
              <span className="break-words">{a.profileApplied}</span>
            </div>
          )}
        </div>

        {/* Acción recomendada - compacta */}
        <div className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-black text-white ${meta.bg}`}>
          <span>{meta.icon}</span>
          <span className="break-words text-center">{a.accionRecomendada}</span>
        </div>
      </div>
    </div>
  );
}

function SavedResultCard({ row, onDelete }) {
  const date = new Date(row.created_at).toLocaleDateString("es-PR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="group relative w-full overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl transition hover:border-white/20">
      <button
        onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar este resultado?")) onDelete(row.id); }}
        className="absolute right-3 top-3 z-10 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-black text-white/60 opacity-100 transition hover:bg-red-600/50 hover:text-red-200 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Eliminar"
      >✕</button>

      {row.image_url && (
        <div className="overflow-hidden rounded-2xl bg-black/30">
          <img
            src={row.image_url}
            alt={row.title || "Arte"}
            className="block w-full object-contain"
            style={{ maxHeight: "520px", height: "auto" }}
          />
        </div>
      )}

      <div className="mt-3 flex items-start gap-2">
        {row.type === "campaign_ad"
          ? <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-purple-400/30 bg-purple-400/10 px-2 py-0.5 text-[10px] font-black text-purple-300">📷 Campaña</span>
          : <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-black text-emerald-300">✨ Optimizado</span>
        }
        <span className="text-[10px] text-white/30 ml-auto">{date}</span>
      </div>
      <p className="mt-1.5 text-[14px] font-bold leading-snug text-white/90 break-words">
        {row.title || "Arte optimizado"}
      </p>
    </div>
  );
}

function CampaignHistoryCard({ row, onLoad, onDelete }) {
  const date = new Date(row.created_at).toLocaleDateString("es-PR", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <div className="group relative w-full overflow-hidden rounded-[20px] border border-purple-400/15 bg-gradient-to-br from-purple-600/10 via-pink-500/5 to-cyan-500/10 p-4 backdrop-blur-xl transition hover:border-purple-400/35">
      <button
        onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar esta campaña?")) onDelete(row.id); }}
        className="absolute right-3 top-3 z-10 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-black text-white/60 opacity-100 transition hover:bg-red-600/50 hover:text-red-200 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Eliminar"
      >✕</button>

      <div onClick={() => onLoad(row.id)} className="cursor-pointer pr-8">
        <div className="flex items-start gap-3">
          {row.thumbnail ? (
            <div className="flex-shrink-0 overflow-hidden rounded-2xl bg-black/30 ring-1 ring-white/10" style={{ width: 56, height: 56 }}>
              <img src={row.thumbnail} alt="" className="block h-full w-full object-contain" />
            </div>
          ) : (
            <div className="flex flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 text-2xl shadow-lg" style={{ width: 56, height: 56 }}>📷</div>
          )}
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded-full border border-purple-300/30 bg-purple-300/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-purple-200">Campaña</span>
            <p className="mt-1.5 text-[15px] font-bold leading-snug text-white/90 break-words">{row.product_name || "Sin nombre"}</p>
            <p className="mt-0.5 text-[13px] text-white/55 break-words">
              {row.niche || "—"}{row.city ? ` · ${row.city}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-white/30">{date}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ history, campaigns, savedResults, onLoad, onDelete, onLoadCampaign, onDeleteCampaign, onDeleteResult, onReset }) {
  const totalCount = history.length + campaigns.length + (savedResults?.length || 0);
  const recentResults = (savedResults || []).slice(0, 3);

  if (totalCount === 0) {
    return (
      <div className="mx-auto w-full max-w-[430px] space-y-5 sm:max-w-2xl lg:max-w-none">
        <div>
          <h2 className="text-2xl font-black sm:text-3xl">Mis análisis</h2>
          <p className="mt-1 text-[13px] text-white/40">Aquí aparecerán tus análisis, campañas y resultados guardados.</p>
        </div>
        <Btn full onClick={onReset}>+ Nuevo análisis</Btn>
        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center sm:p-12">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 text-3xl">📊</div>
          <p className="text-base font-black text-white sm:text-lg">Aún no has guardado nada</p>
          <p className="mt-2 mx-auto max-w-md text-[13px] text-white/40">Cada Panda Score, campaña y arte optimizado que generes se guarda aquí automáticamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-7 sm:max-w-2xl lg:max-w-none">

      {/* Título + contador + botón nuevo */}
      <div className="space-y-3">
        <div>
          <h2 className="text-2xl font-black sm:text-3xl">Mis análisis</h2>
          <p className="mt-1 text-[13px] leading-snug text-white/40">
            {history.length} {history.length === 1 ? "análisis" : "análisis"}
            {" · "}
            {campaigns.length} {campaigns.length === 1 ? "campaña" : "campañas"}
            {" · "}
            {savedResults?.length || 0} {(savedResults?.length || 0) === 1 ? "resultado" : "resultados"}
          </p>
        </div>
        <Btn full onClick={onReset}>+ Nuevo análisis</Btn>
      </div>

      {/* Resultados optimizados — máximo 3 más recientes */}
      {recentResults.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-[15px] font-black text-white/90">Resultados optimizados</h3>
            <p className="text-[12px] text-white/40">Últimas imágenes guardadas</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentResults.map((row) => (
              <SavedResultCard key={row.id} row={row} onDelete={onDeleteResult} />
            ))}
          </div>
          {savedResults.length > 3 && (
            <p className="text-center text-[11px] text-white/30">
              Mostrando 3 más recientes de {savedResults.length}
            </p>
          )}
        </section>
      )}

      {/* Campañas */}
      {campaigns.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-[15px] font-black text-white/90">Campañas Foto a Campaña</h3>
            <p className="text-[12px] text-white/40">Toca una para abrir los 5 anuncios</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((row) => (
              <CampaignHistoryCard key={row.id} row={row} onLoad={onLoadCampaign} onDelete={onDeleteCampaign} />
            ))}
          </div>
        </section>
      )}

      {/* Análisis de Panda Score */}
      {history.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-[15px] font-black text-white/90">Análisis de Panda Score</h3>
            <p className="text-[12px] text-white/40">Toca un análisis para abrir el resultado completo</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((row) => (
              <HistoryCard key={row.id} row={row} onLoad={onLoad} onDelete={onDelete} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession]     = useState(null);
  const [authReady, setAuthReady] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    getSession().then((s) => { setSession(s); setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070812]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
      </div>
    );
  }

  return (
    <>
      {supabaseEnabled && !session
        ? <AuthView onSuccess={setSession} />
        : <MainApp session={session} />}
      <ChatBubble />
    </>
  );
}

// ── Main app shell (after auth) ───────────────────────────────────────────────
function MainApp({ session }) {
  const [view,      setView]      = useState("create"); // create | upload | analyzing | results | history | campaign | admin | account | community
  const [creditsModal, setCreditsModal] = useState({ open: false, info: null });
  const [chargeToast, setChargeToast]   = useState(null);
  const { profile, creditsEnabled, refresh: refreshProfile } = useProfile(session);

  // Listener global: cuando un endpoint devuelve 402, abrimos el modal de créditos
  useEffect(() => {
    onInsufficientCredits((info) => setCreditsModal({ open: true, info }));
    return () => onInsufficientCredits(null);
  }, []);

  // Listener global: cuando se cobran créditos, refresca perfil y muestra toast
  useEffect(() => {
    onCreditCharge((info) => {
      refreshProfile();
      const label =
        info.type === "round"      ? `Se descontó 1 ronda de imágenes.`
      : info.type === "credits"    ? `Se descontaron ${info.charged} créditos.`
      : info.type === "unlimited"  ? null  // admin/unlimited no muestra toast
                                   : `Cobro registrado.`;
      if (label) {
        setChargeToast(label);
        setTimeout(() => setChargeToast(null), 4000);
      }
    });
    return () => onCreditCharge(null);
  }, [refreshProfile]);

  // Si volvemos del checkout de Stripe con ?checkout=success, refrescamos
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      // Damos un par de segundos al webhook para procesar
      setTimeout(() => refreshProfile(), 2500);
      // Limpiamos el query string
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const isAdmin = profile?.role === "admin" || profile?.is_unlimited === true;
  const [preview,   setPreview]   = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [analysis,  setAnalysis]  = useState(null);
  const [formData,  setFormData]  = useState(null);
  const [error,     setError]     = useState(null);
  const [history,   setHistory]   = useState([]);
  const [campaignHistory, setCampaignHistory] = useState([]);
  const [loadedCampaign,  setLoadedCampaign]  = useState(null); // datos cargados desde historial
  const [savedResults,    setSavedResults]    = useState([]);   // últimos 20 resultados guardados

  const userName = session?.user?.user_metadata?.name
    || session?.user?.email?.split("@")[0]
    || "Tú";

  // Load history (analyses + campaigns + saved results) on mount
  useEffect(() => {
    if (!supabaseEnabled || !session) return;
    listAnalyses().then(setHistory);
    listCampaigns().then(setCampaignHistory);
    listResults().then(setSavedResults);
  }, [session?.user?.id]);

  const refreshSavedResults = useCallback(async () => {
    if (!supabaseEnabled || !session) return;
    const rows = await listResults();
    setSavedResults(rows);
  }, [session?.user?.id]);

  // Callbacks para ResultsView
  const handleSaveResult = async (result) => {
    if (!supabaseEnabled || !session) return null;
    const row = await saveResult(result);
    if (row) refreshSavedResults();
    return row?.id || null;
  };

  const handleDeleteResult = async (id) => {
    await deleteResult(id);
    setSavedResults((r) => r.filter((row) => row.id !== id));
  };

  const refreshHistory = useCallback(async () => {
    if (!supabaseEnabled || !session) return;
    const rows = await listAnalyses();
    setHistory(rows);
  }, [session?.user?.id]);

  const refreshCampaigns = useCallback(async () => {
    if (!supabaseEnabled || !session) return;
    const rows = await listCampaigns();
    setCampaignHistory(rows);
  }, [session?.user?.id]);

  // Callbacks para CampaignFlow
  const handleSaveCampaign = async (data) => {
    if (!supabaseEnabled || !session) return null;
    const row = await saveCampaign(data);
    if (row) refreshCampaigns();
    return row?.id || null;
  };

  const handleUpdateCampaign = async (id, data) => {
    if (!supabaseEnabled || !session) return;
    await updateCampaign(id, data);
    refreshCampaigns();
  };

  const handleLoadCampaign = async (rowId) => {
    const full = await getCampaign(rowId);
    if (!full) return;
    setLoadedCampaign({ ...full.data, savedId: full.id });
    setView("campaign");
  };

  const handleDeleteCampaign = async (id) => {
    await deleteCampaign(id);
    setCampaignHistory((h) => h.filter((r) => r.id !== id));
  };

  const handleAnalyze = async (file, form) => {
    setImageFile(file);
    setFormData(form);
    setPreview(URL.createObjectURL(file));
    setView("analyzing");
    setError(null);

    try {
      const fd = new FormData();
      fd.append("image", file);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      // Importamos authedFetch dinámicamente para mandar el JWT del usuario.
      const { authedFetch } = await import("./api");
      const res  = await authedFetch(`/api/analyze`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.status === 402) { setView("upload"); return; /* modal lo maneja */ }
      if (!res.ok || !data.success) throw new Error(data.error ?? "Error desconocido");
      setAnalysis(data.analysis);
      setView("results");
      refreshProfile();

      // Save to DB if logged in
      if (supabaseEnabled && session) {
        try {
          await saveAnalysis(data.analysis);
          refreshHistory();
        } catch (e) {
          console.error("No se pudo guardar:", e.message);
        }
      }
    } catch (err) {
      setError(err.message);
      setView("upload");
    }
  };

  const handleLoadHistory = (row) => {
    const a = rowToAnalysis(row);
    setAnalysis(a);
    setPreview(null);
    setImageFile(null);
    setFormData(a.contextUsed ? {
      nicho:      a.contextUsed.businessType    || "",
      producto:   a.contextUsed.whatIsBeingSold || "",
      publico:    a.contextUsed.targetAudience  || "",
      plataforma: a.contextUsed.platform        || "",
      objetivo:   a.contextUsed.objective       || "",
      oferta:     a.contextUsed.promotion       || "",
    } : null);
    setView("results");
  };

  const handleDelete = async (id) => {
    await deleteAnalysis(id);
    setHistory((h) => h.filter((r) => r.id !== id));
  };

  const handleLogout = async () => {
    await signOut();
    // Auth listener in App will redirect to AuthView
  };

  const handleReset = () => {
    setView("create"); setAnalysis(null); setPreview(null);
    setImageFile(null); setFormData(null); setError(null);
  };

  // "Crear" tab → vuelve al chooser. "Analizar diseño" → flujo actual de upload.
  const goToCreate = () => { setLoadedCampaign(null); setView("create"); };
  const startAnalyzeFlow = () => setView("upload");
  const startCampaignFlow = () => { setLoadedCampaign(null); setView("campaign"); };

  // ¿Estamos dentro del flujo "Crear" (chooser, analizar, campaign)?
  const isCreateTab = view === "create" || view === "upload" || view === "analyzing" || view === "campaign";

  // Avatar URL del perfil (con cache bust incluido en el URL)
  const avatarUrl = profile?.avatar_url || null;

  return (
    <div className="min-h-screen bg-[#070812] text-white">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-pink-600/20 blur-3xl" />
      <div className="pointer-events-none fixed right-[-100px] top-40 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-150px] left-1/3 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />

      {/* iOS install hint */}
      <IOSInstallBanner />

      {/* ── MOBILE TOP BAR — sticky con logo, score y nav ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070812]/95 backdrop-blur-xl lg:hidden">
        {/* Top row: logo, name, score badge */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <img src={BRAND.logo} alt={BRAND.appName}
            className="h-9 w-9 flex-shrink-0 rounded-xl bg-white object-contain p-0.5 shadow" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black leading-tight">{BRAND.appName}</p>
            <p className="text-[10px] text-white/40 leading-none">{BRAND.tagline}</p>
          </div>
          {analysis && view !== "analyzing" && (
            <button
              onClick={() => setView("results")}
              className="flex-shrink-0 rounded-2xl border border-white/10 bg-gradient-to-br from-pink-500/20 to-cyan-400/10 px-3 py-1.5 text-center"
            >
              <p className="text-[9px] font-black uppercase tracking-widest text-cyan-200 leading-none">Score</p>
              <p className="mt-0.5 text-base font-black leading-none">{analysis.pandaScore}</p>
            </button>
          )}
          {creditsEnabled && profile && (
            <button
              onClick={() => setCreditsModal({ open: true, info: null })}
              className="flex-shrink-0 rounded-2xl border border-purple-400/20 bg-purple-400/10 px-2.5 py-1 text-center"
              title={profile.is_unlimited ? "Créditos ilimitados" : "Comprar más créditos"}
            >
              <p className="text-[9px] font-black uppercase tracking-widest text-purple-200 leading-none">Créditos</p>
              <p className="mt-0.5 text-[13px] font-black leading-none">
                {profile.is_unlimited ? "∞" : profile.credits_balance}
              </p>
            </button>
          )}
          {supabaseEnabled && session && (
            <button
              onClick={() => setView("account")}
              title="Mi cuenta"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-cyan-400 text-xs font-black text-white shadow ring-2 ring-white/10"
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                : userName[0]?.toUpperCase()
              }
            </button>
          )}
        </div>

        {/* Nav pills row */}
        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
          <button
            onClick={goToCreate}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold transition ${isCreateTab ? "bg-white text-black" : "bg-white/[0.06] text-white/60 active:bg-white/10"}`}
          >
            <span>✨</span> Crear
          </button>
          <button
            onClick={() => analysis && view !== "analyzing" ? setView("results") : null}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold transition ${view === "results" ? "bg-white text-black" : analysis ? "bg-white/[0.06] text-white/60 active:bg-white/10" : "bg-white/[0.03] text-white/20"}`}
          >
            <span>📊</span> Resultado
          </button>
          {supabaseEnabled && session && (
            <button
              onClick={() => setView("history")}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold transition ${view === "history" ? "bg-white text-black" : "bg-white/[0.06] text-white/60 active:bg-white/10"}`}
            >
              <span>🗂️</span> Mis análisis
              {(history.length + campaignHistory.length + savedResults.length) > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${view === "history" ? "bg-black/15 text-black" : "bg-white/10 text-white/50"}`}>
                  {history.length + campaignHistory.length + savedResults.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setView("community")}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold transition ${view === "community" ? "bg-white text-black" : "bg-white/[0.06] text-white/60 active:bg-white/10"}`}
          >
            <span>🌐</span> Comunidad
          </button>
          {supabaseEnabled && session && (
            <button
              onClick={() => setView("account")}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold transition ${view === "account" ? "bg-white text-black" : "bg-white/[0.06] text-white/60 active:bg-white/10"}`}
            >
              <span>👤</span> Cuenta
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setView("admin")}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold transition ${view === "admin" ? "bg-white text-black" : "bg-pink-500/15 text-pink-200 active:bg-pink-500/25"}`}
            >
              <span>⚙️</span> Admin
            </button>
          )}
        </div>
      </header>

      <div className="relative mx-auto grid w-full max-w-7xl gap-4 overflow-x-hidden p-4 pb-32 sm:gap-5 md:p-6 md:pb-12 lg:grid-cols-[260px_1fr] lg:overflow-visible">

        {/* ── Sidebar — DESKTOP ONLY ── */}
        <aside className="hidden self-start rounded-[32px] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl lg:block lg:sticky lg:top-6">

          <div className="p-5">
            <div className="flex flex-col items-center gap-2 pb-2">
              <img src={BRAND.logo} alt={BRAND.appName}
                className="h-24 w-24 rounded-3xl object-contain bg-white p-1 shadow-xl" />
              <div className="text-center">
                <h1 className="text-lg font-black leading-tight">{BRAND.appName}</h1>
                <p className="text-[11px] font-medium text-white/40">{BRAND.tagline}</p>
                <p className="mt-1 text-[10px] text-white/25">{BRAND.signature}</p>
              </div>
            </div>

            <nav className="mt-8 space-y-2">
              <div
                onClick={goToCreate}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${isCreateTab ? "bg-white text-black" : "text-white/50 hover:bg-white/10"}`}
              >
                <span>✨</span> Crear
              </div>
              <div
                onClick={() => analysis && view !== "analyzing" ? setView("results") : null}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${view === "results" ? "bg-white text-black" : analysis ? "text-white/50 hover:bg-white/10" : "text-white/20 cursor-not-allowed"}`}
              >
                <span>📊</span> Resultado actual
              </div>
              {supabaseEnabled && session && (
                <div
                  onClick={() => setView("history")}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${view === "history" ? "bg-white text-black" : "text-white/50 hover:bg-white/10"}`}
                >
                  <span className="flex items-center gap-3"><span>🗂️</span> Mis análisis</span>
                  {(history.length + campaignHistory.length + savedResults.length) > 0 && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${view === "history" ? "bg-black/15 text-black" : "bg-white/10 text-white/50"}`}>
                      {history.length + campaignHistory.length + savedResults.length}
                    </span>
                  )}
                </div>
              )}
              <div
                onClick={() => setView("community")}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${view === "community" ? "bg-white text-black" : "text-white/50 hover:bg-white/10"}`}
              >
                <span>🌐</span> Comunidad
              </div>
              {supabaseEnabled && session && (
                <div
                  onClick={() => setView("account")}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${view === "account" ? "bg-white text-black" : "text-white/50 hover:bg-white/10"}`}
                >
                  <span>👤</span> Mi cuenta
                </div>
              )}
              {isAdmin && (
                <div
                  onClick={() => setView("admin")}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${view === "admin" ? "bg-white text-black" : "border border-pink-400/20 bg-pink-500/10 text-pink-200 hover:bg-pink-500/15"}`}
                >
                  <span>⚙️</span> Admin Panel
                </div>
              )}
            </nav>

            {/* Créditos en sidebar */}
            {creditsEnabled && profile && (
              <div className="mt-4 rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-600/15 via-pink-500/5 to-cyan-500/15 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-200">Tu cuenta</p>
                {profile.is_unlimited ? (
                  <>
                    <p className="mt-2 text-xl font-black">∞ Ilimitado</p>
                    <p className="text-[11px] text-white/55">Plan {profile.plan}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-[24px] font-black leading-none">{profile.credits_balance}</p>
                    <p className="text-[11px] text-white/55">créditos · {profile.image_rounds_balance} rondas</p>
                    <p className="mt-1 text-[10px] text-white/40">Plan: {profile.plan}</p>
                    <button
                      onClick={() => setCreditsModal({ open: true, info: null })}
                      className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-[11px] font-black text-black hover:bg-white/90"
                    >
                      Comprar créditos
                    </button>
                  </>
                )}
              </div>
            )}

            {analysis ? (
              <div
                className="mt-6 cursor-pointer rounded-3xl border border-white/10 bg-gradient-to-br from-pink-500/20 to-cyan-400/10 p-5 text-center"
                onClick={() => setView("results")}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Último Panda Score</p>
                <div className="mt-3 text-5xl font-black">{analysis.pandaScore}</div>
                <p className="text-xs text-white/45">/100 — {analysis.shortLabel}</p>
                {analysis.profileApplied && (
                  <p className="mt-1 text-[10px] text-white/30">{analysis.profileApplied}</p>
                )}
                <div className={`mt-3 rounded-xl py-1.5 text-xs font-black text-white ${accionMeta(analysis.accionRecomendada).bg}`}>
                  {analysis.accionRecomendada}
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-pink-500/20 to-cyan-400/10 p-5">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-200">¿Está listo para vender?</p>
                <p className="mt-3 text-sm leading-relaxed text-white/55">
                  Sube un diseño y recibe tu Panda Score — diagnóstico honesto y arte optimizado.
                </p>
              </div>
            )}

            {/* User footer (logged in) */}
            {supabaseEnabled && session && (
              <div className="mt-6 border-t border-white/10 pt-4">
                <button
                  onClick={() => setView("account")}
                  className="mb-3 flex w-full items-center gap-3 rounded-2xl px-1 py-1 transition hover:bg-white/5"
                >
                  {/* Avatar */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-cyan-400 text-xs font-black text-white ring-2 ring-white/10">
                    {avatarUrl
                      ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                      : userName[0]?.toUpperCase()
                    }
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-bold text-white/70">{userName}</p>
                    <p className="truncate text-[10px] text-white/30">{session.user?.email}</p>
                  </div>
                  <span className="text-[10px] text-white/20">›</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/55 transition hover:bg-white/10 hover:text-white/80"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main>
          {error && (
            <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm text-red-300">
              ⚠️ {error}
            </div>
          )}
          {view === "create"    && <CreateView onPickAnalyze={startAnalyzeFlow} onPickCampaign={startCampaignFlow} />}
          {view === "upload"    && <UploadView onAnalyze={handleAnalyze} globalError={null} />}
          {view === "analyzing" && <AnalyzingView />}
          {view === "campaign"  && (
            <CampaignFlow
              onExit={goToCreate}
              initialData={loadedCampaign}
              initialStep={loadedCampaign ? "results" : "photo"}
              onSave={handleSaveCampaign}
              onUpdate={handleUpdateCampaign}
              onSaveResult={supabaseEnabled && session ? handleSaveResult : null}
            />
          )}
          {view === "results"   && analysis && (
            <ResultsView
              analysis={analysis}
              preview={preview}
              imageFile={imageFile}
              formData={formData}
              onSaveResult={supabaseEnabled && session ? handleSaveResult : null}
            />
          )}
          {view === "history" && (
            <HistoryView
              history={history}
              campaigns={campaignHistory}
              savedResults={savedResults}
              onLoad={handleLoadHistory}
              onDelete={handleDelete}
              onLoadCampaign={handleLoadCampaign}
              onDeleteCampaign={handleDeleteCampaign}
              onDeleteResult={handleDeleteResult}
              onReset={handleReset}
            />
          )}
          {view === "community" && <CommunityView session={session} isAdmin={isAdmin} />}
          {view === "admin"   && isAdmin && <AdminPanel />}
          {view === "account" && supabaseEnabled && session && (
            <AccountSettings
              session={session}
              profile={profile}
              onProfileUpdate={refreshProfile}
              onOpenCredits={() => setCreditsModal({ open: true, info: null })}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>

      {/* Modal global de créditos — se abre por 402 o desde botones manuales */}
      <CreditsModal
        open={creditsModal.open}
        info={creditsModal.info}
        onClose={() => { setCreditsModal({ open: false, info: null }); refreshProfile(); }}
      />

      {/* Toast de cobro de créditos */}
      {chargeToast && (
        <div
          className="fixed left-1/2 z-[250] -translate-x-1/2 transform rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-[12px] font-black text-emerald-100 backdrop-blur-xl shadow-2xl"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 80px)" }}
        >
          💳 {chargeToast}
        </div>
      )}
    </div>
  );
}
