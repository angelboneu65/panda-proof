import React, { useState, useRef, useEffect, useCallback } from "react";

// En producción (Netlify) apunta al backend en Render; en dev usa el proxy local
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// ── Color helpers ─────────────────────────────────────────────────────────────
const scoreGradient = (s) =>
  s >= 90 ? "from-emerald-400 to-green-500"
  : s >= 80 ? "from-cyan-400 to-teal-400"
  : s >= 70 ? "from-yellow-400 to-amber-400"
  : s >= 60 ? "from-orange-400 to-amber-500"
  : s >= 40 ? "from-orange-500 to-red-500"
  : "from-red-500 to-red-700";

const veredictoClass = (v) =>
  ({
    "Excelente":        "border-emerald-400/30 bg-emerald-400/15 text-emerald-300",
    "Muy bueno":        "border-cyan-400/30 bg-cyan-400/15 text-cyan-300",
    "Bueno":            "border-teal-400/30 bg-teal-400/15 text-teal-300",
    "En desarrollo":    "border-yellow-400/30 bg-yellow-400/15 text-yellow-300",
    "Con potencial":    "border-orange-400/30 bg-orange-400/15 text-orange-300",
    "Punto de partida": "border-purple-400/30 bg-purple-400/15 text-purple-300",
    // legacy fallbacks
    "Aceptable": "border-yellow-400/30 bg-yellow-400/15 text-yellow-300",
    "Regular":   "border-orange-400/30 bg-orange-400/15 text-orange-300",
    "Débil":     "border-orange-400/30 bg-orange-400/15 text-orange-300",
    "Muy pobre": "border-purple-400/30 bg-purple-400/15 text-purple-300",
  }[v] ?? "border-white/15 bg-white/5 text-white/60");

const accionMeta = (a) =>
  ({
    "Publicarlo como está":     { bg: "bg-emerald-600", icon: "✅" },
    "Hacer ajustes menores":    { bg: "bg-cyan-700",    icon: "🔧" },
    "Rediseñarlo parcialmente": { bg: "bg-orange-600",  icon: "⚠️" },
    "Rediseñarlo completo":     { bg: "bg-red-600",     icon: "🚫" },
  }[a] ?? { bg: "bg-purple-600", icon: "📋" });

// ── Shared components ─────────────────────────────────────────────────────────
function PandaLogo({ size = "md" }) {
  const dim = size === "sm" ? "h-10 w-10" : "h-14 w-14";
  return (
    <img
      src="/logo.png"
      alt="Color Panda Media Lab"
      className={`${dim} flex-shrink-0 rounded-2xl object-contain bg-white p-0.5 shadow-xl`}
    />
  );
}

function Btn({ children, onClick, variant = "primary", disabled = false, full = false, small = false }) {
  const base = `rounded-2xl font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
    full ? "w-full" : ""
  } ${small ? "px-4 py-2 text-xs" : "px-5 py-3 text-sm"}`;
  const styles =
    variant === "primary"
      ? "bg-white text-black hover:bg-white/90"
      : "border border-white/15 bg-white/5 text-white hover:bg-white/10";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

// ── Score circle (animates from 0) ────────────────────────────────────────────
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
    <div className={`relative flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br ${scoreGradient(score)} p-[3px] shadow-2xl`}>
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#090A13]">
        <span className="text-5xl font-black text-white">{display}</span>
        <span className="text-xs font-semibold text-white/40">/100</span>
      </div>
    </div>
  );
}

function Bar({ score, max }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-400 transition-all duration-700"
        style={{ width: `${(score / max) * 100}%` }}
      />
    </div>
  );
}

