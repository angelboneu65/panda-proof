// ══════════════════════════════════════════════════════════════════════════════
// Panda AdLab — CONFIGURACIÓN CENTRAL DE CRÉDITOS
// ──────────────────────────────────────────────────────────────────────────────
// Único lugar para tocar precios, créditos mensuales y costo por acción.
// Cambiar acá impacta toda la app (frontend + backend lee la misma fuente).
//
// IMPORTANTE: El backend (server.js) tiene un duplicado en sync de estos
// valores en su sección CREDIT_COSTS. Si tocas acá, actualiza también allá
// (idéntica estructura) para mantener consistencia.
// ══════════════════════════════════════════════════════════════════════════════

// ── Costos por acción (en créditos) ──────────────────────────────────────────
export const CREDIT_COSTS = {
  adAnalysis:              5,   // Analizar un anuncio (Panda Score con Opus)
  optimizeDesign:          5,   // Generar arte optimizado desde el análisis
  createAnotherVersion:    5,   // Regenerar 1 anuncio dentro de Foto a Campaña
  photoCampaignAnalysis:   0,   // Detectar producto/nicho desde foto (gratis — onboarding)
  generateSinglePhotoAd:   5,   // Foto a Campaña — generar 1 arte
  generateFivePhotoAds:    20,  // Foto a Campaña — generar 5 artes (paquete con descuento vs 5×5=25)
  improveMenu:             50,  // Mejorar Menú — análisis Opus + generación gpt-image-2
  segmentMenuStories:      50,  // Mejorar Menú — segmentar en historias 9:16 (varias piezas)
  igThumbnails:            50,  // Thumbnails IG — set de portadas de Reels / posts desde screenshot
};

// ── Planes de suscripción ────────────────────────────────────────────────────
export const PLANS = [
  {
    slug:            "basic",
    name:            "Basic",
    price:           9.99,
    monthlyCredits:  150,
    tagline:         "Ideal para empezar",
    features: [
      "150 créditos al mes",
      "Análisis con Panda Score",
      "Foto a Campaña (1 o 5 artes)",
      "AdChat IA incluido",
    ],
  },
  {
    slug:            "pro",
    name:            "Pro",
    price:           29.99,
    monthlyCredits:  500,
    tagline:         "Para quienes anuncian en serio",
    highlighted:     true,
    features: [
      "500 créditos al mes",
      "Todo lo del plan Basic",
      "Acceso prioritario a nuevas funciones",
      "Soporte preferente",
    ],
  },
];

// ── Recargas de créditos (compras únicas, no renovables) ─────────────────────
export const CREDIT_PACKAGES = [
  { slug: "pack-100",   name: "Recarga 100 créditos",   credits: 100,  price:   9.99, perCredit: 0.0999 },
  { slug: "pack-250",   name: "Recarga 250 créditos",   credits: 250,  price:  19.99, perCredit: 0.0800, badge: "Popular" },
  { slug: "pack-600",   name: "Recarga 600 créditos",   credits: 600,  price:  39.99, perCredit: 0.0667 },
  { slug: "pack-1500",  name: "Recarga 1500 créditos",  credits: 1500, price:  89.99, perCredit: 0.0600, badge: "Mejor valor" },
];

// ── Helpers de UI ────────────────────────────────────────────────────────────
export function getCostFor(action) {
  return CREDIT_COSTS[action] ?? 0;
}

export function getPlanBySlug(slug) {
  return PLANS.find((p) => p.slug === slug) || null;
}

export function getPackageBySlug(slug) {
  return CREDIT_PACKAGES.find((p) => p.slug === slug) || null;
}

// AdChat IA es gratis para cualquier usuario con plan activo (basic/pro/admin)
// o con créditos > 0. No consume créditos en ningún caso, sólo se valida que
// haya sesión iniciada. Esto se controla del lado del backend.
export const ADCHAT_FREE = true;
