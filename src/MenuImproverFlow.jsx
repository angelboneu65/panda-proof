// ══════════════════════════════════════════════════════════════════════════════
// MEJORAR MENÚ — flujo independiente
//   Upload → Opus analiza → gpt-image-2 genera menú completo y/o serie 9:16
// Mobile-first, dark mode, mismo lenguaje visual de Panda AdLab.
// ══════════════════════════════════════════════════════════════════════════════
import React, { useState, useRef } from "react";
import { BRAND } from "./brand";
import { authedFetch } from "./api";
import { saveMenuSession, saveResult } from "./supabase";

const FORMATS = [
  { value: "1080x1920", label: "Story 9:16",   note: "Instagram / Facebook Story" },
  { value: "1080x1080", label: "Cuadrado 1:1", note: "Feed Instagram" },
  { value: "1080x1350", label: "Vertical 4:5", note: "Feed alargado" },
  { value: "8.5x11",    label: "Impreso",     note: "8.5x11 carta" },
  { value: "original",  label: "Proporción original", note: "Mantener la del menú" },
];

const STORY_COUNT_OPTIONS = ["auto", "3", "5", "7", "10"];

const SUGERIDAS = [
  "Hazlo más elegante",
  "Mantén los colores",
  "Usa estilo moderno",
  "Hazlo más limpio",
  "Que se vea como restaurante premium",
  "Mantén las fotos",
  "Hazlo para Instagram Story",
  "Hazlo tipo menú impreso",
];

// ── Mini UI atoms (alineados al lenguaje del app) ────────────────────────────
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
          ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
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

