import React, { useState, useRef, useEffect, useCallback } from "react";
import { BRAND } from "./brand";

import { authedFetch } from "./api";
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// ══════════════════════════════════════════════════════════════════════════════
// Shared UI primitives (duplicados acá para mantener CampaignFlow autónomo)
// ══════════════════════════════════════════════════════════════════════════════
function Btn({ children, onClick, variant = "primary", disabled = false, full = false, small = false, className = "" }) {
  const base = `rounded-2xl font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${full ? "w-full" : ""} ${small ? "px-4 py-2 text-xs" : "px-5 py-3.5 text-sm"}`;
  const styles = variant === "primary"
    ? "bg-white text-black hover:bg-white/90 active:scale-[0.98]"
    : variant === "premium"
      ? "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 text-white shadow-lg shadow-purple-500/30 hover:brightness-110 active:scale-[0.98]"
      : "border border-white/15 bg-white/5 text-white hover:bg-white/10";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

function Field({ label, placeholder, value, onChange, required, hint, type = "text" }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-black text-white/70">
        {label} {required && <span className="text-pink-400">*</span>}
      </label>
      <input
        type={type}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-cyan-400/60"
      />
      {hint && <p className="mt-1 text-[11px] text-white/30">{hint}</p>}
    </div>
  );
}

function TextArea({ label, placeholder, value, onChange, rows = 3 }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-black text-white/70">{label}</label>
      <textarea
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-cyan-400/60 resize-none"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, required, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-black text-white/70">
        {label} {required && <span className="text-pink-400">*</span>}
      </label>
      <select
        value={value ?? ""}
        onChange={onChange}
        className={`w-full rounded-2xl border border-white/10 bg-[#0d0f1c] px-4 py-3 text-sm outline-none transition focus:border-cyan-400/60 ${!value ? "text-white/25" : "text-white"}`}
      >
        <option value="" disabled>Seleccionar…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Badge({ icon, label }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 sm:rounded-2xl sm:px-3 sm:py-2.5">
      <span className="text-sm sm:text-base">{icon}</span>
      <span className="text-[10px] font-bold text-white/55 sm:text-[11px]">{label}</span>
    </div>
  );
}