function Field({ label, placeholder, value, onChange, error, required }) {
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
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
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

// ══════════════════════════════════════════════════════════════════════════════
// UPLOAD VIEW
// ══════════════════════════════════════════════════════════════════════════════
function UploadView({ onAnalyze, globalError }) {
  const [image, setImage]         = useState(null);
  const [preview, setPreview]     = useState(null);
  const [dragging, setDragging]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [errors, setErrors]       = useState({});
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    nicho: "", producto: "", publico: "", plataforma: "", objetivo: "", oferta: "",
  });

  const handleFile = useCallback(async (file) => {
    if (!file?.type.startsWith("image/")) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setErrors((e) => ({ ...e, image: null }));

    // Auto-extraer datos del negocio desde la imagen
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res  = await fetch(`${API_BASE}/api/extract`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        setForm((f) => ({
          nicho:      data.data.nicho      || f.nicho,
          producto:   data.data.producto   || f.producto,
          publico:    data.data.publico    || f.publico,
          plataforma: data.data.plataforma || f.plataforma,
          objetivo:   data.data.objetivo   || f.objetivo,
          oferta:     data.data.oferta     || f.oferta,
        }));
      }
    } catch (err) {
      console.error("Error al extraer datos de la imagen:", err.message);
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
      {/* Hero */}
      <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
        <div className="mb-3 inline-block rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-200">
          Director Creativo IA
        </div>
        <h2 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">
          ¿Tu arte está listo<br className="hidden sm:block" /> para vender?
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/50">
          Sube tu diseño, completa los datos y recibe un análisis honesto con un prompt profesional para regenerarlo mejorado.
        </p>
      </section>

      {globalError && (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm text-red-300">
          ⚠️ {globalError}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        {/* LEFT — image drop */}
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <h3 className="mb-1 text-lg font-black">Sube tu arte</h3>
          <p className="mb-5 text-xs text-white/40">PNG, JPG o captura de pantalla.</p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => !preview && fileRef.current?.click()}
            className={`relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[24px] border-2 transition-all ${
              errors.image     ? "border-red-400/50 bg-red-400/5"
              : dragging       ? "border-cyan-400 bg-cyan-400/10"
              : preview        ? "cursor-default border-white/10 bg-transparent"
              : "border-dashed border-white/20 bg-black/25 hover:border-white/40"
            }`}
          >
            {preview ? (
              <>
                <img src={preview} alt="Vista previa" className="max-h-[380px] w-full object-contain" />
                <button
                  onClick={(e) => { e.stopPropagation(); setImage(null); setPreview(null); }}
                  className="absolute right-3 top-3 rounded-xl bg-black/70 px-3 py-1.5 text-xs font-black text-white/80 hover:bg-black/90"
                >
                  Cambiar
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 text-3xl font-black">
                  +
                </div>
                <div>
                  <p className="text-xl font-black sm:text-2xl">Sube tu diseño</p>
                  <p className="mt-2 text-sm text-white/40">
                    <span className="hidden sm:inline">Arrastra o </span>toca para seleccionar
                  </p>
                </div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => handleFile(e.target.files[0])} />
          {errors.image && <p className="mt-2 text-xs text-red-400">{errors.image}</p>}
        </div>

        {/* RIGHT — form */}
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black">Datos del negocio</h3>
            {extracting && (
              <span className="flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-black text-cyan-300">
                <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-transparent border-t-cyan-300 inline-block" />
                Leyendo imagen…
              </span>
            )}
          </div>
          <p className="mt-1 mb-6 text-xs text-white/40">
            Los campos con <span className="text-pink-400">*</span> son requeridos
            {extracting && <span className="ml-2 text-cyan-400/70">— completando automáticamente</span>}
          </p>
          <div className="space-y-4">
            <Field
              label="¿Qué tipo de negocio?" placeholder="Ej: Spa, Restaurante, Clínica…"
              value={form.nicho} onChange={set("nicho")} error={errors.nicho} required
            />
            <Field
              label="¿Qué estás vendiendo?" placeholder="Ej: Masaje relajante 60 min"
              value={form.producto} onChange={set("producto")} error={errors.producto} required
            />
            <Field
              label="¿A quién va dirigido?" placeholder="Ej: Mujeres 25–45 años"
              value={form.publico} onChange={set("publico")} error={errors.publico} required
            />
            <SelectField
              label="¿Dónde se publicará?" value={form.plataforma}
              onChange={set("plataforma")} error={errors.plataforma} required
              options={["Instagram Stories","Instagram Feed","Facebook","TikTok",
                        "WhatsApp Status","Google Ads","Web / Landing page","Impreso / Flyer"]}
            />
            <SelectField
              label="¿Cuál es el objetivo?" value={form.objetivo}
              onChange={set("objetivo")} error={errors.objetivo} required
              options={["Mensajes / WhatsApp","Ventas directas","Reservas","Llamadas",
                        "Tráfico web","Reconocimiento de marca","Captación de leads"]}
            />
            <Field
              label="Precio o Promoción (opcional)" placeholder="Ej: 50% OFF, desde $29, 2×1"
              value={form.oferta} onChange={set("oferta")}
            />
          </div>
          <div className="mt-6 space-y-3">
            <Btn onClick={handleSubmit} disabled={loading} full>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Analizando…
                </span>
              ) : "🐼 Analizar mi diseño"}
            </Btn>
            <p className="text-center text-[11px] text-white/30">El análisis toma entre 15 y 30 segundos</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYZING VIEW
// ══════════════════════════════════════════════════════════════════════════════
function RainbowLogo({ progress = null }) {
  // Si progress === null → modo spinning infinito (análisis)
  // Si progress es número → modo fill (generación)
  const R = 58;
  const CIRC = 2 * Math.PI * R;
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
        {/* Track */}
        <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        {/* Arco tornasol */}
        <circle
          cx="64" cy="64" r={R}
          fill="none"
          stroke="url(#rainbow-grad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={progress === null ? `${CIRC * 0.25}` : `${offset}`}
          style={progress !== null ? { transition: "stroke-dashoffset 0.4s ease-out" } : {}}
        />
      </svg>
      {/* Logo circular */}
      <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-white/10 bg-white shadow-xl"
           style={{ filter: "drop-shadow(0 0 12px rgba(150,80,255,0.4))" }}>
        <img src="/logo.png" alt="Color Panda Media Lab" className="h-full w-full object-contain p-1" />
      </div>
    </div>
  );
}

function AnalyzingView({ preview }) {
  const [tick, setTick] = useState(0);
  const steps = [
    "Detectando nicho y mercado…",
    "Analizando jerarquía visual…",
    "Evaluando legibilidad móvil…",
    "Midiendo fuerza del mensaje…",
    "Calculando potencial de conversión…",
  ];
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % steps.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 text-center">
      <RainbowLogo progress={null} />
      <div>
        <div className="mb-4 inline-block rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-200">
          Color Panda Media Lab está analizando tu arte
        </div>
        <h2 className="text-2xl font-black sm:text-4xl">Director creativo trabajando</h2>
        <p className="mt-3 h-6 text-sm text-white/50">{steps[tick]}</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULTS VIEW
// ══════════════════════════════════════════════════════════════════════════════
function ResultsView({ analysis, preview, imageFile, formData, onReset }) {
  const [copied,         setCopied]         = useState(false);
  const [generating,     setGenerating]     = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [genError,       setGenError]       = useState(null);
  const [genTick,        setGenTick]        = useState(0);
  const [genProgress,    setGenProgress]    = useState(0);
  const [genAnalyzing,   setGenAnalyzing]   = useState(false);
  const [genScore,       setGenScore]       = useState(null);
  const [genVeredicto,   setGenVeredicto]   = useState(null);

  const genSteps = [
    "Aplicando correcciones de jerarquía visual…",
    "Ajustando legibilidad y contraste…",
    "Construyendo la composición mejorada…",
    "Añadiendo el CTA correcto…",
    "Refinando para la plataforma…",
    "Casi listo, puliendo detalles…",
  ];

  const {
    score_final,
    veredicto,
    resumen,
    lo_que_funciona = [],
    lo_que_mejorar  = [],
    desglose = {},
    prompt_profesional,
    accion_recomendada,
  } = analysis;

  const meta = accionMeta(accion_recomendada);

  const criterios = [
    { label: "Claridad de la oferta",    key: "claridad_oferta",       max: 15 },
    { label: "Fuerza del mensaje",        key: "mensaje_venta",         max: 15 },
    { label: "Jerarquía visual",          key: "jerarquia_visual",      max: 15 },
    { label: "Legibilidad móvil",         key: "legibilidad_movil",     max: 10 },
    { label: "Confianza profesional",     key: "confianza_profesional", max: 15 },
    { label: "Adecuación al nicho",       key: "adecuacion_nicho",      max: 15 },
    { label: "Llamado a la acción (CTA)", key: "cta",                   max: 10 },
    { label: "Potencial de conversión",   key: "conversion_general",    max: 5  },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt_profesional ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const analyzeGeneratedImage = async (base64DataUrl) => {
    if (!formData) return;
    setGenAnalyzing(true);
    setGenScore(null);
    setGenVeredicto(null);
    try {
      // Convertir data URL → Blob para enviarlo a /api/analyze
      const fetchRes = await fetch(base64DataUrl);
      const blob     = await fetchRes.blob();

      const fd = new FormData();
      fd.append("image", blob, "arte-mejorado.png");
      Object.entries(formData).forEach(([k, v]) => v && fd.append(k, v));

      const res  = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Error al analizar");
      setGenScore(data.analysis.score_final);
      setGenVeredicto(data.analysis.veredicto);
    } catch (err) {
      console.error("Error analizando imagen generada:", err.message);
      // fallo silencioso — no bloqueamos la UI
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
    setGenVeredicto(null);
    setGenProgress(0);

    // Texto rotativo
    const tickId = setInterval(() => setGenTick((t) => (t + 1) % genSteps.length), 3500);

    // Progreso simulado: llega al 92% en ~80s, el último 8% al terminar
    const TOTAL_MS = 80000;
    const INTERVAL = 400;
    const MAX_AUTO  = 92;
    let elapsed = 0;
    const progressId = setInterval(() => {
      elapsed += INTERVAL;
      const pct = Math.min(MAX_AUTO, Math.round((elapsed / TOTAL_MS) * MAX_AUTO));
      setGenProgress(pct);
    }, INTERVAL);

    try {
      const fd = new FormData();
      fd.append("image", imageFile);

      const res  = await fetch(`${API_BASE}/api/generate`, { method: "POST", body: fd });
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

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href     = generatedImage;
    a.download = "arte-mejorado-pandaproof.png";
    a.click();
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <section className="flex flex-col gap-3 rounded-[32px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <span className={`inline-block rounded-full border px-3 py-1 text-xs font-black ${veredictoClass(veredicto)}`}>
            {veredicto}
          </span>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Análisis completado</h2>
        </div>
        <Btn variant="ghost" onClick={onReset} small>← Nuevo análisis</Btn>
      </section>

      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        {/* ── LEFT ── */}
        <div className="space-y-5">
          {/* Score */}
          <div className="flex flex-col items-center gap-4 rounded-[32px] border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-xl">
            <ScoreCircle score={score_final} />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-white/35">Puntuación creativa</p>
              <p className="mt-1 text-2xl font-black">{score_final} / 100</p>
            </div>
          </div>

          {/* Resumen */}
          <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/35">Diagnóstico</p>
            <p className="text-sm leading-relaxed text-white/70">{resumen}</p>
          </div>

          {/* Arte original evaluado */}
          {preview && (
            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-white/35">Arte original</p>
              <img src={preview} alt="Arte evaluado" className="w-full rounded-2xl object-contain" />
            </div>
          )}

          {/* Acción recomendada */}
          <div className={`rounded-[32px] p-5 text-center ${meta.bg}`}>
            <p className="text-xs font-black uppercase tracking-widest text-white/70">Acción recomendada</p>
            <p className="mt-2 text-base font-black text-white">{meta.icon} {accion_recomendada}</p>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className="space-y-5">
          {/* Lo que funciona / Lo que mejorar */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[32px] border border-emerald-400/15 bg-emerald-400/5 p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-black text-emerald-300">✅ Lo que funciona</h3>
              <ul className="space-y-3">
                {lo_que_funciona.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-white/70">
                    <span className="mt-0.5 flex-shrink-0 text-emerald-400">▸</span>{item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[32px] border border-red-400/15 bg-red-400/5 p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-black text-red-300">⚠️ Lo que mejorar</h3>
              <ul className="space-y-3">
                {lo_que_mejorar.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-white/70">
                    <span className="mt-0.5 flex-shrink-0 text-red-400">▸</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Desglose */}
          <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <h3 className="mb-5 text-xl font-black">Checklist creativo</h3>
            <div className="space-y-4">
              {criterios.map(({ label, key, max }) => (
                <div key={key}>
                  <div className="mb-1.5 flex items-center justify-between gap-4">
                    <span className="text-sm font-bold text-white/75">{label}</span>
                    <span className="text-sm font-black tabular-nums">{desglose[key] ?? 0}/{max}</span>
                  </div>
                  <Bar score={desglose[key] ?? 0} max={max} />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ══ GENERADOR DE IMAGEN ══════════════════════════════════════════════════ */}
      <section className="rounded-[32px] border border-purple-400/20 bg-gradient-to-br from-purple-600/10 via-pink-500/5 to-cyan-500/10 p-6 backdrop-blur-xl">
        <div className="mb-6 flex flex-col gap-4">
          <div>
            <div className="mb-1 inline-block rounded-full border border-purple-300/30 bg-purple-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-purple-200">
              Edición de imagen IA — gpt-image-1
            </div>
            <h3 className="text-xl font-black sm:text-2xl">Rehaz tu arte desde aquí</h3>
            <p className="mt-1 text-sm text-white/45">
              Toma tu imagen original y aplica todas las correcciones detectadas. Logo y elementos se conservan.
            </p>
          </div>
          {!generating && !generatedImage && (
            <Btn onClick={handleGenerate} full>
              🎨 Generar imagen mejorada
            </Btn>
          )}
          {!generating && generatedImage && (
            <div className="flex gap-3">
              <Btn onClick={handleDownload} full>⬇️ Descargar</Btn>
              <Btn onClick={handleGenerate} variant="ghost" full>🔄 Regenerar</Btn>
            </div>
          )}
        </div>

        {/* ── Estado: generando ── */}
        {generating && (
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <RainbowLogo progress={genProgress} />
            <span className="text-xs font-black tabular-nums text-white/60">{genProgress}%</span>
            <div>
              <p className="text-lg font-black text-white">Creando tu arte mejorado…</p>
              <p className="mt-2 text-sm text-white/50 transition-all duration-700">{genSteps[genTick]}</p>
            </div>
          </div>
        )}

        {/* ── Estado: error ── */}
        {genError && !generating && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-center">
            <p className="text-sm font-bold text-red-300">⚠️ {genError}</p>
            {genError.includes("OPENAI_API_KEY") && (
              <p className="mt-2 text-xs text-white/40">
                Agrega tu clave de OpenAI en el archivo <code className="text-cyan-300">.env</code> como{" "}
                <code className="text-cyan-300">OPENAI_API_KEY=sk-...</code> y reinicia el servidor.
              </p>
            )}
            <div className="mt-4">
              <Btn onClick={handleGenerate}>Intentar de nuevo</Btn>
            </div>
          </div>
        )}

        {/* ── Estado: imagen generada ── */}
        {generatedImage && !generating && (
          <div className="space-y-5">
            {/* Comparación lado a lado */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Original */}
              {preview && (
                <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 text-center text-[10px] font-black uppercase tracking-widest text-white/35">
                    Original
                  </p>
                  <img
                    src={preview}
                    alt="Arte original"
                    className="w-full rounded-xl object-contain"
                  />
                  <div className="mt-2 flex justify-center">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${veredictoClass(veredicto)}`}>
                      Score: {score_final}/100
                    </span>
                  </div>
                </div>
              )}
              {/* Generada */}
              <div className="overflow-hidden rounded-[24px] border border-purple-400/30 bg-black/20 p-3">
                <p className="mb-2 text-center text-[10px] font-black uppercase tracking-widest text-purple-300">
                  ✨ Versión mejorada
                </p>
                <img
                  src={generatedImage}
                  alt="Arte mejorado por IA"
                  className="w-full rounded-xl object-contain"
                />
                <div className="mt-2 flex justify-center">
                  {genAnalyzing ? (
                    <span className="flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-400/15 px-3 py-1 text-xs font-black text-purple-300">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-transparent border-t-purple-300 inline-block" />
                      Calculando score…
                    </span>
                  ) : genScore !== null ? (
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${veredictoClass(genVeredicto)}`}>
                      Score: {genScore}/100 — {genVeredicto}
                    </span>
                  ) : (
                    <span className="rounded-full border border-purple-400/30 bg-purple-400/15 px-3 py-1 text-xs font-black text-purple-300">
                      ✨ GPT-IMAGE-1
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Botones de descarga */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Btn onClick={handleDownload} full>
                ⬇️ Descargar imagen mejorada
              </Btn>
              <Btn variant="ghost" onClick={handleGenerate} full>
                🔄 Regenerar versión
              </Btn>
            </div>
          </div>
        )}

        {/* ── Estado: inicial (sin generar aún) ── */}
        {!generating && !generatedImage && !genError && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/15 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-400 text-3xl shadow-lg">
              🎨
            </div>
            <div>
              <p className="text-lg font-black">Tu arte mejorado en segundos</p>
              <p className="mt-1 text-sm text-white/40">
                Usa el botón de arriba para generar una versión rediseñada con todas las correcciones aplicadas.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView]         = useState("upload");
  const [preview, setPreview]   = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [formData, setFormData] = useState(null);
  const [error, setError]       = useState(null);

  const handleAnalyze = async (imageFile, form) => {
    setImageFile(imageFile);
    setFormData(form);
    setPreview(URL.createObjectURL(imageFile));
    setView("analyzing");
    setError(null);

    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));

      const res  = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Error desconocido");

      setAnalysis(data.analysis);
      setView("results");
    } catch (err) {
      setError(err.message);
      setView("upload");
    }
  };

  const handleReset = () => {
    setView("upload");
    setAnalysis(null);
    setPreview(null);
    setImageFile(null);
    setFormData(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#070812] text-white">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-pink-600/20 blur-3xl" />
      <div className="pointer-events-none fixed right-[-100px] top-40 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-150px] left-1/3 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />

      {/* ── Mobile top bar (visible only on < lg) ── */}
      <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-white/10 bg-[#070812]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <img src="/logo.png" alt="Color Panda Media Lab"
          className="h-9 w-9 flex-shrink-0 rounded-xl bg-white object-contain p-0.5 shadow" />
        <div className="min-w-0">
          <p className="text-sm font-black leading-none">Panda Proof</p>
          <p className="text-[10px] text-white/40">Director Creativo IA</p>
        </div>
        {analysis && view !== "analyzing" && (
          <div className="ml-auto flex flex-shrink-0 gap-1.5">
            <button
              onClick={() => setView("results")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                view === "results" ? "bg-white text-black" : "text-white/60 hover:bg-white/10"
              }`}
            >
              Resultado
            </button>
            <button
              onClick={handleReset}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                view === "upload" ? "bg-white text-black" : "text-white/60 hover:bg-white/10"
              }`}
            >
              Nuevo
            </button>
          </div>
        )}
      </header>

      <div className="relative mx-auto grid max-w-7xl gap-5 p-4 md:p-6 lg:grid-cols-[260px_1fr]">
        {/* ── Sidebar — desktop only ── */}
        <aside className="hidden self-start rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl lg:block lg:sticky lg:top-6">
          {/* Logo — always visible */}
          <div className="flex flex-col items-center gap-2 pb-2">
            <img
              src="/logo.png"
              alt="Color Panda Media Lab"
              className="h-24 w-24 rounded-3xl object-contain bg-white p-1 shadow-xl"
            />
            <div className="text-center">
              <h1 className="text-lg font-black leading-tight">Panda Proof</h1>
              <p className="text-[11px] font-medium text-white/40">Director Creativo IA</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="mt-8 space-y-2">
            <div
              onClick={() => view !== "analyzing" && (analysis ? setView("results") : null)}
              className={`cursor-pointer rounded-2xl px-4 py-3 text-sm font-bold transition ${
                view === "results" ? "bg-white text-black" : "text-white/50 hover:bg-white/10"
              }`}
            >
              Dashboard
            </div>
            <div
              onClick={handleReset}
              className={`cursor-pointer rounded-2xl px-4 py-3 text-sm font-bold transition ${
                view === "upload" || view === "analyzing" ? "bg-white text-black" : "text-white/50 hover:bg-white/10"
              }`}
            >
              Subir diseño
            </div>
          </nav>

          {/* Last score widget */}
          {analysis ? (
            <div
              className="mt-6 cursor-pointer rounded-3xl border border-white/10 bg-gradient-to-br from-pink-500/20 to-cyan-400/10 p-5 text-center"
              onClick={() => setView("results")}
            >
              <p className="text-xs font-black uppercase tracking-widest text-cyan-200">Último análisis</p>
              <div className="mt-3 text-5xl font-black">{analysis.score_final}</div>
              <p className="text-xs text-white/45">/100 — {analysis.veredicto}</p>
              <div className={`mt-3 rounded-xl py-1.5 text-xs font-black text-white ${accionMeta(analysis.accion_recomendada).bg}`}>
                {analysis.accion_recomendada}
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-pink-500/20 to-cyan-400/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Director creativo IA</p>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                Sube un diseño y recibe un análisis honesto con un prompt listo para regenerarlo mejorado.
              </p>
            </div>
          )}
        </aside>

        {/* ── Main ── */}
        <main>
          {error && (
            <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm text-red-300">
              ⚠️ {error}
            </div>
          )}

          {view === "upload"    && <UploadView onAnalyze={handleAnalyze} globalError={null} />}
          {view === "analyzing" && <AnalyzingView preview={preview} />}
          {view === "results"   && analysis && (
            <ResultsView analysis={analysis} preview={preview} imageFile={imageFile} formData={formData} onReset={handleReset} />
          )}
        </main>
      </div>
    </div>
  );
}