// ══════════════════════════════════════════════════════════════════════════════
// CARD DE ENTRADA (se renderiza en CreateView)
// ══════════════════════════════════════════════════════════════════════════════
export function MenuImproverEntryCard({ onPick }) {
  return (
    <button
      onClick={onPick}
      className="group relative overflow-hidden rounded-[24px] border border-cyan-300/25 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-pink-500/10 p-5 text-left backdrop-blur-xl transition hover:border-cyan-300/45 active:scale-[0.99] sm:rounded-[32px] sm:p-6"
      style={{ boxShadow: "0 0 0 1px rgba(6, 182, 212, 0.15), 0 12px 40px -12px rgba(6, 182, 212, 0.35)" }}
    >
      <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-cyan-300/40 bg-cyan-500/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-100">
        ✨ Nuevo
      </span>

      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 text-2xl shadow-lg shadow-cyan-500/30">
        🍽️
      </div>
      <h3 className="text-2xl font-black leading-tight">Mejorar Menú</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        Sube un menú actual y {BRAND.appName} lo convierte en una versión más profesional, clara y lista para vender.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Badge icon="🧠" label="Análisis Opus" />
        <Badge icon="🎨" label="Rediseño limpio" />
        <Badge icon="📱" label="Historias 9:16" />
        <Badge icon="🖼️" label="Usa tus fotos" />
        <Badge icon="📐" label="Varios formatos" />
      </div>

      <div className="mt-5">
        <div className="rounded-2xl bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 px-5 py-3.5 text-center text-sm font-black text-white shadow-lg shadow-purple-500/30 transition group-hover:brightness-110">
          🍽️ Subir menú
        </div>
      </div>
    </button>
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
export default function MenuImproverFlow({ onExit, initialSession = null, onSavedSession }) {
  const [step, setStep]              = useState(initialSession ? "results" : "upload");
  const [file, setFile]              = useState(null);
  const [originalDataUrl, setOriginalDataUrl] = useState(initialSession?.originalImage || null);
  const [instructions, setInstructions] = useState(initialSession?.instructions || "");
  const [format, setFormat]          = useState(initialSession?.format || "1080x1920");
  const [mode, setMode]              = useState(initialSession?.mode || "improve"); // improve | segment | both
  const [storyCount, setStoryCount]  = useState("auto");
  const [analysis, setAnalysis]      = useState(initialSession?.analysis || null);
  const [improvedImage, setImprovedImage] = useState(initialSession?.improvedImage || null);
  const [stories, setStories]        = useState(initialSession?.stories || []);
  const [summary, setSummary]        = useState(initialSession?.summary || []);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [error, setError]            = useState(null);
  const [warn, setWarn]              = useState(null);
  const [savedId, setSavedId]        = useState(initialSession?.savedId || null);

  // ── File handlers ──
  const inputRef = useRef(null);
  const onPickFile = () => inputRef.current?.click();
  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setOriginalDataUrl(reader.result);
    reader.readAsDataURL(f);
    setError(null);
  };

  // ── Acciones principales ──
  async function runFlow({ reusedFile = null } = {}) {
    const theFile = reusedFile || file;
    if (!theFile && !originalDataUrl) {
      setError("Sube una imagen de tu menú para comenzar.");
      return;
    }
    setError(null);
    setWarn(null);
    setStep("processing");

    try {
      // Paso 1 — Análisis con Opus (si no lo tenemos ya)
      let currentAnalysis = analysis;
      if (!currentAnalysis) {
        setLoadingLabel("Analizando menú con IA...");
        const fd = new FormData();
        if (theFile)              fd.append("image", theFile);
        else if (originalDataUrl) fd.append("image", await dataUrlToFile(originalDataUrl, "menu.png"));
        const res  = await authedFetch("/api/menu/analyze", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "No se pudo analizar el menú.");
        currentAnalysis = data.analysis;
        setAnalysis(currentAnalysis);
        if (currentAnalysis?.looksLikeMenu === false) {
          setWarn("La imagen no parece ser un menú tradicional. Aun así puedo mejorarla como pieza informativa.");
        } else if (currentAnalysis?.illegibleAreas) {
          setWarn("Algunos textos no se pudieron leer con claridad. Revisa el resultado antes de publicarlo.");
        }
      }

      // Paso 2a — Menú completo
      let newImproved = improvedImage;
      let newStories  = stories;
      const accumSummary = [];

      if (mode === "improve" || mode === "both") {
        setLoadingLabel("Preparando rediseño profesional...");
        const fd = new FormData();
        if (theFile)              fd.append("image", theFile);
        else if (originalDataUrl) fd.append("image", await dataUrlToFile(originalDataUrl, "menu.png"));
        fd.append("analysis",     JSON.stringify(currentAnalysis));
        fd.append("instructions", instructions);
        fd.append("format",       format);
        const res  = await authedFetch("/api/menu/improve", { method: "POST", body: fd });
        const data = await res.json();
        if (res.status === 402) { setStep("upload"); return; }
        if (!res.ok || !data.success) throw new Error(data.error || "No se pudo generar el menú mejorado.");
        newImproved = data.image;
        setImprovedImage(newImproved);
        accumSummary.push(...(data.summary || []));
      }

      // Paso 2b — Historias 9:16
      if (mode === "segment" || mode === "both") {
        setLoadingLabel("Generando historias 9:16...");
        const fd = new FormData();
        if (theFile)              fd.append("image", theFile);
        else if (originalDataUrl) fd.append("image", await dataUrlToFile(originalDataUrl, "menu.png"));
        fd.append("analysis",     JSON.stringify(currentAnalysis));
        fd.append("instructions", instructions);
        fd.append("count",        storyCount);
        const res  = await authedFetch("/api/menu/segment", { method: "POST", body: fd });
        const data = await res.json();
        if (res.status === 402) { setStep("upload"); return; }
        if (!res.ok || !data.success) throw new Error(data.error || "No se pudieron generar las historias.");
        newStories = (data.stories || []).filter((s) => s.image);
        setStories(newStories);
        accumSummary.push(...(data.summary || []));
      }

      setSummary(accumSummary);
      setStep("results");

      // Guardar la sesión completa (incluye originalImage como dataURL)
      try {
        const session = {
          mode, format, instructions,
          originalImage: originalDataUrl || (theFile ? await fileToDataUrl(theFile) : null),
          improvedImage: newImproved,
          stories:       newStories,
          analysis:      currentAnalysis,
          summary:       accumSummary,
        };
        const row = await saveMenuSession(session);
        if (row?.id) setSavedId(row.id);
        // Guardar cada imagen en saved_results (galería)
        if (newImproved) {
          await saveResult({
            imageUrl:   newImproved,
            type:       "menu_improved",
            title:      currentAnalysis?.businessName || "Menú mejorado",
            sourceFlow: "menu_improver",
          });
        }
        for (const s of newStories) {
          await saveResult({
            imageUrl:   s.image,
            type:       "menu_story",
            title:      `${currentAnalysis?.businessName || "Menú"} — ${s.title}`,
            sourceFlow: "menu_improver",
          });
        }
        if (onSavedSession) onSavedSession();
      } catch (e) {
        console.warn("[menu] save failed:", e?.message);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Ocurrió un error.");
      setStep("upload");
    }
  }

  // Crear otra versión: misma foto, mismo análisis, regenera lo elegido
  function createAnotherVersion() {
    setImprovedImage(null);
    setStories([]);
    setSummary([]);
    runFlow({ reusedFile: file });
  }

  // Generar más historias (solo añade más al set, regenera todo el set con +2 si "auto")
  function generateMoreStories() {
    setStories([]);
    setSummary([]);
    const prev = stories.length;
    const next = prev > 0 ? Math.min(10, prev + 2) : 5;
    setStoryCount(String(next));
    setMode("segment");
    runFlow({ reusedFile: file });
  }

  function editInstructions() {
    setImprovedImage(null);
    setStories([]);
    setSummary([]);
    setStep("upload");
  }

  function newMenu() {
    setFile(null);
    setOriginalDataUrl(null);
    setInstructions("");
    setAnalysis(null);
    setImprovedImage(null);
    setStories([]);
    setSummary([]);
    setSavedId(null);
    setError(null);
    setWarn(null);
    setStep("upload");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="flex items-center justify-between gap-3 rounded-[24px] border border-cyan-300/20 bg-gradient-to-br from-cyan-500/10 via-purple-500/5 to-pink-500/10 p-4 backdrop-blur-xl sm:rounded-[32px] sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 text-base shadow-lg shadow-cyan-500/30">
            🍽️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black sm:text-base">Mejorar Menú</h3>
              <span className="inline-flex items-center rounded-full border border-cyan-300/40 bg-cyan-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-cyan-100">
                Nuevo
              </span>
            </div>
            <p className="text-[11px] text-white/40">
              {step === "upload"     && "Sube tu menú actual"}
              {step === "processing" && "Procesando con IA…"}
              {step === "results"    && (mode === "segment" ? "Historias listas" : "Menú mejorado listo")}
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
      {warn && step !== "upload" && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm text-amber-200">
          ⚠️ {warn}
        </div>
      )}

      {step === "upload"     && (
        <UploadStep
          inputRef={inputRef}
          onPickFile={onPickFile}
          onFileChange={onFileChange}
          originalDataUrl={originalDataUrl}
          instructions={instructions}
          setInstructions={setInstructions}
          format={format}
          setFormat={setFormat}
          mode={mode}
          setMode={setMode}
          storyCount={storyCount}
          setStoryCount={setStoryCount}
          onRun={() => runFlow()}
        />
      )}

      {step === "processing" && <RainbowLogo label={loadingLabel || "Procesando…"} />}

      {step === "results" && (
        <ResultsStep
          mode={mode}
          originalDataUrl={originalDataUrl}
          improvedImage={improvedImage}
          stories={stories}
          summary={summary}
          savedId={savedId}
          onCreateAnother={createAnotherVersion}
          onEditInstructions={editInstructions}
          onGenerateMoreStories={generateMoreStories}
          onNewMenu={newMenu}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// UPLOAD STEP
// ──────────────────────────────────────────────────────────────────────────────
function UploadStep({
  inputRef, onPickFile, onFileChange, originalDataUrl,
  instructions, setInstructions,
  format, setFormat,
  mode, setMode,
  storyCount, setStoryCount,
  onRun,
}) {
  return (
    <>
      <Card>
        <h2 className="text-xl font-black leading-tight sm:text-2xl">
          Sube tu menú actual
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Panda AdLab analiza la imagen, identifica problemas de diseño y crea una versión más limpia, jerarquizada y vendedora.
        </p>

        <div className="mt-5">
          <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
          {!originalDataUrl ? (
            <button
              onClick={onPickFile}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center transition hover:border-cyan-300/40 hover:bg-white/[0.04]"
            >
              <span className="text-3xl">📤</span>
              <span className="text-sm font-black">Tocar para subir</span>
              <span className="text-[11px] text-white/40">PNG, JPG · hasta 20MB</span>
            </button>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <img src={originalDataUrl} alt="menú" className="mx-auto max-h-80 w-auto object-contain" />
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

      {/* Modo de salida */}
      <Card>
        <h3 className="text-sm font-black uppercase tracking-wider text-white/80">¿Qué quieres generar?</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ModeOption active={mode === "improve"} onClick={() => setMode("improve")}
            icon="🖼️" title="Menú mejorado completo" desc="Una pieza rediseñada en el formato que elijas." cost="50 créditos"
          />
          <ModeOption active={mode === "segment"} onClick={() => setMode("segment")}
            icon="📱" title="Historias 9:16 segmentadas" desc="Varias historias verticales separando categorías y ofertas." cost="50 créditos"
          />
          <ModeOption active={mode === "both"} onClick={() => setMode("both")}
            icon="✨" title="Ambos" desc="Menú completo + serie de historias 9:16." cost="100 créditos"
          />
        </div>
      </Card>

      {/* Formato (solo si genera menú completo) */}
      {(mode === "improve" || mode === "both") && (
        <Card>
          <h3 className="text-sm font-black uppercase tracking-wider text-white/80">Formato del menú mejorado</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <Pill key={f.value} active={format === f.value} onClick={() => setFormat(f.value)}>
                {f.label}
              </Pill>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/30">
            Recomendado: <strong className="text-white/60">Story 9:16</strong> si es para redes sociales.
          </p>
        </Card>
      )}

      {/* Cantidad de historias */}
      {(mode === "segment" || mode === "both") && (
        <Card>
          <h3 className="text-sm font-black uppercase tracking-wider text-white/80">Cantidad de historias</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {STORY_COUNT_OPTIONS.map((c) => (
              <Pill key={c} active={storyCount === c} onClick={() => setStoryCount(c)}>
                {c === "auto" ? "Auto" : c}
              </Pill>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/30">Default <strong className="text-white/60">Auto</strong> — Opus decide entre 3 y 10 según el contenido.</p>
        </Card>
      )}

      {/* Instrucciones */}
      <Card>
        <h3 className="text-sm font-black uppercase tracking-wider text-white/80">Instrucciones (opcional)</h3>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="Ejemplo: hazlo más elegante, usa las mismas fotos, mejora la legibilidad y mantenlo listo para Instagram Story."
          className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-cyan-400/60"
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
        {mode === "segment" ? "Crear historias" : "Crear menú mejorado"}
      </Btn>
    </>
  );
}

function ModeOption({ active, onClick, icon, title, desc, cost }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
        active
          ? "border-cyan-300/50 bg-cyan-300/10"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-black leading-tight">{title}</span>
      <span className="text-[11px] text-white/55">{desc}</span>
      <span className={`mt-auto rounded-full px-2 py-0.5 text-[10px] font-black ${active ? "bg-cyan-300/20 text-cyan-100" : "bg-white/[0.06] text-white/50"}`}>
        {cost}
      </span>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// RESULTS STEP
// ──────────────────────────────────────────────────────────────────────────────
function ResultsStep({
  mode, originalDataUrl, improvedImage, stories, summary, savedId,
  onCreateAnother, onEditInstructions, onGenerateMoreStories, onNewMenu,
}) {
  const showImproved = !!improvedImage && (mode === "improve" || mode === "both");
  const showStories  = stories?.length > 0 && (mode === "segment" || mode === "both");

  return (
    <>
      <Card>
        <h2 className="text-xl font-black sm:text-2xl">
          {mode === "segment" ? "Tus historias de menú están listas." : "Tu menú mejorado está listo."}
        </h2>
        {savedId && (
          <p className="mt-1 text-[11px] text-emerald-300">✓ Guardado automáticamente en Resultados y Mis Análisis.</p>
        )}
        {summary?.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {summary.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                <span className="mt-0.5 text-cyan-300">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Before / After del menú completo */}
      {showImproved && (
        <Card>
          <h3 className="text-sm font-black uppercase tracking-wider text-white/80">Menú mejorado</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <BeforeAfterTile label="Original" image={originalDataUrl} />
            <BeforeAfterTile label="Mejorado" image={improvedImage} highlight />
          </div>
        </Card>
      )}

      {/* Galería de historias 9:16 */}
      {showStories && (
        <Card>
          <h3 className="text-sm font-black uppercase tracking-wider text-white/80">
            Historias 9:16 <span className="text-white/40">({stories.length})</span>
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stories.map((s, i) => (
              <figure key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                <div className="aspect-[9/16] bg-black">
                  <img src={s.image} alt={s.title} className="h-full w-full object-cover" />
                </div>
                <figcaption className="px-3 py-2 text-[11px] font-bold text-white/70">
                  {s.title}
                </figcaption>
              </figure>
            ))}
          </div>
        </Card>
      )}

      {/* Botones de acción */}
      <Card>
        <div className="grid gap-2 sm:grid-cols-2">
          <Btn variant="white" full onClick={onCreateAnother}>🔁 Crear otra versión</Btn>
          <Btn variant="ghost" full onClick={onEditInstructions}>✏️ Editar instrucciones</Btn>
          {showStories && (
            <Btn variant="ghost" full onClick={onGenerateMoreStories}>➕ Generar más historias</Btn>
          )}
          <Btn variant="ghost" full onClick={onNewMenu}>📥 Nuevo menú</Btn>
        </div>
      </Card>
    </>
  );
}

function BeforeAfterTile({ label, image, highlight }) {
  return (
    <figure className={`overflow-hidden rounded-2xl border bg-black/40 ${highlight ? "border-cyan-300/40" : "border-white/10"}`}>
      <div className="flex items-center justify-between px-3 py-2 text-[11px] font-black uppercase tracking-wider">
        <span className={highlight ? "text-cyan-200" : "text-white/55"}>{label}</span>
        {highlight && <span className="rounded-full bg-cyan-300/20 px-2 py-0.5 text-[9px] text-cyan-100">IA</span>}
      </div>
      <div className="flex min-h-48 items-center justify-center bg-black">
        {image
          ? <img src={image} alt={label} className="max-h-[480px] w-full object-contain" />
          : <span className="p-8 text-xs text-white/40">Sin imagen</span>
        }
      </div>
    </figure>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
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
