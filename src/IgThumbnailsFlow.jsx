// ══════════════════════════════════════════════════════════════════════════════
// THUMBNAILS IG — flujo independiente
//   Sube screenshot del perfil → IA analiza el estilo → genera un set de
//   portadas de Reels (9:16) y/o thumbnails de posts (1:1).
// Mobile-first, dark mode, mismo lenguaje visual de Panda AdLab.
// ══════════════════════════════════════════════════════════════════════════════
import React, { useState, useRef } from "react";
import { BRAND } from "./brand";
import { authedFetch } from "./api";
import { saveIgSession, saveResult } from "./supabase";

const COUNT_OPTIONS = ["auto", "4", "6", "9"];

const SUGERIDAS = [
  "Más minimalista",
  "Más colorido y llamativo",
  "Estilo premium",
  "Más urbano",
  "Mantén mis colores",
  "Texto grande y legible",
  "Estilo editorial",
  "Más juvenil",
];

// ── Mini UI atoms ────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", disabled = false, full = false, small = false }) {
  const base = `rounded-2xl font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${full ? "w-full" : ""} ${small ? "px-4 py-2 text-xs" : "px-5 py-3.5 text-sm"}`;
  const styles = variant === "primary"
    ? "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 text-white shadow-lg shadow-purple-500/30 hover:brightness-110 active:scale-[0.98]"
    : variant === "white"
    ? "bg-white text-black hover:bg-white/90 active:scale-[0.98]"
    : "border border-white/15 bg-white/5 text-white hover:bg-white/10";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function Pill({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
        active
          ? "border-pink-300/50 bg-pink-300/15 text-pink-100"
          : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <section className={`rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:rounded-[28px] sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

function RainbowLogo({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full" style={{ background: "conic-gradient(from 0deg, #ec4899, #a855f7, #06b6d4, #ec4899)", animationDuration: "2.5s" }} />
        <div className="relative h-[88%] w-[88%] overflow-hidden rounded-full bg-[#070812]">
          <img src={BRAND.logo} alt="" className="h-full w-full object-contain p-2" />
        </div>
      </div>
      <p className="text-sm font-bold text-white/80">{label}</p>
    </div>
  );
}

function Badge({ icon, label }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/70">
      <span>{icon}</span>
      <span className="truncate font-bold">{label}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FLUJO PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function IgThumbnailsFlow({ onExit, initialSession = null, onSavedSession }) {
  const [step, setStep]             = useState(initialSession ? "results" : "upload");
  const [file, setFile]             = useState(null);
  const [screenshotUrl, setScreenshotUrl] = useState(initialSession?.screenshot || null);
  const [instructions, setInstructions] = useState(initialSession?.instructions || "");
  const [mode, setMode]             = useState(initialSession?.mode || "both"); // reels | posts | both
  const [count, setCount]           = useState("auto");
  const [analysis, setAnalysis]     = useState(initialSession?.analysis || null);
  const [thumbnails, setThumbnails] = useState(initialSession?.thumbnails || []);
  const [summary, setSummary]       = useState(initialSession?.summary || []);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [error, setError]           = useState(null);
  const [savedId, setSavedId]       = useState(initialSession?.savedId || null);

  const inputRef = useRef(null);
  const onPickFile = () => inputRef.current?.click();
  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setScreenshotUrl(reader.result);
    reader.readAsDataURL(f);
    setError(null);
  };

  async function runFlow({ reusedFile = null } = {}) {
    const theFile = reusedFile || file;
    if (!theFile && !screenshotUrl) {
      setError("Sube un screenshot de tu perfil de Instagram para comenzar.");
      return;
    }
    setError(null);
    setStep("processing");

    try {
      // Paso 1 — Análisis del perfil (si no lo tenemos)
      let currentAnalysis = analysis;
      if (!currentAnalysis) {
        setLoadingLabel("Analizando tu perfil con IA...");
        const fd = new FormData();
        if (theFile)            fd.append("image", theFile);
        else if (screenshotUrl) fd.append("image", await dataUrlToFile(screenshotUrl, "perfil.png"));
        const res  = await authedFetch("/api/ig/analyze", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "No se pudo analizar el perfil.");
        currentAnalysis = data.analysis;
        setAnalysis(currentAnalysis);
      }

      // Paso 2 — Generar el set de thumbnails
      setLoadingLabel("Creando tus thumbnails...");
      const fd = new FormData();
      if (theFile)            fd.append("image", theFile);
      else if (screenshotUrl) fd.append("image", await dataUrlToFile(screenshotUrl, "perfil.png"));
      fd.append("analysis",     JSON.stringify(currentAnalysis));
      fd.append("instructions", instructions);
      fd.append("mode",         mode);
      fd.append("count",        count);
      const res  = await authedFetch("/api/ig/thumbnails", { method: "POST", body: fd });
      const data = await res.json();
      if (res.status === 402) { setStep("upload"); return; }
      if (!res.ok || !data.success) throw new Error(data.error || "No se pudieron generar los thumbnails.");

      const newThumbs = (data.thumbnails || []).filter((t) => t.image);
      setThumbnails(newThumbs);
      setSummary(data.summary || []);
      setStep("results");

      // Guardar — saveIgSession sube imágenes a Storage y devuelve URLs
      try {
        const session = {
          mode, instructions,
          screenshot: screenshotUrl || (theFile ? await fileToDataUrl(theFile) : null),
          thumbnails: newThumbs,
          analysis:   currentAnalysis,
          summary:    data.summary || [],
        };
        const row = await saveIgSession(session);
        if (row?.id) setSavedId(row.id);

        const savedThumbs = row?.data?.thumbnails || newThumbs;
        for (const t of savedThumbs) {
          if (!t?.image) continue;
          await saveResult({
            imageUrl:   t.image,
            type:       t.kind === "reel" ? "ig_reel_cover" : "ig_post",
            title:      `${currentAnalysis?.accountName || "IG"} — ${t.title}`,
            sourceFlow: "ig_thumbnails",
          });
        }
        if (onSavedSession) onSavedSession();
      } catch (e) {
        console.warn("[ig] save failed:", e?.message);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Ocurrió un error.");
      setStep("upload");
    }
  }

  function createAnother() {
    setThumbnails([]);
    setSummary([]);
    runFlow({ reusedFile: file });
  }
  function editInstructions() {
    setThumbnails([]);
    setSummary([]);
    setStep("upload");
  }
  function newProfile() {
    setFile(null);
    setScreenshotUrl(null);
    setInstructions("");
    setAnalysis(null);
    setThumbnails([]);
    setSummary([]);
    setSavedId(null);
    setError(null);
    setStep("upload");
  }

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="flex items-center justify-between gap-3 rounded-[24px] border border-pink-300/20 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-cyan-500/10 p-4 backdrop-blur-xl sm:rounded-[32px] sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 text-base shadow-lg shadow-pink-500/30">
            📸
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black sm:text-base">Thumbnails IG</h3>
              <span className="inline-flex items-center rounded-full border border-pink-300/40 bg-pink-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-pink-100">
                Nuevo
              </span>
            </div>
            <p className="text-[11px] text-white/40">
              {step === "upload"     && "Sube un screenshot de tu perfil"}
              {step === "processing" && "Generando con IA…"}
              {step === "results"    && "Tus thumbnails están listos"}
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

      {step === "upload" && (
        <UploadStep
          inputRef={inputRef}
          onPickFile={onPickFile}
          onFileChange={onFileChange}
          screenshotUrl={screenshotUrl}
          instructions={instructions}
          setInstructions={setInstructions}
          mode={mode}
          setMode={setMode}
          count={count}
          setCount={setCount}
          onRun={() => runFlow()}
        />
      )}

      {step === "processing" && <RainbowLogo label={loadingLabel || "Procesando…"} />}

      {step === "results" && (
        <ResultsStep
          thumbnails={thumbnails}
          summary={summary}
          savedId={savedId}
          onCreateAnother={createAnother}
          onEditInstructions={editInstructions}
          onNewProfile={newProfile}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// UPLOAD STEP
// ──────────────────────────────────────────────────────────────────────────────
function UploadStep({
  inputRef, onPickFile, onFileChange, screenshotUrl,
  instructions, setInstructions, mode, setMode, count, setCount, onRun,
}) {
  return (
    <>
      <Card>
        <h2 className="text-xl font-black leading-tight sm:text-2xl">Sube un screenshot de tu perfil</h2>
        <p className="mt-1 text-sm text-white/55">
          Una captura de tu feed, tu bio o un post. {BRAND.appName} detecta tu estilo, paleta y temas — y crea thumbnails que parecen de tu marca.
        </p>

        <div className="mt-5">
          <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
          {!screenshotUrl ? (
            <button
              onClick={onPickFile}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center transition hover:border-pink-300/40 hover:bg-white/[0.04]"
            >
              <span className="text-3xl">📲</span>
              <span className="text-sm font-black">Tocar para subir screenshot</span>
              <span className="text-[11px] text-white/40">PNG, JPG · captura del perfil de IG</span>
            </button>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <img src={screenshotUrl} alt="perfil" className="mx-auto max-h-80 w-auto object-contain" />
              <button
                onClick={onPickFile}
                className="absolute right-3 top-3 rounded-xl border border-white/20 bg-black/50 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur hover:bg-black/70"
              >
                Cambiar
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Tipo de salida */}
      <Card>
        <h3 className="text-sm font-black uppercase tracking-wider text-white/80">¿Qué quieres generar?</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ModeOption active={mode === "reels"} onClick={() => setMode("reels")}
            icon="🎬" title="Portadas de Reels" desc="Verticales 9:16 con gancho." />
          <ModeOption active={mode === "posts"} onClick={() => setMode("posts")}
            icon="🖼️" title="Thumbnails de posts" desc="Cuadrados 1:1 para el feed." />
          <ModeOption active={mode === "both"} onClick={() => setMode("both")}
            icon="✨" title="Ambos" desc="Set mixto: Reels + posts." />
        </div>
        <p className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2 text-[11px] text-white/40">
          Costo: <strong className="text-white/70">50 créditos</strong> por set completo.
        </p>
      </Card>

      {/* Cantidad */}
      <Card>
        <h3 className="text-sm font-black uppercase tracking-wider text-white/80">Cantidad de thumbnails</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {COUNT_OPTIONS.map((c) => (
            <Pill key={c} active={count === c} onClick={() => setCount(c)}>
              {c === "auto" ? "Auto" : c}
            </Pill>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-white/30">Default <strong className="text-white/60">Auto</strong> — la IA decide entre 4 y 9 según tu cuenta.</p>
      </Card>

      {/* Instrucciones */}
      <Card>
        <h3 className="text-sm font-black uppercase tracking-wider text-white/80">Instrucciones (opcional)</h3>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="Ejemplo: mantén mis colores, estilo minimalista, texto grande y legible, enfócate en tips de mi nicho."
          className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-pink-400/60"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGERIDAS.map((s) => (
            <Pill
              key={s}
              active={instructions.includes(s)}
              onClick={() => {
                if (instructions.includes(s)) return;
                setInstructions(instructions ? `${instructions}, ${s.toLowerCase()}` : s);
              }}
            >
              + {s}
            </Pill>
          ))}
        </div>
      </Card>

      <Btn full variant="primary" onClick={onRun}>
        ✨ Crear thumbnails
      </Btn>
    </>
  );
}

function ModeOption({ active, onClick, icon, title, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
        active
          ? "border-pink-300/50 bg-pink-300/10"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-black leading-tight">{title}</span>
      <span className="text-[11px] text-white/55">{desc}</span>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// RESULTS STEP
// ──────────────────────────────────────────────────────────────────────────────
function ResultsStep({ thumbnails, summary, savedId, onCreateAnother, onEditInstructions, onNewProfile }) {
  const reels = thumbnails.filter((t) => t.kind === "reel");
  const posts = thumbnails.filter((t) => t.kind !== "reel");

  return (
    <>
      <Card>
        <h2 className="text-xl font-black sm:text-2xl">Tus thumbnails están listos.</h2>
        {savedId && (
          <p className="mt-1 text-[11px] text-emerald-300">✓ Guardado automáticamente en Resultados y Mis Análisis.</p>
        )}
        {summary?.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {summary.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                <span className="mt-0.5 text-pink-300">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {reels.length > 0 && (
        <Card>
          <h3 className="text-sm font-black uppercase tracking-wider text-white/80">
            Portadas de Reels <span className="text-white/40">({reels.length})</span>
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {reels.map((t, i) => <ThumbTile key={i} t={t} ratio="9/16" />)}
          </div>
        </Card>
      )}

      {posts.length > 0 && (
        <Card>
          <h3 className="text-sm font-black uppercase tracking-wider text-white/80">
            Thumbnails de posts <span className="text-white/40">({posts.length})</span>
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {posts.map((t, i) => <ThumbTile key={i} t={t} ratio="1/1" />)}
          </div>
        </Card>
      )}

      <Card>
        <div className="grid gap-2 sm:grid-cols-2">
          <Btn variant="white" full onClick={onCreateAnother}>🔁 Crear otra versión</Btn>
          <Btn variant="ghost" full onClick={onEditInstructions}>✏️ Editar instrucciones</Btn>
          <Btn variant="ghost" full onClick={onNewProfile}>📲 Nuevo perfil</Btn>
        </div>
      </Card>
    </>
  );
}

function ThumbTile({ t, ratio }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <div className="bg-black" style={{ aspectRatio: ratio }}>
        <img src={t.image} alt={t.title} className="h-full w-full object-cover" />
      </div>
      <figcaption className="px-3 py-2">
        <p className="text-[11px] font-bold text-white/70">{t.title}</p>
        {t.hook && <p className="mt-0.5 text-[10px] text-white/40">"{t.hook}"</p>}
      </figcaption>
    </figure>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CARD DE ENTRADA (exportada por si se usa fuera de CreateView)
// ══════════════════════════════════════════════════════════════════════════════
export function IgThumbnailsEntryCard({ onPick }) {
  return (
    <button
      onClick={onPick}
      className="group relative w-full overflow-hidden rounded-[24px] border border-pink-300/25 bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-cyan-500/10 p-5 text-left backdrop-blur-xl transition hover:border-pink-300/45 active:scale-[0.99] sm:rounded-[32px] sm:p-6"
      style={{ boxShadow: "0 0 0 1px rgba(236, 72, 153, 0.15), 0 12px 40px -12px rgba(236, 72, 153, 0.35)" }}
    >
      <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-pink-300/40 bg-pink-500/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-pink-100">
        ✨ Nuevo
      </span>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 text-2xl shadow-lg shadow-pink-500/30">
        📸
      </div>
      <h3 className="text-2xl font-black leading-tight">Thumbnails IG</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        Sube un screenshot de tu perfil y {BRAND.appName} crea un set de portadas de Reels y thumbnails de posts con tu mismo estilo.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Badge icon="🧠" label="Detecta tu estilo" />
        <Badge icon="🎬" label="Portadas Reels" />
        <Badge icon="🖼️" label="Posts del feed" />
        <Badge icon="📦" label="Set completo" />
      </div>
      <div className="mt-5">
        <div className="rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 px-5 py-3.5 text-center text-sm font-black text-white shadow-lg shadow-purple-500/30 transition group-hover:brightness-110">
          📸 Subir screenshot
        </div>
      </div>
    </button>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function dataUrlToFile(dataUrl, name) {
  const r = await fetch(dataUrl);
  const blob = await r.blob();
  return new File([blob], name, { type: blob.type || "image/png" });
}
