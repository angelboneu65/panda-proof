// ══════════════════════════════════════════════════════════════════════════════
// DesignEditor — Editor visual por capas con IA (Polotno SDK)
// ──────────────────────────────────────────────────────────────────────────────
// Al abrir, automáticamente usa GPT-4o para separar la imagen en capas
// editables: fondo + cada texto detectado como capa independiente.
// ══════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createStore } from "polotno/model/store";
import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from "polotno";
import { Workspace }   from "polotno/canvas/workspace";
import { SidePanel, DEFAULT_SECTIONS } from "polotno/side-panel";
import { Toolbar }     from "polotno/toolbar/toolbar";
import { ZoomButtons } from "polotno/toolbar/zoom-buttons";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const SECTIONS = DEFAULT_SECTIONS.filter((s) =>
  ["text", "upload", "layers", "size", "elements"].includes(s.name)
);

export default function DesignEditor({
  open,
  onClose,
  baseImageUrl,
  resultId = null,
  initialPolotnoJson = null,
  onSaved,
}) {
  const store = useMemo(() => createStore({
    key: import.meta.env.VITE_POLOTNO_KEY || "nFA5H9elEytDyPyvKL7T",
    showCredit: false,
  }), []);

  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);
  // Estados del proceso de separación automática
  const [phase, setPhase] = useState("idle"); // idle | loading | done | error
  const [phaseMsg, setPhaseMsg]   = useState("");
  const [splitError, setSplitError] = useState(null);
  const initDoneRef = useRef(false);

  // ── Inicializa y auto-separa capas al abrir ─────────────────────────────────
  useEffect(() => {
    if (!open || initDoneRef.current || !store) return;
    initDoneRef.current = true;

    (async () => {
      try {
        // ── Caso 1: restaurar JSON guardado ─────────────────────────────────
        if (initialPolotnoJson && typeof initialPolotnoJson === "object") {
          setPhase("loading"); setPhaseMsg("Restaurando diseño guardado…");
          store.loadJSON(initialPolotnoJson);
          setPhase("done");
          return;
        }

        // ── Caso 2: separar capas con IA ────────────────────────────────────
        setPhase("loading"); setPhaseMsg("Cargando imagen…");

        const img = await loadImageDimensions(baseImageUrl);
        const W = img?.width  || 1024;
        const H = img?.height || 1024;

        store.setSize(W, H);
        if (!store.pages.length) store.addPage();
        const page = store.pages[0];
        store.selectPage(page.id);

        // Muestra la imagen base mientras procesa
        page.addElement({
          type: "image", src: baseImageUrl,
          x: 0, y: 0, width: W, height: H,
          name: "base-image", selectable: true, draggable: true,
        });

        setPhaseMsg("GPT-4o analizando el diseño…");

        // Llama al backend
        const resp = await fetch(`${API_BASE}/api/extract-layers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: baseImageUrl, canvasW: W, canvasH: H }),
        });

        if (!resp.ok) {
          const e = await resp.json().catch(() => ({}));
          throw new Error(e.error || `Error ${resp.status} del servidor`);
        }

        const data = await resp.json();

        setPhaseMsg("Construyendo capas editables…");

        // Limpia el canvas
        [...(page.children || [])].forEach((el) => {
          try { page.removeElement(el.id); } catch {}
        });

        // Capa 1 — fondo (imagen completa)
        page.addElement({
          type: "image", src: baseImageUrl,
          x: 0, y: 0, width: W, height: H,
          name: "🖼 Fondo", selectable: true, draggable: true,
        });

        // Capas 2+ — textos detectados
        const texts = data.texts || [];
        texts.forEach((t, i) => {
          const fontSize = clampFontSize(t.fontSize || 32, W);
          const x = Math.max(0, t.x_px ?? Math.round(W * 0.1));
          const y = Math.max(0, t.y_px ?? Math.round(H * (0.1 + i * 0.15)));
          const w = Math.min(W, t.width_px ?? Math.round(W * 0.8));

          const layerLabel = {
            headline:    "✏️ Titular",
            subheadline: "✏️ Subtítulo",
            body:        "✏️ Cuerpo",
            cta:         "✏️ CTA",
            label:       "✏️ Etiqueta",
          }[t.layer] || `✏️ Texto ${i + 1}`;

          page.addElement({
            type:       "text",
            text:       t.content || "",
            x, y,
            width:      w,
            height:     Math.round(fontSize * 1.3 * 3),
            fontSize,
            fontWeight: t.bold   ? "bold"   : "normal",
            fontStyle:  t.italic ? "italic" : "normal",
            fill:       sanitizeColor(t.color) || "#ffffff",
            align:      t.align || "center",
            name:       layerLabel,
            selectable: true,
            draggable:  true,
          });
        });

        setPhase("done");

      } catch (err) {
        console.error("[DesignEditor] init error:", err);
        setSplitError(err.message || "Error desconocido");
        setPhase("error");
        // Asegura que al menos hay una página con la imagen
        try {
          if (!store.pages.length) store.addPage();
        } catch {}
      }
    })();
  }, [open, store, baseImageUrl, initialPolotnoJson]);

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      initDoneRef.current = false;
      setPhase("idle");
      setSplitError(null);
      setSaveError(null);
    }
  }, [open]);

  // ── Reintentar separación ───────────────────────────────────────────────────
  const handleRetry = () => {
    initDoneRef.current = false;
    setPhase("idle");
    setSplitError(null);
    // Trigger useEffect de nuevo — forzamos con un pequeño state change
    // (se maneja porque initDoneRef volvió a false y open sigue true)
    // Llamamos directamente la lógica reiniciando
    initDoneRef.current = false;
    // El useEffect se dispara solo en el próximo tick
    setTimeout(() => {
      setPhase("idle"); // fuerza re-render y useEffect chequea initDoneRef
    }, 10);
  };

  // ── Guardar ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setSaveError(null);
    try {
      const polotnoJson     = store.toJSON();
      const exportedDataUrl = await store.toDataURL({ mimeType: "image/png", pixelRatio: 1 });
      if (onSaved) await onSaved({ exportedDataUrl, polotnoJson, resultId });
      if (onClose) onClose();
    } catch (err) {
      console.error("[DesignEditor] save error:", err);
      setSaveError(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex flex-col bg-[#070812]">

      {/* ── Overlay de carga (mientras IA separa capas) ──────────────────────── */}
      {phase === "loading" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#070812]/95 backdrop-blur-sm gap-5">
          <div className="relative flex items-center justify-center">
            <div className="h-20 w-20 animate-spin rounded-full border-4 border-purple-500/30 border-t-purple-400" />
            <span className="absolute text-3xl">🤖</span>
          </div>
          <div className="text-center">
            <p className="text-base font-black text-white">Separando capas con IA</p>
            <p className="mt-1 text-sm text-white/50">{phaseMsg}</p>
          </div>
          <div className="flex gap-2 text-[11px] text-white/30">
            {["Detectar texto","Posicionar capas","Preparar editor"].map((step, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" style={{ animationDelay: `${i * 0.3}s` }} />
                {step}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Overlay de error ─────────────────────────────────────────────────── */}
      {phase === "error" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#070812]/95 gap-4 p-8">
          <span className="text-5xl">⚠️</span>
          <p className="text-lg font-black text-white text-center">No se pudieron separar las capas</p>
          <p className="text-sm text-white/40 text-center max-w-sm">{splitError}</p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleRetry}
              className="rounded-xl bg-purple-500 px-5 py-2.5 text-sm font-black text-white hover:bg-purple-400"
            >
              🔄 Reintentar
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-black text-white/70 hover:bg-white/10"
            >
              Cerrar
            </button>
          </div>
          <p className="text-[11px] text-white/30 text-center max-w-xs">
            Si el error persiste, el servidor backend puede estar actualizándose. Espera 1-2 minutos y reintenta.
          </p>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#0d0f22] px-3 py-2 sm:px-5 sm:py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🎨</span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-white">Editor de capas</h2>
            {phase === "done" && (
              <p className="text-[10px] text-emerald-400">✓ Capas separadas — edita cada elemento</p>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button onClick={onClose} disabled={saving}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-white/70 hover:bg-white/10 disabled:opacity-50">
            Cerrar
          </button>
          <button onClick={handleSave} disabled={saving || phase === "loading"}
            className="rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 px-4 py-2 text-[11px] font-black text-white shadow-lg shadow-purple-500/20 hover:brightness-110 disabled:opacity-50">
            {saving ? "Guardando…" : "💾 Guardar"}
          </button>
        </div>
      </header>

      {saveError && (
        <div className="border-b border-red-400/30 bg-red-400/10 px-4 py-2 text-xs text-red-300">
          ⚠️ {saveError}
        </div>
      )}

      {/* ── Canvas Polotno ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 polotno-app">
        <PolotnoContainer style={{ width: "100%", height: "100%" }}>
          <SidePanelWrap>
            <SidePanel store={store} sections={SECTIONS} defaultSection="layers" />
          </SidePanelWrap>
          <WorkspaceWrap>
            <Toolbar store={store} downloadButtonEnabled={false} />
            <Workspace store={store} />
            <ZoomButtons store={store} />
          </WorkspaceWrap>
        </PolotnoContainer>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadImageDimensions(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function clampFontSize(size, canvasW) {
  return Math.min(Math.round(canvasW * 0.12), Math.max(12, Math.round(size)));
}

function sanitizeColor(color) {
  if (!color || typeof color !== "string") return null;
  const hex = color.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : null;
}