function RainbowSpinner({ progress = null }) {
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
          <linearGradient id="cf-rainbow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#ff6b6b" />
            <stop offset="33%"  stopColor="#ffe066" />
            <stop offset="66%"  stopColor="#4dabf7" />
            <stop offset="100%" stopColor="#cc5de8" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="64" cy="64" r={R} fill="none" stroke="url(#cf-rainbow-grad)" strokeWidth="6" strokeLinecap="round"
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

// ══════════════════════════════════════════════════════════════════════════════
// CREATE VIEW — chooser entre las dos rutas principales
// ══════════════════════════════════════════════════════════════════════════════
export function CreateView({ onPickAnalyze, onPickCampaign }) {
  return (
    <div className="space-y-5">

      {/* ── Hero ── */}
      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black text-cyan-200 sm:mb-4 sm:px-4 sm:py-1.5 sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Director Creativo IA
        </div>
        <h2 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">
          ¿Qué quieres{" "}
          <span className="bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">
            crear hoy?
          </span>
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50 sm:mt-4 sm:text-base">
          Analiza un anuncio existente o convierte una foto en una campaña completa lista para vender.
        </p>
        <p className="mt-4 text-[11px] uppercase tracking-widest text-white/25 sm:text-xs">
          {BRAND.signature}
        </p>
      </section>

      {/* ── Two main cards ── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* CARD 1 — Analizar diseño */}
        <button
          onClick={onPickAnalyze}
          className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-left backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.99] sm:rounded-[32px] sm:p-6"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
            🔍
          </div>
          <h3 className="text-2xl font-black leading-tight">Analizar diseño</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            Sube un arte existente y {BRAND.appName} evaluará su claridad, CTA, legibilidad móvil y potencial de conversión.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Badge icon="🎯" label="Panda Score" />
            <Badge icon="🔍" label="Diagnóstico de CTA" />
            <Badge icon="📱" label="Legibilidad móvil" />
            <Badge icon="📋" label="Prompt profesional" />
            <Badge icon="✨" label="Arte optimizado" />
          </div>

          <div className="mt-5">
            <div className="rounded-2xl bg-white px-5 py-3.5 text-center text-sm font-black text-black transition group-hover:bg-white/90">
              ⬆️ Analizar mi anuncio
            </div>
          </div>
        </button>

        {/* CARD 2 — Foto a Campaña (premium) */}
        <button
          onClick={onPickCampaign}
          className="group relative overflow-hidden rounded-[24px] border border-purple-400/30 bg-gradient-to-br from-purple-600/15 via-pink-500/10 to-cyan-500/15 p-5 text-left backdrop-blur-xl transition hover:border-purple-400/50 active:scale-[0.99] sm:rounded-[32px] sm:p-6"
          style={{ boxShadow: "0 0 0 1px rgba(168, 85, 247, 0.2), 0 12px 40px -12px rgba(168, 85, 247, 0.4)" }}
        >
          {/* PREMIUM badge */}
          <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-purple-300/40 bg-gradient-to-r from-pink-500/30 to-purple-500/30 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-purple-100">
            ✨ Premium
          </span>

          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 text-2xl shadow-lg shadow-purple-500/40">
            📷
          </div>
          <h3 className="text-2xl font-black leading-tight">Foto a Campaña</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            Toma una foto de un producto, servicio u objeto. {BRAND.appName} detecta el nicho, sugiere precio competitivo y crea 5 anuncios usando tu logo como guía visual.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Badge icon="🎯" label="Nicho detectado" />
            <Badge icon="💰" label="Precio sugerido" />
            <Badge icon="📊" label="Competencia local" />
            <Badge icon="🎨" label="Logo como guía" />
            <Badge icon="✨" label="5 artes listos" />
          </div>

          <div className="mt-5">
            <div className="rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 px-5 py-3.5 text-center text-sm font-black text-white shadow-lg shadow-purple-500/30 transition group-hover:brightness-110">
              📸 Crear campaña con foto
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN FLOW — flujo Foto a Campaña con sus 6 pasos
// ══════════════════════════════════════════════════════════════════════════════
const initialCampaignData = () => ({
  mode: "photo_to_campaign",
  uploadedImage: "",
  detectedObject: "",
  detectedNiche: "",
  productName: "",
  shortDescription: "",
  mainBenefit: "",
  problemSolved: "",
  targetAudience: "",
  offerType: "",
  suggestedRegularPrice: "",
  suggestedPromoPrice: "",
  finalRecommendedPrice: "",
  priceJustification: "",
  cta: "",
  location: { city: "", region: "", country: "", coordinates: "" },
  competitors: [],
  brand: {
    logo: "",
    primaryColors: [],
    secondaryColors: [],
    visualStyle: "",
    brandPersonality: "",
    suggestedTypography: "",
  },
  formats: ["1080x1920"],
  adAngles: [],
});

export function CampaignFlow({ onExit, initialData = null, initialStep = "photo", onSave, onUpdate }) {
  const [step, setStep]       = useState(initialStep);
  const [data, setData]       = useState(() => initialData ? { ...initialCampaignData(), ...initialData } : initialCampaignData());
  const [error, setError]     = useState(null);
  const [savedId, setSavedId] = useState(initialData?.savedId || null);

  const update = (patch) => setData((d) => {
    const next = { ...d, ...patch };
    // Si ya existe un savedId, propagamos cambios al backend (debounce simple en el padre)
    if (savedId && onUpdate) onUpdate(savedId, next);
    return next;
  });
  const updateBrand = (patch) => setData((d) => {
    const next = { ...d, brand: { ...d.brand, ...patch } };
    if (savedId && onUpdate) onUpdate(savedId, next);
    return next;
  });

  // Auto-save la primera vez que entramos a "results" con ad angles generados
  useEffect(() => {
    if (step === "results" && data.adAngles?.length > 0 && !savedId && onSave) {
      (async () => {
        const id = await onSave(data);
        if (id) setSavedId(id);
      })();
    }
  }, [step, data.adAngles?.length]);

  return (
    <div className="space-y-5">

      {/* ── Header de flujo (con back button) ── */}
      <section className="flex items-center justify-between gap-3 rounded-[24px] border border-purple-400/20 bg-gradient-to-br from-purple-600/10 via-pink-500/5 to-cyan-500/10 p-4 backdrop-blur-xl sm:rounded-[32px] sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 text-base shadow-lg shadow-purple-500/30">
            📷
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black sm:text-base">Foto a Campaña</h3>
              <span className="inline-flex items-center rounded-full border border-purple-300/40 bg-gradient-to-r from-pink-500/30 to-purple-500/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-purple-100">
                Premium
              </span>
            </div>
            <p className="text-[11px] text-white/40">
              Paso {["photo", "analyzing", "form", "logo", "generating", "results"].indexOf(step) + 1} de 6
            </p>
          </div>
        </div>
        <Btn variant="ghost" small onClick={onExit}>← Salir</Btn>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm text-red-300">
          ⚠️ {error}
        </div>
      )}

      {step === "photo"      && <PhotoStep      data={data} update={update} setStep={setStep} setError={setError} />}
      {step === "analyzing"  && <AnalyzingStep  data={data} update={update} setStep={setStep} setError={setError} />}
      {step === "form"       && <FormStep       data={data} update={update} setStep={setStep} />}
      {step === "logo"       && <LogoStep       data={data} update={update} updateBrand={updateBrand} setStep={setStep} setError={setError} />}
      {step === "generating" && <GeneratingStep data={data} update={update} setStep={setStep} setError={setError} />}
      {step === "results"    && <ResultsStep    data={data} update={update} onExit={onExit} />}
    </div>
  );
}

