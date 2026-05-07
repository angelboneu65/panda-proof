import React, { useState, useRef, useEffect, useCallback } from "react";

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
  }[v] ?? "border-white/15 bg-white/5 text-white/60");

const accionMeta = (a) =>
  ({
    "Publicarlo como está":     { bg: "bg-emerald-600", icon: "✅" },
    "Hacer ajustes menores":    { bg: "bg-cyan-700",    icon: "🔧" },
    "Rediseñarlo parcialmente": { bg: "bg-orange-600",  icon: "⚠️" },
    "Rediseñarlo completo":     { bg: "bg-red-600",     icon: "🚫" },
  }[a] ?? { bg: "bg-purple-600", icon: "📋" });

// ── Score ring (animates) ─────────────────────────────────────────────────────
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

function Bar({ value, max }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-400 transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

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
      {hint && !error && <p className="mt-1 text-[11px] text-white/30">{hint}</p>}
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

function Btn({ children, onClick, variant = "primary", disabled = false, full = false, small = false }) {
  const base = `rounded-2xl font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
    full ? "w-full" : ""
  } ${small ? "px-4 py-2 text-xs" : "px-5 py-3.5 text-sm"}`;
  const styles =
    variant === "primary"
      ? "bg-white text-black hover:bg-white/90 active:scale-[0.98]"
      : "border border-white/15 bg-white/5 text-white hover:bg-white/10";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

// ── Rainbow spinner (analysis / generation) ───────────────────────────────────
function RainbowLogo({ progress = null }) {
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
        <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
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
      <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-white/10 bg-white shadow-xl"
           style={{ filter: "drop-shadow(0 0 12px rgba(150,80,255,0.4))" }}>
        <img src="/logo.png" alt="Panda Proof" className="h-full w-full object-contain p-1" />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// UPLOAD VIEW
// ══════════════════════════════════════════════════════════════════════════════
function UploadView({ onAnalyze, globalError }) {
  const [image, setImage]           = useState(null);
  const [preview, setPreview]       = useState(null);
  const [dragging, setDragging]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [errors, setErrors]         = useState({});
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
      const res  = await fetch(`${API_BASE}/api/extract`, { method: "POST", body: fd });
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
      <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1.5 text-xs font-black text-cyan-200">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Director Creativo IA
        </div>
        <h2 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">
          Tu arte puede verse<br className="hidden sm:block" /> bonito… pero,{" "}
          <span className="bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">
            ¿está listo para vender?
          </span>
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/50 sm:text-base">
          Sube tu diseño y Panda Proof evaluará su claridad, CTA, legibilidad móvil y
          potencial de conversión. Recibirás un diagnóstico honesto y una versión optimizada.
        </p>

        {/* Value bullets */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { icon: "🎯", label: "Panda Score" },
            { icon: "🔍", label: "Diagnóstico de CTA" },
            { icon: "📱", label: "Legibilidad móvil" },
            { icon: "📋", label: "Prompt profesional" },
            { icon: "✨", label: "Arte optimizado" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
              <span className="text-base">{icon}</span>
              <span className="text-[11px] font-bold text-white/55">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo result snippet ── */}
      <section className="rounded-[28px] border border-white/8 bg-white/[0.02] p-4 backdrop-blur-xl">
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/25">
          Ejemplo de resultado
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-2.5">
            <span className="text-2xl font-black text-yellow-300">74</span>
            <div>
              <p className="text-[10px] font-black text-yellow-300/70">Panda Score</p>
              <p className="text-[10px] text-white/35">Bueno</p>
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
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
          <h3 className="mb-1 text-lg font-black">Sube tu arte</h3>
          <p className="mb-5 text-xs text-white/40">PNG, JPG o captura de pantalla. Máx 20 MB.</p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => !preview && fileRef.current?.click()}
            className={`relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[24px] border-2 transition-all ${
              errors.image     ? "border-red-400/50 bg-red-400/5"
              : dragging       ? "border-cyan-400 bg-cyan-400/10"
              : preview        ? "cursor-default border-white/10 bg-transparent"
              : "border-dashed border-white/20 bg-black/25 hover:border-white/40"
            }`}
          >
            {preview ? (
              <>
                <img src={preview} alt="Vista previa" className="max-h-[400px] w-full object-contain" />
                <button
                  onClick={(e) => { e.stopPropagation(); setImage(null); setPreview(null); setAutoFilled(false); setForm({ nicho: "", producto: "", publico: "", plataforma: "", objetivo: "", oferta: "" }); }}
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
                <p className="text-[11px] text-white/25">
                  Panda Proof detectará el contexto automáticamente
                </p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => handleFile(e.target.files[0])} />
          {errors.image && <p className="mt-2 text-xs text-red-400">{errors.image}</p>}
        </div>

        {/* RIGHT — context form */}
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">

          {/* Form header */}
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="text-lg font-black">Contexto detectado</h3>
            </div>
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

          {/* Smart microcopy */}
          <div className="mb-5 rounded-2xl border border-cyan-400/10 bg-cyan-400/5 px-4 py-3">
            <p className="text-[11px] leading-relaxed text-cyan-200/70">
              {!image
                ? "🔍 Al subir tu imagen, Panda Proof detectará el negocio, producto, público y objetivo automáticamente. Podrás editar antes del análisis."
                : extracting
                ? "🔍 Detectando contexto de tu arte…"
                : autoFilled
                ? "✅ Contexto detectado automáticamente. Revisa y ajusta si algo no está correcto."
                : "✏️ Completa el contexto para que el análisis sea más preciso."}
            </p>
          </div>

          <div className="space-y-4">
            <Field
              label="Tipo de negocio" placeholder="Ej: Spa, Restaurante, Clínica…"
              value={form.nicho} onChange={set("nicho")} error={errors.nicho} required
            />
            <Field
              label="¿Qué se está vendiendo?" placeholder="Ej: Masaje relajante 60 min"
              value={form.producto} onChange={set("producto")} error={errors.producto} required
            />
            <Field
              label="Público objetivo" placeholder="Ej: Mujeres 25–45 años"
              value={form.publico} onChange={set("publico")} error={errors.publico} required
            />
            <SelectField
              label="Plataforma destino" value={form.plataforma}
              onChange={set("plataforma")} error={errors.plataforma} required
              options={["Instagram Stories","Instagram Feed","Facebook","TikTok",
                        "WhatsApp Status","Google Ads","Web / Landing page","Impreso / Flyer"]}
            />
            <SelectField
              label="Objetivo de conversión" value={form.objetivo}
              onChange={set("objetivo")} error={errors.objetivo} required
              options={["Mensajes / WhatsApp","Ventas directas","Reservas","Llamadas",
                        "Tráfico web","Reconocimiento de marca","Captación de leads"]}
            />
            <Field
              label="Oferta o precio (opcional)" placeholder="Ej: 50% OFF, desde $29, 2×1"
              value={form.oferta} onChange={set("oferta")}
              hint="Si hay una promoción visible en el arte, detállala aquí"
            />
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
            <p className="text-center text-[11px] text-white/30">
              El análisis toma entre 15 y 30 segundos
            </p>
          </div>
        </div>
      </div>

      {/* ── How it works steps ── */}
      <section className="rounded-[28px] border border-white/8 bg-white/[0.02] p-5 backdrop-blur-xl">
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
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-black text-white/60">
                {n}
              </span>
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
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 text-center">
      <RainbowLogo progress={null} />
      <div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
          Analizando tu arte…
        </div>
        <h2 className="text-2xl font-black sm:text-4xl">Tu director creativo IA trabajando</h2>
        <p className="mt-3 h-6 text-sm text-white/50 transition-all">{steps[tick]}</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULTS VIEW
// ══════════════════════════════════════════════════════════════════════════════

// All 10 Panda Score criteria — bars scale to their actual max
const ALL_CRITERIOS = [
  { label: "Claridad del mensaje",     key: "claridad_mensaje" },
  { label: "Fuerza de la oferta",      key: "fuerza_oferta" },
  { label: "Jerarquía visual",         key: "jerarquia_visual" },
  { label: "CTA / Llamado a la acción",key: "cta" },
  { label: "Legibilidad móvil",        key: "legibilidad_movil" },
  { label: "Relevancia con el nicho",  key: "relevancia_nicho" },
  { label: "Relevancia con el público",key: "relevancia_publico" },
  { label: "Confianza y credibilidad", key: "confianza_credibilidad" },
  { label: "Calidad visual premium",   key: "calidad_visual" },
  { label: "Fricción de conversión",   key: "friccion_conversion" },
];

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
    "Preservando concepto e identidad del arte…",
    "Aplicando correcciones de jerarquía visual…",
    "Ajustando legibilidad y contraste…",
    "Reforzando el CTA para conversión…",
    "Optimizando composición para móvil…",
    "Añadiendo toques finales de calidad…",
  ];

  const {
    score_final,
    veredicto,
    resumen,
    lo_que_funciona   = [],
    lo_que_mejorar    = [],
    desglose          = {},
    pesos_activos     = {},
    perfil_aplicado,
    prompt_profesional,
    accion_recomendada,
  } = analysis;

  const meta = accionMeta(accion_recomendada);

  // Only show criteria with a non-zero max weight
  const activeCriterios = ALL_CRITERIOS.filter(({ key }) => (pesos_activos[key] ?? 0) > 0);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt_profesional ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const analyzeGeneratedImage = async (base64DataUrl) => {
    if (!formData) return;
    setGenAnalyzing(true);
    try {
      const fetchRes = await fetch(base64DataUrl);
      const blob     = await fetchRes.blob();
      const fd = new FormData();
      fd.append("image", blob, "arte-mejorado.png");
      Object.entries(formData).forEach(([k, v]) => v && fd.append(k, v));
      const res  = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Error");
      setGenScore(data.analysis.score_final);
      setGenVeredicto(data.analysis.veredicto);
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
    setGenVeredicto(null);
    setGenProgress(0);

    const tickId = setInterval(() => setGenTick((t) => (t + 1) % genSteps.length), 3500);

    const TOTAL_MS = 80000;
    const INTERVAL = 400;
    const MAX_AUTO  = 92;
    let elapsed = 0;
    const progressId = setInterval(() => {
      elapsed += INTERVAL;
      setGenProgress(Math.min(MAX_AUTO, Math.round((elapsed / TOTAL_MS) * MAX_AUTO)));
    }, INTERVAL);

    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      // Send context so generation uses the dynamic prompt
      if (formData) {
        Object.entries(formData).forEach(([k, v]) => v && fd.append(k, v));
      }
      // Send detected problems as context for the generation prompt
      if (lo_que_mejorar.length) fd.append("problemas", lo_que_mejorar.join("; "));

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
    a.download = "arte-optimizado-pandaproof.png";
    a.click();
  };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <section className="flex flex-col gap-3 rounded-[32px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-block rounded-full border px-3 py-1 text-xs font-black ${veredictoClass(veredicto)}`}>
              {veredicto}
            </span>
            {perfil_aplicado && (
              <span className="inline-block rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-[10px] font-black text-purple-300">
                Perfil: {perfil_aplicado}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Análisis completado</h2>
        </div>
        <Btn variant="ghost" onClick={onReset} small>← Nuevo análisis</Btn>
      </section>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">

        {/* ── LEFT col ── */}
        <div className="space-y-5">

          {/* Panda Score */}
          <div className="flex flex-col items-center gap-5 rounded-[32px] border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-xl">
            <ScoreCircle score={score_final} />
            <div className={`w-full rounded-2xl py-2.5 text-sm font-black text-white ${meta.bg}`}>
              {meta.icon} {accion_recomendada}
            </div>
          </div>

          {/* Diagnóstico */}
          <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/30">Diagnóstico</p>
            <p className="text-sm leading-relaxed text-white/70">{resumen}</p>
          </div>

          {/* Arte original */}
          {preview && (
            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/30">Arte original</p>
              <img src={preview} alt="Arte original" className="w-full rounded-2xl object-contain" />
              <div className="mt-3 text-center">
                <span className={`inline-block rounded-full border px-3 py-1 text-xs font-black ${veredictoClass(veredicto)}`}>
                  Score: {score_final}/100
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT col ── */}
        <div className="space-y-5">

          {/* Lo que funciona / Lo que mejorar */}
          <div className="grid gap-4 sm:grid-cols-2">
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
              <h3 className="mb-4 text-sm font-black text-red-300">⚠️ Oportunidades de mejora</h3>
              <ul className="space-y-3">
                {lo_que_mejorar.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-white/70">
                    <span className="mt-0.5 flex-shrink-0 text-red-400">▸</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Panda Score desglose */}
          <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-black">Panda Score — Desglose</h3>
              {perfil_aplicado && (
                <span className="text-[10px] font-black text-white/25">{perfil_aplicado}</span>
              )}
            </div>
            {activeCriterios.length > 0 ? (
              <div className="space-y-4">
                {activeCriterios.map(({ label, key }) => {
                  const val = desglose[key] ?? 0;
                  const max = pesos_activos[key] ?? 20;
                  const pct = Math.round((val / max) * 100);
                  return (
                    <div key={key}>
                      <div className="mb-1.5 flex items-center justify-between gap-4">
                        <span className="text-sm font-bold text-white/75">{label}</span>
                        <span className="text-xs font-black tabular-nums text-white/60">
                          {val}/{max}
                          <span className="ml-1 text-white/30">({pct}%)</span>
                        </span>
                      </div>
                      <Bar value={val} max={max} />
                    </div>
                  );
                })}
              </div>
            ) : (
              // Fallback: show all criteria with raw values
              <div className="space-y-4">
                {ALL_CRITERIOS.map(({ label, key }) => {
                  const val = desglose[key] ?? 0;
                  return (
                    <div key={key}>
                      <div className="mb-1.5 flex items-center justify-between gap-4">
                        <span className="text-sm font-bold text-white/75">{label}</span>
                        <span className="text-sm font-black tabular-nums">{val}</span>
                      </div>
                      <Bar value={val} max={20} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prompt profesional */}
          {prompt_profesional && (
            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-xl font-black">Prompt profesional</h3>
                <button
                  onClick={handleCopy}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/10"
                >
                  {copied ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">
                Usa este briefing para regenerar tu arte con la IA de tu preferencia
              </p>
              <div className="max-h-52 overflow-y-auto rounded-2xl bg-black/40 p-4">
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-white/60">
                  {prompt_profesional}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ GENERADOR DE IMAGEN ══════════════════════════════════════════════════ */}
      <section className="rounded-[32px] border border-purple-400/20 bg-gradient-to-br from-purple-600/10 via-pink-500/5 to-cyan-500/10 p-6 backdrop-blur-xl">
        <div className="mb-6 flex flex-col gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-purple-300/30 bg-purple-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-purple-200">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              Arte mejorado IA — gpt-image-1
            </div>
            <h3 className="text-xl font-black sm:text-2xl">Arte optimizado para vender</h3>
            <p className="mt-1 text-sm text-white/45">
              Aplica todas las correcciones detectadas conservando el concepto, logo y persona principal de tu arte original.
            </p>
          </div>
          {!generating && !generatedImage && (
            <Btn onClick={handleGenerate} full>
              🎨 Generar arte optimizado
            </Btn>
          )}
          {!generating && generatedImage && (
            <div className="flex gap-3">
              <Btn onClick={handleDownload} full>⬇️ Descargar</Btn>
              <Btn onClick={handleGenerate} variant="ghost" full>🔄 Regenerar</Btn>
            </div>
          )}
        </div>

        {generating && (
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <RainbowLogo progress={genProgress} />
            <span className="text-xs font-black tabular-nums text-white/60">{genProgress}%</span>
            <div>
              <p className="text-lg font-black text-white">Optimizando tu arte…</p>
              <p className="mt-2 text-sm text-white/50 transition-all duration-700">{genSteps[genTick]}</p>
            </div>
          </div>
        )}

        {genError && !generating && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-center">
            <p className="text-sm font-bold text-red-300">⚠️ {genError}</p>
            {genError.includes("OPENAI_API_KEY") && (
              <p className="mt-2 text-xs text-white/40">
                Agrega tu clave de OpenAI como <code className="text-cyan-300">OPENAI_API_KEY=sk-...</code> en las variables de entorno.
              </p>
            )}
            <div className="mt-4">
              <Btn onClick={handleGenerate}>Intentar de nuevo</Btn>
            </div>
          </div>
        )}

        {generatedImage && !generating && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {preview && (
                <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 text-center text-[10px] font-black uppercase tracking-widest text-white/30">Original</p>
                  <img src={preview} alt="Arte original" className="w-full rounded-xl object-contain" />
                  <div className="mt-2 flex justify-center">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${veredictoClass(veredicto)}`}>
                      Score: {score_final}/100
                    </span>
                  </div>
                </div>
              )}
              <div className="overflow-hidden rounded-[24px] border border-purple-400/30 bg-black/20 p-3">
                <p className="mb-2 text-center text-[10px] font-black uppercase tracking-widest text-purple-300">
                  ✨ Arte optimizado
                </p>
                <img src={generatedImage} alt="Arte optimizado" className="w-full rounded-xl object-contain" />
                <div className="mt-2 flex justify-center">
                  {genAnalyzing ? (
                    <span className="flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-400/15 px-3 py-1 text-xs font-black text-purple-300">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-transparent border-t-purple-300" />
                      Calculando nuevo score…
                    </span>
                  ) : genScore !== null ? (
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${veredictoClass(genVeredicto)}`}>
                      Score: {genScore}/100 — {genVeredicto}
                    </span>
                  ) : (
                    <span className="rounded-full border border-purple-400/30 bg-purple-400/15 px-3 py-1 text-xs font-black text-purple-300">
                      ✨ Optimizado con IA
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Btn onClick={handleDownload} full>⬇️ Descargar arte optimizado</Btn>
              <Btn variant="ghost" onClick={handleGenerate} full>🔄 Regenerar versión</Btn>
            </div>
          </div>
        )}

        {!generating && !generatedImage && !genError && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/15 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-400 text-3xl shadow-lg">🎨</div>
            <div>
              <p className="text-lg font-black">Arte optimizado en segundos</p>
              <p className="mt-1 max-w-sm text-sm text-white/40">
                El sistema preserva tu concepto, logo y persona principal — solo mejora lo que afecta la conversión.
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
  const [view, setView]           = useState("upload");
  const [preview, setPreview]     = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [analysis, setAnalysis]   = useState(null);
  const [formData, setFormData]   = useState(null);
  const [error, setError]         = useState(null);

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

      {/* ── Mobile top bar ── */}
      <header className="sticky top-0 z-50 flex items-center gap-3 border-b border-white/10 bg-[#070812]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <img src="/logo.png" alt="Panda Proof"
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
                view === "upload" || view === "analyzing" ? "bg-white text-black" : "text-white/60 hover:bg-white/10"
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
          <div className="flex flex-col items-center gap-2 pb-2">
            <img src="/logo.png" alt="Panda Proof"
              className="h-24 w-24 rounded-3xl object-contain bg-white p-1 shadow-xl" />
            <div className="text-center">
              <h1 className="text-lg font-black leading-tight">Panda Proof</h1>
              <p className="text-[11px] font-medium text-white/40">Director Creativo IA</p>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            <div
              onClick={() => view !== "analyzing" && analysis ? setView("results") : null}
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

          {analysis ? (
            <div
              className="mt-6 cursor-pointer rounded-3xl border border-white/10 bg-gradient-to-br from-pink-500/20 to-cyan-400/10 p-5 text-center"
              onClick={() => setView("results")}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Último Panda Score</p>
              <div className="mt-3 text-5xl font-black">{analysis.score_final}</div>
              <p className="text-xs text-white/45">/100 — {analysis.veredicto}</p>
              {analysis.perfil_aplicado && (
                <p className="mt-1 text-[10px] text-white/30">{analysis.perfil_aplicado}</p>
              )}
              <div className={`mt-3 rounded-xl py-1.5 text-xs font-black text-white ${accionMeta(analysis.accion_recomendada).bg}`}>
                {analysis.accion_recomendada}
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-pink-500/20 to-cyan-400/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-200">
                ¿Está listo para vender?
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                Sube un diseño y recibe tu Panda Score — diagnóstico honesto y arte optimizado.
              </p>
            </div>
          )}
        </aside>

        {/* ── Main content ── */}
        <main>
          {error && (
            <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-sm text-red-300">
              ⚠️ {error}
            </div>
          )}
          {view === "upload"    && <UploadView onAnalyze={handleAnalyze} globalError={null} />}
          {view === "analyzing" && <AnalyzingView />}
          {view === "results"   && analysis && (
            <ResultsView
              analysis={analysis}
              preview={preview}
              imageFile={imageFile}
              formData={formData}
              onReset={handleReset}
            />
          )}
        </main>
      </div>
    </div>
  );
}
