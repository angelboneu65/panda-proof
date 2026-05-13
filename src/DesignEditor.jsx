// ══════════════════════════════════════════════════════════════════════════════
// DesignEditor — Editor visual por capas con Polotno SDK
// ──────────────────────────────────────────────────────────────────────────────
// Carga una imagen base (la generada por la IA) en un canvas editable y permite
// al usuario añadir texto, imágenes, mover elementos, etc.
//
// Se monta como pantalla completa (overlay z-[400]) sobre la app. No usa router;
// el padre controla la visibilidad con un state (open / setOpen).
//
// Props:
//   open           — boolean, controla si está visible
//   onClose        — function() llamado cuando el usuario cierra
//   baseImageUrl   — string, URL o data: URL de la imagen base a editar
//   resultId       — string opcional, id del saved_result que se está editando
//   onSaved        — function({ exportedDataUrl, polotnoJson }) tras Guardar
// ══════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createStore } from "polotno/model/store";
import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from "polotno";
import { Workspace }   from "polotno/canvas/workspace";
import { SidePanel, DEFAULT_SECTIONS } from "polotno/side-panel";
import { Toolbar }     from "polotno/toolbar/toolbar";
import { ZoomButtons } from "polotno/toolbar/zoom-buttons";

// Cargamos sólo las secciones más útiles: texto, capas, tamaño/posición,
// imágenes (subir propias) y eliminar. Evita saturar la UI mobile.
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
  // store de polotno — único por montaje del editor
  const store = useMemo(() => {
    return createStore({
      // En tier free Polotno funciona localmente. Si más adelante se compra
      // una key se inyecta acá via env: import.meta.env.VITE_POLOTNO_KEY
      key: import.meta.env.VITE_POLOTNO_KEY || "nFA5H9elEytDyPyvKL7T",
      showCredit: false,
    });
  }, []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const initializedRef = useRef(false);

  // Inicializa el lienzo con la imagen base (o restaura un JSON existente)
  useEffect(() => {
    if (!open || initializedRef.current || !store) return;
    (async () => {
      try {
        // Caso 1: hay JSON guardado previamente — restauralo
        if (initialPolotnoJson && typeof initialPolotnoJson === "object") {
          store.loadJSON(initialPolotnoJson);
          initializedRef.current = true;
          return;
        }
        // Caso 2: arranca con la imagen base como fondo
        const img = await loadImageDimensions(baseImageUrl);
        const W = img?.width  || 1024;
        const H = img?.height || 1024;
        store.setSize(W, H);
        // Asegura que haya exactamente una página limpia
        if (!store.pages.length) store.addPage();
        const page = store.pages[0];
        store.selectPage(page.id);
        page.addElement({
          type:   "image",
          src:    baseImageUrl,
          x:      0,
          y:      0,
          width:  W,
          height: H,
          name:   "base-image",
          selectable: true,
          draggable:  true,
        });
        initializedRef.current = true;
      } catch (err) {
        console.warn("[DesignEditor] init error:", err);
        // Igualmente abre un canvas vacío para que el editor no quede roto
        if (!store.pages.length) store.addPage();
        initializedRef.current = true;
      }
    })();
  }, [open, store, baseImageUrl, initialPolotnoJson]);

  // Reset cuando el editor se cierra para que el próximo abrir empiece limpio
  useEffect(() => {
    if (!open) initializedRef.current = false;
  }, [open]);

  const handleSave = async () => {
    setSaving(true); setSaveError(null);
    try {
      const polotnoJson = store.toJSON();
      // Exporta como PNG dataURL para que el padre lo guarde donde corresponda
      const exportedDataUrl = await store.toDataURL({ mimeType: "image/png", pixelRatio: 1 });
      if (onSaved) {
        await onSaved({ exportedDataUrl, polotnoJson, resultId });
      }
      // El padre cierra el editor tras guardar (o lo hacemos nosotros como fallback)
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
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0d0f22] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🎨</span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-white sm:text-base">Editor de diseño</h2>
            <p className="text-[10px] text-white/40">Mueve, añade texto e imágenes, exporta.</p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-black text-white/70 hover:bg-white/10 disabled:opacity-50"
          >Cerrar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 px-4 py-2 text-[12px] font-black text-white shadow-lg shadow-purple-500/20 hover:brightness-110 disabled:opacity-50"
          >{saving ? "Guardando…" : "💾 Guardar diseño"}</button>
        </div>
      </header>

      {saveError && (
        <div className="border-b border-red-400/30 bg-red-400/10 px-4 py-2 text-xs text-red-300">
          ⚠️ {saveError}
        </div>
      )}

      {/* Cuerpo del editor — Polotno */}
      <div className="flex-1 min-h-0 polotno-app">
        <PolotnoContainer style={{ width: "100%", height: "100%" }}>
          <SidePanelWrap>
            <SidePanel store={store} sections={SECTIONS} defaultSection="text" />
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

// ── Helpers ──────────────────────────────────────────────────────────────────
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