// ───── PASO 1 — Tomar/subir foto ──────────────────────────────────────────────
function PhotoStep({ data, update, setStep, setError }) {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      update({ uploadedImage: e.target.result });
      setStep("analyzing");
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-8">
      <h2 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
        Convierte una foto en{" "}
        <span className="bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">
          5 anuncios listos para vender
        </span>
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">
        {BRAND.appName} analizará la imagen, detectará el nicho y creará una campaña visual completa.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => cameraRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] py-10 transition hover:border-white/30 active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 text-2xl shadow-lg">📷</span>
          <span className="text-sm font-black">Tomar foto</span>
          <span className="text-[11px] text-white/40">Usa tu cámara</span>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] py-10 transition hover:border-white/30 active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl">🖼️</span>
          <span className="text-sm font-black">Subir imagen</span>
          <span className="text-[11px] text-white/40">Desde tu galería</span>
        </button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
             onChange={(e) => handleFile(e.target.files[0])} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
             onChange={(e) => handleFile(e.target.files[0])} />

      <p className="mt-4 text-center text-[11px] text-white/30">
        PNG, JPG o captura de pantalla. Máx 20 MB.
      </p>
    </section>
  );
}

// ───── PASO 2 — Analizando con IA ─────────────────────────────────────────────
function AnalyzingStep({ data, update, setStep, setError }) {
  const [tick, setTick] = useState(0);
  const steps = [
    "Detectando objeto principal y producto…",
    "Identificando el nicho o industria…",
    "Estimando público objetivo…",
    "Detectando beneficios y problemas que resuelve…",
    "Sugiriendo tipo de oferta y rango de precio…",
    "Evaluando calidad de la foto…",
  ];

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % steps.length), 1900);
    return () => clearInterval(id);
  }, []);

  // Llamada al backend para análisis de foto → contexto de campaña
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Convertir base64 → blob
        const blob = await (await fetch(data.uploadedImage)).blob();
        const fd = new FormData();
        fd.append("image", blob, "photo.jpg");

        const res = await authedFetch(`/api/analyze-photo`, { method: "POST", body: fd });
        if (cancelled) return;

        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            update(result.data || {});
            setStep("form");
            return;
          }
        }
        // Si el endpoint nuevo no existe todavía → fallback con datos vacíos editables
        update({
          detectedObject: "",
          detectedNiche: "",
          productName: "",
          shortDescription: "",
          mainBenefit: "",
          problemSolved: "",
          targetAudience: "",
          offerType: "",
        });
        setStep("form");
      } catch (err) {
        if (cancelled) return;
        console.warn("analyze-photo fallback:", err.message);
        setStep("form"); // continúa con form vacío editable
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-6 px-4 text-center sm:gap-8">
      <RainbowSpinner progress={null} />
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-300/30 bg-purple-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-purple-200 sm:mb-4 sm:text-xs">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
          Analizando imagen, nicho y oportunidad de venta
        </div>
        <h2 className="text-xl font-black sm:text-3xl">Detectando contexto de tu producto</h2>
        <p className="mt-3 min-h-[3rem] text-sm leading-relaxed text-white/50">{steps[tick]}</p>
      </div>
    </div>
  );
}

