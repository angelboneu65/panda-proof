// ══════════════════════════════════════════════════════════════════════════════
// DesignEditor — Editor visual por capas con IA (Polotno SDK)
// ──────────────────────────────────────────────────────────────────────────────
// Carga la imagen base y usa GPT-4o para separar capas editables:
//   • Fondo (imagen completa bloqueada)
//   • Textos (headline, subtítulo, CTA, etc.) como capas de texto independientes
//   • Producto/sujeto marcado como capa de imagen (cuando aplica)
//
// Props:
//   open           — boolean
//   onClose        — function()
//   baseImageUrl   — string, URL de la imagen a editar
//   resultId       — string opcional
//   initialPolotnoJson — object opcional, restaura un diseño guardado
//   onSaved        — function({ exportedDataUrl, polotnoJson, resultId })
// ══════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createStore } from "polotno/model/store";
import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from "polotno";
import { Workspace }   from "polotno/canvas/workspace";
import { SidePanel, DEFAULT_SECTIONS } from "polotno/side-panel";
import { Toolbar }     from "polotno/toolbar/toolbar";
import { ZoomButtons } from "polotno/toolbar/zoom-buttons";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// Secciones útiles del panel lateral
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

  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState(null);
  const [splitting,  setSplitting]  = useState(false);
  const [splitError, setSplitError] = useState(null);
  const [layersDone, setLayersDone] = useState(false);
  const initializedRef = useRef(false);

  // ── Inicializa el canvas ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || initializedRef.current || !store) return;
    (async () => {
      try {
        if (initialPolotnoJson && typeof initialPolotnoJson === "object") {
          store.loadJSON(initialPolotnoJson);
          initializedRef.current = true;
          setLayersDone(true);
          return;
        }
        // Canvas vacío con la imagen base como fondo plano
        const img = await loadImageDimensions(baseImageUrl);
        const W = img?.width  || 1024;
        const H = img?.height || 1024;
        store.setSize(W, H);
        if (!store.pages.length) store.addPage();
        const page = store.pages[0];
        store.selectPage(page.id);
        page.addElement({
          type: "image",
          src:  baseImageUrl,
          x: 0, y: 0, width: W, height: H,
          name: "base-image",
          selectable: true,
          draggable:  true,
        });
        initializedRef.current = true;
      } catch (err) {
        console.warn("[DesignEditor] init error:", err);
        if (!store.pages.length) store.addPage();
        initializedRef.current = true;
      }
    })();
  }, [open, store, baseImageUrl, initialPolotnoJson]);

  // Reset cuando se cierra
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      setLayersDone(false);
      setSplitError(null);
    }
  }, [open]);

  // ── Separación de capas con IA ──────────────────────────────────────────────
  const handleSplitLayers = useCallback(async () => {
    if (splitting || !store) return;
    setSplitting(true);
    setSplitError(null);
    try {
      const W = store.width  || 1024;
      const H = store.height || 1024;

      const resp = await fetch(`${API_BASE}/api/extract-layers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: baseImageUrl, canvasW: W, canvasH: H }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `Error ${resp.status}`);
      }
      const data = await resp.json();

      // Limpia el canvas y reconstruye con capas
      const page = store.pages[0];
      // Elimina todos los elementos actuales
      [...page.children].forEach((el) => el.remove?.() ?? page.removeElement?.(el.id));

      // ── Capa 1: fondo (imagen completa, detrás de todo) ──────────────────
      page.addElement({
        type: "image",
        src:  baseImageUrl,
        x: 0, y: 0, width: W, height: H,
        name: "fondo",
        selectable: true,
        draggable:  true,
        locked: false,
      });

      // ── Capa 2: textos editables ──────────────────────────────────────────
      const texts = data.texts || [];
      texts.forEach((t, i) => {
        const fontSize = clampFontSize(t.fontSize || 32, W);
        const lineH    = fontSize * 1.3;
        const x = Math.max(0, t.x_px ?? Math.round(W * 0.1));
        const y = Math.max(0, t.y_px ?? Math.round(H * (0.1 + i * 0.12)));
        const w = Math.min(W, t.width_px ?? Math.round(W * 0.8));

        page.addElement({
          type:       "text",
          text:       t.content || "",
          x, y,
          width:      w,
          height:     Math.round(lineH * 3),
          fontSize,
          fontWeight: t.bold ? "bold" : "normal",
          fontStyle:  t.italic ? "italic" : "normal",
          fill:       sanitizeColor(t.color) || "#ffffff",
          align:      t.align || "center",
          name:       `texto-${t.layer || i}`,
          selectable: true,
          draggable:  true,
        });
      });

      setLayersDone(true);
    } catch (err) {
      console.error("[split-layers]", err);
      setSplitError(err.message || "No se pudieron separar las capas");
    } finally {
      setSplitting(false);
    }
  }, [splitting, store, baseImageUrl]);

  // ── Guardar ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setSaveError(null);
    try {
      const polotnoJson    = store.toJSON();
      const exportedDataUrl = await store.toDataURL({ mimeType: "image/png", pixelRatio: 1 });
      if (onSaved) await onSaved({ exportedDataUrl, polotnoJson, resultId });
      if (onClose) onClose();
    } catch (err) {
      console.error("[DesignEditor] save error:", err);
      setSaveError(err.message || "No se pudo guardar el diseño");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex flex-col bg-[#070812]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#0d0f22] px-3 py-2 sm:px-5 sm:py-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🎨</span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-white">Editor de capas</h2>
            <p className="text-[10px] text-white/40 hidden sm:block">Separa capas con IA y edita cada elemento</p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 flex-wrap justify-end">
          {/* Botón separar capas */}
          <button
            onClick={handleSplitLayers}
            disabled={splitting || saving}
            title="Usa GPT-4o para detectar texto, fondo y elementos y los convierte en capas editables"
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black transition
              ${layersDone
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                : "border-cyan-400/30 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white hover:brightness-110"
              } disabled:opacity-50`}
          >
            {splitting
              ? <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" /> Analizando…</>
              : layersDone
                ? "✅ Capas separadas"
                : "🤖 Separar capas con IA"
            }
          </button>

          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-white/70 hover:bg-white/10 disabled:opacity-50"
          >Cerrar</button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 px-4 py-2 text-[11px] font-black text-white shadow-lg shadow-purple-500/20 hover:brightness-110 disabled:opacity-50"
          >{saving ? "Guardando…" : "💾 Guardar"}</button>
        </div>
      </header>

      {/* Banners de estado */}
      {saveError && (
        <div className="border-b border-red-400/30 bg-red-400/10 px-4 py-2 text-xs text-red-300">
          ⚠️ {saveError}
        </div>
      )}
      {splitError && (
        <div className="flex items-center justify-between border-b border-orange-400/30 bg-orange-400/10 px-4 py-2 text-xs text-orange-300">
          <span>⚠️ {splitError}</span>
          <button onClick={() => setSplitError(null)} className="ml-3 text-orange-400 hover:text-orange-200">✕</button>
        </div>
      )}
      {splitting && (
        <div className="border-b border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs text-cyan-300 text-center">
          🤖 GPT-4o analizando la imagen para detectar todas las capas… esto toma unos segundos
        </div>
      )}
      {!layersDone && !splitting && !splitError && (
        <div className="border-b border-purple-400/20 bg-purple-400/5 px-4 py-2 text-xs text-purple-300 text-center">
          💡 Presiona <strong>"🤖 Separar capas con IA"</strong> para que GPT-4o detecte y separe el texto y los elementos del diseño
        </div>
      )}

      {/* ── Canvas Polotno ─────────────────────────────────────────────────── */}
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

/** Clamp fontSize para que sea proporcional al canvas y legible */
function clampFontSize(size, canvasW) {
  const max = Math.round(canvasW * 0.12); // máx 12% del ancho
  const min = 12;
  return Math.min(max, Math.max(min, Math.round(size)));
}

/** Valida y devuelve un hex color o null */
function sanitizeColor(color) {
  if (!color || typeof color !== "string") return null;
  const hex = color.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : null;
}
