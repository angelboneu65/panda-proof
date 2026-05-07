// ── Panda Score — Categories ──────────────────────────────────────────────────
export const PANDA_SCORE_CATEGORIES = {
  messageClarity: {
    label: "Claridad del mensaje",
    question: "¿Se entiende qué se está vendiendo en 1–2 segundos?",
    evaluates: [
      "producto o servicio claro",
      "titular directo",
      "mensaje principal fácil de entender",
      "ausencia de ambigüedad",
    ],
  },
  offerStrength: {
    label: "Fuerza de la oferta",
    question: "¿La oferta se percibe atractiva y concreta?",
    evaluates: [
      "precio visible",
      "beneficio claro",
      "promoción entendible",
      "urgencia o razón para actuar",
      "valor percibido",
    ],
  },
  visualHierarchy: {
    label: "Jerarquía visual",
    question: "¿La mirada sabe qué leer primero, segundo y tercero?",
    evaluates: [
      "titular principal",
      "oferta o beneficio",
      "CTA",
      "balance entre imagen y texto",
      "ausencia de elementos compitiendo",
    ],
  },
  ctaStrength: {
    label: "Fuerza del CTA",
    question: "¿La persona sabe exactamente qué hacer después de ver el anuncio?",
    evaluates: [
      "CTA visible",
      "verbo de acción",
      "contraste suficiente",
      "alineación con el objetivo",
      "ubicación clara",
    ],
  },
  mobileReadability: {
    label: "Legibilidad móvil",
    question: "¿El arte se puede leer fácilmente en iPhone o pantalla pequeña?",
    evaluates: [
      "tamaño de texto",
      "contraste",
      "cantidad de texto",
      "márgenes seguros",
      "separación visual",
      "lectura rápida",
    ],
  },
  nicheRelevance: {
    label: "Relevancia con el nicho",
    question: "¿El arte se siente correcto para este tipo de negocio?",
    evaluates: [
      "estética adecuada",
      "tono visual correcto",
      "colores coherentes",
      "expectativas del mercado",
      "percepción profesional",
    ],
  },
  audienceRelevance: {
    label: "Conexión con el público",
    question: "¿El mensaje conecta con la persona correcta?",
    evaluates: [
      "lenguaje adecuado",
      "beneficio relevante",
      "emoción correcta",
      "deseo o problema del público",
      "estilo visual alineado",
    ],
  },
  trustCredibility: {
    label: "Confianza y credibilidad",
    question: "¿El anuncio transmite seguridad y legitimidad?",
    evaluates: [
      "logo visible",
      "marca clara",
      "información confiable",
      "realismo visual",
      "señales de profesionalismo",
    ],
  },
  premiumVisualQuality: {
    label: "Calidad visual premium",
    question: "¿El arte se ve profesional y bien dirigido?",
    evaluates: [
      "composición",
      "tipografía",
      "colores",
      "calidad de imagen",
      "espaciado",
      "coherencia visual",
      "sensación premium",
    ],
  },
  conversionFriction: {
    label: "Fricción de conversión",
    question: "¿Hay algo que dificulta que la persona actúe?",
    evaluates: [
      "exceso de texto",
      "CTA escondido",
      "promoción confusa",
      "falta de método de contacto",
      "condiciones excesivas",
      "siguiente paso poco claro",
    ],
  },
};

// ── Weight profiles per objective ─────────────────────────────────────────────
export const SCORE_WEIGHTS = {
  whatsapp_messages: {
    messageClarity: 15, offerStrength: 15, visualHierarchy: 10, ctaStrength: 20,
    mobileReadability: 15, nicheRelevance: 5, audienceRelevance: 10,
    trustCredibility: 10, premiumVisualQuality: 5, conversionFriction: 10,
  },
  online_sales: {
    messageClarity: 20, offerStrength: 20, visualHierarchy: 10, ctaStrength: 15,
    mobileReadability: 10, nicheRelevance: 5, audienceRelevance: 5,
    trustCredibility: 15, premiumVisualQuality: 10, conversionFriction: 10,
  },
  bookings: {
    messageClarity: 15, offerStrength: 15, visualHierarchy: 10, ctaStrength: 20,
    mobileReadability: 15, nicheRelevance: 5, audienceRelevance: 10,
    trustCredibility: 10, premiumVisualQuality: 5, conversionFriction: 10,
  },
  lead_generation: {
    messageClarity: 15, offerStrength: 10, visualHierarchy: 10, ctaStrength: 20,
    mobileReadability: 15, nicheRelevance: 5, audienceRelevance: 10,
    trustCredibility: 15, premiumVisualQuality: 5, conversionFriction: 10,
  },
  branding: {
    messageClarity: 10, offerStrength: 5, visualHierarchy: 10, ctaStrength: 5,
    mobileReadability: 10, nicheRelevance: 15, audienceRelevance: 15,
    trustCredibility: 10, premiumVisualQuality: 20, conversionFriction: 5,
  },
  event_promotion: {
    messageClarity: 15, offerStrength: 15, visualHierarchy: 10, ctaStrength: 15,
    mobileReadability: 15, nicheRelevance: 5, audienceRelevance: 10,
    trustCredibility: 5, premiumVisualQuality: 5, conversionFriction: 10,
  },
  default: {
    messageClarity: 15, offerStrength: 15, visualHierarchy: 10, ctaStrength: 15,
    mobileReadability: 15, nicheRelevance: 10, audienceRelevance: 10,
    trustCredibility: 10, premiumVisualQuality: 10, conversionFriction: 10,
  },
};