// ───── PASO 3 — Form autocompletado ────────────────────────────────────────────
function FormStep({ data, update, setStep }) {
  const [askingLocation, setAskingLocation] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    setAskingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        update({
          location: {
            ...data.location,
            coordinates: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
          },
        });
        try {
          const res = await authedFetch(`/api/reverse-geocode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: latitude,
              lng: longitude,
              niche: data.detectedNiche,
              productName: data.productName,
            }),
          });
          if (res.ok) {
            const r = await res.json();
            if (r.success) {
              update({
                location: {
                  city: r.city || "",
                  region: r.region || "",
                  country: r.country || "",
                  coordinates: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
                },
                competitors: r.competitors || [],
              });
            }
          }
        } catch (e) { /* fallback silencioso */ }
        setAskingLocation(false);
      },
      () => setAskingLocation(false),
      { timeout: 10000 }
    );
  };

  // Estimación de competencia sin GPS (usuario escribió ciudad a mano)
  const estimateForCity = async () => {
    if (!data.location.city || !data.detectedNiche) return;
    setAskingLocation(true);
    try {
      const res = await authedFetch(`/api/reverse-geocode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: 0, lng: 0,
          city: data.location.city,
          niche: data.detectedNiche,
          productName: data.productName,
        }),
      });
      if (res.ok) {
        const r = await res.json();
        if (r.success && r.competitors?.length) update({ competitors: r.competitors });
      }
    } catch (e) { /* ignore */ }
    setAskingLocation(false);
  };

  return (
    <div className="space-y-5">
      {/* Preview de la foto */}
      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:rounded-[32px] sm:p-5">
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/30">Tu foto</p>
        <img src={data.uploadedImage} alt="Foto del producto" className="max-h-72 w-full rounded-2xl object-contain" />
      </section>

      {/* Datos del producto */}
      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
        <h3 className="text-lg font-black">Datos del producto</h3>
        <p className="mt-1 text-xs text-white/40">Revisa y ajusta los datos auto-detectados antes de generar tus anuncios.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del producto o servicio" placeholder="Ej: Masaje relajante 60 min" required
                 value={data.productName} onChange={(e) => update({ productName: e.target.value })} />
          <Field label="Categoría / nicho" placeholder="Ej: Bienestar y Spa" required
                 value={data.detectedNiche} onChange={(e) => update({ detectedNiche: e.target.value })} />
          <div className="sm:col-span-2">
            <TextArea label="Descripción corta" placeholder="Una frase que describa tu producto"
                      value={data.shortDescription} onChange={(e) => update({ shortDescription: e.target.value })} rows={2} />
          </div>
          <Field label="Beneficio principal" placeholder="Ej: Relajación profunda en 60 min"
                 value={data.mainBenefit} onChange={(e) => update({ mainBenefit: e.target.value })} />
          <Field label="Problema que resuelve" placeholder="Ej: Estrés acumulado de la semana"
                 value={data.problemSolved} onChange={(e) => update({ problemSolved: e.target.value })} />
          <Field label="Público objetivo" placeholder="Ej: Mujeres 25–45 años" required
                 value={data.targetAudience} onChange={(e) => update({ targetAudience: e.target.value })} />
          <SelectField label="Tipo de oferta" value={data.offerType}
                       onChange={(e) => update({ offerType: e.target.value })}
                       options={["Descuento %", "2x1", "Combo", "Precio especial", "Sin oferta"]} />
        </div>
      </section>

      {/* Localización + competencia */}
      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black">Localización y competencia</h3>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Usaremos tu ubicación solo para estimar precios de competencia en tu área. Puedes editar o eliminar esta información antes de generar tus anuncios.
            </p>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            {!data.location.coordinates && (
              <Btn variant="ghost" small onClick={requestLocation} disabled={askingLocation}>
                {askingLocation ? "…" : "📍 GPS"}
              </Btn>
            )}
            {data.location.city && data.detectedNiche && (
              <Btn variant="ghost" small onClick={estimateForCity} disabled={askingLocation}>
                {askingLocation ? "…" : "🔍 Estimar competencia"}
              </Btn>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Ciudad" placeholder="Ej: Miami" value={data.location.city}
                 onChange={(e) => update({ location: { ...data.location, city: e.target.value } })} />
          <Field label="Región / Estado" placeholder="Ej: FL" value={data.location.region}
                 onChange={(e) => update({ location: { ...data.location, region: e.target.value } })} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Precio regular sugerido" placeholder="Ej: $79" type="text"
                 value={data.suggestedRegularPrice} onChange={(e) => update({ suggestedRegularPrice: e.target.value })} />
          <Field label="Precio promocional" placeholder="Ej: $49" type="text"
                 value={data.suggestedPromoPrice} onChange={(e) => update({ suggestedPromoPrice: e.target.value })} />
          <Field label="Precio final recomendado" placeholder="Ej: $59" type="text"
                 value={data.finalRecommendedPrice} onChange={(e) => update({ finalRecommendedPrice: e.target.value })} />
        </div>

        {data.competitors?.length > 0 && (
          <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/40">Competencia detectada</p>
            <ul className="space-y-2 text-xs">
              {data.competitors.slice(0, 5).map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-white/55">
                  <span className="truncate">{c.name}</span>
                  <span className="text-white/35">{c.estimatedPriceRange}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-white/30">
          ℹ️ Los precios sugeridos son estimados basados en datos disponibles y pueden variar según calidad, experiencia, costos operacionales y ubicación.
        </p>
      </section>

      {/* Continuar */}
      <Btn variant="premium" full onClick={() => setStep("logo")}
           disabled={!data.productName?.trim() || !data.detectedNiche?.trim() || !data.targetAudience?.trim()}>
        Siguiente: Sube tu logo →
      </Btn>
    </div>
  );
}

// ───── PASO 4 — Subir logo + formato ──────────────────────────────────────────
function LogoStep({ data, update, updateBrand, setStep, setError }) {
  const fileRef = useRef(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [logoPreview, setLogoPreview] = useState(data.brand.logo || null);

  const setFormat = (f) => update({ formats: [f] });
  const currentFormat = data.formats?.[0] || "1080x1920";

  const handleLogo = async (file) => {
    if (!file?.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      setLogoPreview(dataUrl);
      updateBrand({ logo: dataUrl });

      // Intentar análisis de marca por backend
      setAnalyzing(true);
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const fd = new FormData();
        fd.append("image", blob, "logo.png");
        const res = await authedFetch(`/api/extract-brand`, { method: "POST", body: fd });
        if (res.ok) {
          const r = await res.json();
          if (r.success) updateBrand(r.brand || {});
        }
      } catch (e) {
        console.warn("extract-brand fallback:", e.message);
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-8">
        <h2 className="text-2xl font-black leading-tight sm:text-3xl">Sube el logo de tu empresa</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/50">
          Usaremos tu logo como guía visual para crear anuncios coherentes con tu marca.
        </p>

        <div className="mt-6">
          {logoPreview ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <img src={logoPreview} alt="Logo" className="mx-auto max-h-48 object-contain" />
              <button onClick={() => { setLogoPreview(null); updateBrand({ logo: "" }); fileRef.current.value = ""; }}
                      className="mt-3 mx-auto block text-xs text-white/40 hover:text-white/70">
                Cambiar logo
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] py-12 transition hover:border-white/30"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 text-2xl">🎨</span>
              <span className="text-sm font-black">Subir logo</span>
              <span className="text-[11px] text-white/40">PNG o JPG, máx 2 MB</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
                 onChange={(e) => handleLogo(e.target.files[0])} />
        </div>

        {analyzing && (
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-cyan-300">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-transparent border-t-cyan-300" />
            Analizando colores, estilo y personalidad de marca…
          </p>
        )}

        {data.brand.primaryColors?.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/40">Colores detectados</p>
              <div className="flex flex-wrap gap-2">
                {data.brand.primaryColors.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/60">
                    <span className="h-3 w-3 rounded-full border border-white/10" style={{ background: c }} />
                    {c}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/40">Estilo</p>
              <p className="text-xs text-white/60">{data.brand.visualStyle || "—"}</p>
              <p className="mt-1 text-[10px] text-white/40">Personalidad: {data.brand.brandPersonality || "—"}</p>
            </div>
          </div>
        )}
      </section>

      {/* Formato del arte */}
      <section className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
        <h3 className="text-lg font-black">Formato del arte</h3>
        <p className="mt-1 text-xs text-white/40">Elige según dónde vas a publicar.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { id: "1080x1080", label: "1080×1080", note: "Feed cuadrado" },
            { id: "1080x1920", label: "1080×1920", note: "Stories / Reels" },
            { id: "both",      label: "Ambos",     note: "1080×1080 + 1080×1920" },
          ].map(({ id, label, note }) => {
            const active = currentFormat === id;
            return (
              <button
                key={id}
                onClick={() => setFormat(id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-purple-400/50 bg-gradient-to-br from-purple-500/15 to-pink-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <p className="text-sm font-black">{label}</p>
                <p className="mt-0.5 text-[11px] text-white/40">{note}</p>
              </button>
            );
          })}
        </div>

        {currentFormat === "both" && (
          <p className="mt-3 text-[11px] text-white/35">
            ⚠️ "Ambos" duplica el costo y tiempo de generación (10 imágenes en vez de 5).
          </p>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Btn variant="ghost" full onClick={() => setStep("form")}>← Volver al formulario</Btn>
        <Btn variant="premium" full disabled={!data.brand.logo} onClick={() => setStep("generating")}>
          Generar mis 5 anuncios →
        </Btn>
      </div>
    </div>
  );
}

// ───── PASO 5 — Generando 5 anuncios ──────────────────────────────────────────
function GeneratingStep({ data, update, setStep, setError }) {
  const [progress, setProgress] = useState(0);
  const [tick, setTick] = useState(0);
  const steps = [
    "Definiendo los 5 ángulos publicitarios para tu nicho…",
    "Construyendo headlines y CTAs adaptados a tu producto…",
    "Aplicando colores y estilo de tu marca…",
    "Generando los 5 artes en paralelo…",
    "Optimizando legibilidad móvil…",
    "Toques finales de calidad…",
  ];

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % steps.length), 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let progressId;

    (async () => {
      // Progreso simulado mientras corre el backend (puede tardar 60-120s)
      const TOTAL_MS = 90000, INTERVAL = 400, MAX_AUTO = 92;
      let elapsed = 0;
      progressId = setInterval(() => {
        elapsed += INTERVAL;
        setProgress(Math.min(MAX_AUTO, Math.round((elapsed / TOTAL_MS) * MAX_AUTO)));
      }, INTERVAL);

      try {
        const res = await authedFetch(`/api/generate-campaign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName: data.productName,
            niche: data.detectedNiche,
            shortDescription: data.shortDescription,
            mainBenefit: data.mainBenefit,
            problemSolved: data.problemSolved,
            targetAudience: data.targetAudience,
            offerType: data.offerType,
            regularPrice: data.suggestedRegularPrice,
            promoPrice: data.suggestedPromoPrice,
            finalPrice: data.finalRecommendedPrice,
            location: data.location,
            brand: data.brand,
            sourcePhoto: data.uploadedImage,
            formats: data.formats,
          }),
        });

        if (cancelled) return;

        if (res.ok) {
          const r = await res.json();
          if (r.success) {
            update({ adAngles: r.adAngles || [] });
            setProgress(100);
            setStep("results");
            return;
          }
        }
        throw new Error("El endpoint /api/generate-campaign aún no está disponible. La UI está lista — falta wirearlo en server.js.");
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setStep("form");
      } finally {
        clearInterval(progressId);
      }
    })();

    return () => { cancelled = true; clearInterval(progressId); };
  }, []);

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-6 px-4 text-center sm:gap-8">
      <RainbowSpinner progress={progress} />
      <span className="text-xs font-black tabular-nums text-white/60">{progress}%</span>
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-300/30 bg-purple-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-purple-200 sm:text-xs">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
          Color Panda Media Lab is working
        </div>
        <h2 className="text-xl font-black sm:text-3xl">Generando tus 5 anuncios</h2>
        <p className="mt-3 min-h-[3rem] text-sm leading-relaxed text-white/50">{steps[tick]}</p>
      </div>
    </div>
  );
}

// ───── PASO 6 — Resultados (5 artes) ──────────────────────────────────────────
function ResultsStep({ data, update, onExit }) {
  const updateAdAt = (i, patch) => {
    const next = data.adAngles.slice();
    next[i] = { ...next[i], ...patch };
    update({ adAngles: next });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-purple-400/20 bg-gradient-to-br from-purple-600/10 via-pink-500/5 to-cyan-500/10 p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-6">
        <h2 className="text-2xl font-black sm:text-3xl">Tus 5 anuncios listos</h2>
        <p className="mt-2 text-sm text-white/55">Cada arte tiene un ángulo estratégico distinto. Edita el texto, regenera o descarga.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.adAngles.map((ad, i) => (
          <AdCard
            key={i}
            ad={ad}
            index={i}
            sourcePhoto={data.uploadedImage}
            brand={data.brand}
            format={data.formats?.[0] || "1080x1920"}
            onUpdate={(patch) => updateAdAt(i, patch)}
          />
        ))}
      </div>

      <Btn variant="ghost" full onClick={onExit}>← Crear otra campaña</Btn>
    </div>
  );
}

function AdCard({ ad, index, sourcePhoto, brand, format, onUpdate }) {
  const [editing, setEditing]       = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [regenerating, setRegen]    = useState(false);
  const [regenError, setRegenError] = useState(null);

  // Buffers de edición — se sincronizan con `ad` cuando cambia (nueva regeneración)
  const [draft, setDraft] = useState({ headline: ad.headline, subheadline: ad.subheadline, cta: ad.cta });
  useEffect(() => { setDraft({ headline: ad.headline, subheadline: ad.subheadline, cta: ad.cta }); }, [ad.headline, ad.subheadline, ad.cta]);

  const handleDownload = () => {
    if (!ad.generatedImage) return;
    const a = document.createElement("a");
    a.href     = ad.generatedImage;
    a.download = `panda-${(ad.angleName || "ad").toLowerCase().replace(/\s+/g, "-")}-${index + 1}.png`;
    a.click();
  };

  const handleCopyPrompt = async () => {
    try { await navigator.clipboard.writeText(ad.generationPrompt || ""); } catch (e) { /* ignore */ }
  };

  const handleSaveEdits = () => {
    onUpdate(draft);
    setEditing(false);
  };

  const handleRegenerate = async () => {
    setRegen(true); setRegenError(null);
    // Si estaba editando, aplicamos los drafts antes de regenerar
    const angleForGen = editing
      ? { ...ad, ...draft }
      : ad;
    if (editing) onUpdate(draft);

    try {
      const res = await authedFetch(`/api/regenerate-ad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ angle: angleForGen, brand, sourcePhoto, format }),
      });
      const r = await res.json();
      if (!res.ok || !r.success) throw new Error(r.error || "Error al regenerar");
      onUpdate({ generatedImage: r.image, ...(editing ? draft : {}) });
      setEditing(false);
    } catch (err) {
      setRegenError(err.message);
    } finally {
      setRegen(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl sm:rounded-[28px] sm:p-4">

      {/* IMAGEN */}
      {ad.generatedImage ? (
        <div className="relative">
          <img src={ad.generatedImage} alt={ad.angleName} className="w-full rounded-xl object-contain" />
          {regenerating && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/65 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-purple-400" />
                <p className="text-[10px] font-black text-white/70">Regenerando…</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-xs text-white/30">
          {regenerating ? "Generando…" : "Sin imagen"}
        </div>
      )}

      {/* TEXTOS — modo lectura */}
      {!editing && (
        <div className="mt-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-300">{ad.angleName || `Ángulo ${index + 1}`}</p>
          <p className="mt-1 text-sm font-black leading-tight text-white">{ad.headline || "—"}</p>
          {ad.subheadline && <p className="mt-1 text-xs text-white/55">{ad.subheadline}</p>}
          {ad.cta && (
            <div className="mt-3 inline-block rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-3 py-1 text-[10px] font-black text-white">
              {ad.cta}
            </div>
          )}
        </div>
      )}

      {/* TEXTOS — modo edición */}
      {editing && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-300">{ad.angleName || `Ángulo ${index + 1}`}</p>
          <input
            value={draft.headline ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))}
            placeholder="Headline"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-black text-white outline-none focus:border-purple-400/60"
          />
          <input
            value={draft.subheadline ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, subheadline: e.target.value }))}
            placeholder="Subheadline / beneficio"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/85 outline-none focus:border-purple-400/60"
          />
          <input
            value={draft.cta ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, cta: e.target.value }))}
            placeholder="CTA"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-purple-400/60"
          />
          <p className="text-[10px] text-white/30">Los cambios solo aparecen en la imagen al regenerar.</p>
        </div>
      )}

      {regenError && (
        <p className="mt-2 rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-1.5 text-[10px] text-red-300">⚠️ {regenError}</p>
      )}

      {/* ACCIONES */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {!editing ? (
          <>
            <Btn variant="ghost" small onClick={handleDownload} disabled={!ad.generatedImage || regenerating}>⬇ Descargar</Btn>
            <Btn variant="ghost" small onClick={() => setEditing(true)} disabled={regenerating}>✏️ Editar texto</Btn>
            <Btn variant="ghost" small onClick={handleRegenerate} disabled={regenerating}>🔄 Regenerar</Btn>
            <Btn variant="ghost" small onClick={handleCopyPrompt} disabled={!ad.generationPrompt}>📋 Copiar prompt</Btn>
          </>
        ) : (
          <>
            <Btn variant="ghost" small onClick={() => { setDraft({ headline: ad.headline, subheadline: ad.subheadline, cta: ad.cta }); setEditing(false); }}>✕ Cancelar</Btn>
            <Btn small onClick={handleSaveEdits}>✓ Guardar texto</Btn>
            <div className="col-span-2">
              <Btn variant="premium" small full onClick={handleRegenerate} disabled={regenerating}>
                {regenerating ? "Regenerando…" : "🔄 Regenerar con estos textos"}
              </Btn>
            </div>
          </>
        )}
      </div>

      {showPrompt && ad.generationPrompt && (
        <p className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-black/30 p-2 text-[10px] text-white/40">{ad.generationPrompt}</p>
      )}
    </div>
  );
}