// ── Profile display names ─────────────────────────────────────────────────────
export const PROFILE_NAMES = {
  whatsapp_messages: "Conversión directa — Mensajes",
  online_sales:      "Venta online / E-commerce",
  bookings:          "Captación de reservas / Citas",
  lead_generation:   "Lead generation",
  branding:          "Branding y awareness",
  event_promotion:   "Promoción de evento",
  default:           "Performance balanceado",
};

// ── Objective → key mapping ───────────────────────────────────────────────────
export function getObjectiveKey(objective) {
  const map = {
    "Mensajes / WhatsApp":    "whatsapp_messages",
    "Ventas directas":        "online_sales",
    "Reservas":               "bookings",
    "Llamadas":               "bookings",
    "Tráfico web":            "lead_generation",
    "Reconocimiento de marca":"branding",
    "Captación de leads":     "lead_generation",
  };
  return map[objective] || "default";
}

// ── Platform modifiers ────────────────────────────────────────────────────────
export function getPlatformModifiers(platform) {
  const p = (platform || "").toLowerCase();
  if (p.includes("story") || p.includes("stories")) {
    return {
      note: "Es Story/formato vertical. Aumenta importancia de legibilidad móvil y CTA. Penaliza exceso de texto. Prioriza lectura en 1 segundo.",
    };
  }
  if (p.includes("whatsapp")) {
    return {
      note: "Es para WhatsApp. Prioriza claridad inmediata, CTA conversacional (ej. 'Escríbenos'). Evita diseño muy cargado.",
    };
  }
  if (p.includes("flyer") || p.includes("impreso")) {
    return {
      note: "Es impreso/flyer. Puedes tolerar más información. Evalúa datos de contacto claros y jerarquía de lectura impresa.",
    };
  }
  if (p.includes("meta") || p.includes("google ads")) {
    return {
      note: "Es Meta/Google Ads. Prioriza claridad, CTA y propuesta de valor. Penaliza claims confusos o texto excesivo.",
    };
  }
  if (p.includes("feed")) {
    return {
      note: "Es Feed. Balancea imagen, titular y CTA. Prioriza claridad y jerarquía. Tolera un poco más de información que en Story.",
    };
  }
  return { note: "" };
}

// ── Utility functions ─────────────────────────────────────────────────────────
export function normalizeWeights(weights) {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (total === 100) return weights;
  const normalized = {};
  for (const key in weights) {
    normalized[key] = Number(((weights[key] / total) * 100).toFixed(2));
  }
  return normalized;
}

export function calculatePandaScore(categoryScores, rawWeights) {
  const weights = normalizeWeights(rawWeights);
  let total = 0;
  for (const key in weights) {
    const score  = categoryScores[key] ?? 0;
    const weight = weights[key] ?? 0;
    total += score * (weight / 100);
  }
  return Math.round(total);
}

export function getScoreStatus(score) {
  if (score >= 85) return { status: "excellent",   statusLabel: "Excelente" };
  if (score >= 70) return { status: "good",         statusLabel: "Bueno" };
  if (score >= 50) return { status: "needs_work",   statusLabel: "Necesita mejora" };
  return              { status: "weak",          statusLabel: "Débil" };
}

export function getPandaScoreInterpretation(score) {
  if (score >= 95) return {
    shortLabel: "Excelente",
    scoreLabel: "Altamente optimizado",
    scoreInterpretation: "El arte está muy bien alineado con su objetivo, plataforma y público. Está listo para usarse o probarse en campaña.",
  };
  if (score >= 85) return {
    shortLabel: "Muy bueno",
    scoreLabel: "Listo para prueba",
    scoreInterpretation: "El arte está sólido y puede funcionar bien, aunque todavía tiene oportunidades puntuales de mejora.",
  };
  if (score >= 70) return {
    shortLabel: "Bueno",
    scoreLabel: "Bueno, pero puede convertir mejor",
    scoreInterpretation: "El arte tiene potencial, pero necesita mejorar claridad, CTA, jerarquía o legibilidad para aumentar su probabilidad de conversión.",
  };
  if (score >= 50) return {
    shortLabel: "En desarrollo",
    scoreLabel: "Necesita optimización",
    scoreInterpretation: "El arte tiene intención, pero presenta barreras claras que pueden afectar su rendimiento comercial.",
  };
  return {
    shortLabel: "Punto de partida",
    scoreLabel: "Requiere reconstrucción",
    scoreInterpretation: "El arte necesita cambios fuertes antes de publicarse, ya que no comunica con suficiente claridad ni guía bien la acción.",
  };
}

export function getRecommendedAction(pandaScore) {
  if (pandaScore >= 85) return "Publicarlo como está";
  if (pandaScore >= 70) return "Hacer ajustes menores";
  if (pandaScore >= 50) return "Rediseñarlo parcialmente";
  return "Rediseñarlo completo";
}
