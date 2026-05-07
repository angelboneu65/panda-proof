import express from "express";
import multer  from "multer";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI, { toFile } from "openai";
import cors  from "cors";
import sharp from "sharp";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env ─────────────────────────────────────────────────────────────────
const __dir  = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
}

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY no configurada en .env");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true }));
app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, key: !!process.env.ANTHROPIC_API_KEY })
);

// ═════════════════════════════════════════════════════════════════════════════
// PANDA SCORE CONFIG (inlined so server is self-contained)
// ═════════════════════════════════════════════════════════════════════════════

const PANDA_SCORE_CATEGORIES = {
  messageClarity:      { label: "Claridad del mensaje",       question: "¿Se entiende qué se está vendiendo en 1–2 segundos?" },
  offerStrength:       { label: "Fuerza de la oferta",        question: "¿La oferta se percibe atractiva y concreta para el público objetivo?" },
  visualHierarchy:     { label: "Jerarquía visual",           question: "¿La mirada sabe qué leer primero, segundo y tercero?" },
  ctaStrength:         { label: "Fuerza del CTA",             question: "¿La persona sabe exactamente qué hacer después de ver el anuncio?" },
  mobileReadability:   { label: "Legibilidad móvil",          question: "¿El arte se puede leer fácilmente en iPhone o pantalla pequeña?" },
  nicheRelevance:      { label: "Relevancia con el nicho",    question: "¿El arte se siente correcto para este tipo de negocio?" },
  audienceRelevance:   { label: "Conexión con el público",    question: "¿El mensaje conecta con la persona correcta?" },
  trustCredibility:    { label: "Confianza y credibilidad",   question: "¿El anuncio transmite seguridad, legitimidad y profesionalismo?" },
  premiumVisualQuality:{ label: "Calidad visual premium",     question: "¿El arte se ve profesional, limpio y bien dirigido?" },
  conversionFriction:  { label: "Fricción de conversión",     question: "¿Hay algo que dificulta que la persona actúe? (100 = sin fricción alguna)" },
};

const SCORE_WEIGHTS = {
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

const PROFILE_NAMES = {
  whatsapp_messages: "Conversión directa — Mensajes",
  online_sales:      "Venta online / E-commerce",
  bookings:          "Captación de reservas / Citas",
  lead_generation:   "Lead generation",
  branding:          "Branding y awareness",
  event_promotion:   "Promoción de evento",
  default:           "Performance balanceado",
};

function getObjectiveKey(objective) {
  const map = {
    "Mensajes / WhatsApp":     "whatsapp_messages",
    "Ventas directas":         "online_sales",
    "Reservas":                "bookings",
    "Llamadas":                "bookings",
    "Tráfico web":             "lead_generation",
    "Reconocimiento de marca": "branding",
    "Captación de leads":      "lead_generation",
  };
  return map[objective] || "default";
}

function getPlatformNote(platform) {
  const p = (platform || "").toLowerCase();
  if (p.includes("story") || p.includes("stories"))
    return "NOTA PLATAFORMA: Es Story/formato vertical móvil. Prioriza legibilidad móvil y CTA. Penaliza exceso de texto. El usuario debe entenderlo en 1 segundo.";
  if (p.includes("whatsapp"))
    return "NOTA PLATAFORMA: Es para WhatsApp. Prioriza claridad inmediata y CTA conversacional. Evita diseño muy cargado.";
  if (p.includes("flyer") || p.includes("impreso"))
    return "NOTA PLATAFORMA: Es impreso/flyer. Puedes tolerar más información. Evalúa datos de contacto claros.";
  if (p.includes("meta") || p.includes("google"))
    return "NOTA PLATAFORMA: Es Meta/Google Ads. Prioriza claridad, CTA y propuesta de valor. Penaliza texto excesivo.";
  return "";
}

function normalizeWeights(weights) {
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  if (total === 100) return weights;
  const out = {};
  for (const k in weights) out[k] = Number(((weights[k] / total) * 100).toFixed(2));
  return out;
}

function calculatePandaScore(categoryScores, rawWeights) {
  const weights = normalizeWeights(rawWeights);
  let total = 0;
  for (const key in weights) {
    total += (categoryScores[key] ?? 0) * (weights[key] / 100);
  }
  return Math.round(total);
}

function getScoreStatus(score) {
  if (score >= 85) return { status: "excellent",  statusLabel: "Excelente" };
  if (score >= 70) return { status: "good",        statusLabel: "Bueno" };
  if (score >= 50) return { status: "needs_work",  statusLabel: "Necesita mejora" };
  return              { status: "weak",         statusLabel: "Débil" };
}

function getPandaScoreInterpretation(score) {
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

function getRecommendedAction(pandaScore) {
  if (pandaScore >= 85) return "Publicarlo como está";
  if (pandaScore >= 70) return "Hacer ajustes menores";
  if (pandaScore >= 50) return "Rediseñarlo parcialmente";
  return "Rediseñarlo completo";
}

// ── Extract business data from image ─────────────────────────────────────────
app.post("/api/extract", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)                      return res.status(400).json({ error: "No se recibió imagen." });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada." });

    const imageBase64 = req.file.buffer.toString("base64");
    const mediaType   = req.file.mimetype;

    const message = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          {
            type: "text",
            text: `Eres un experto en marketing digital. Analiza esta imagen publicitaria e infiere los datos del negocio.

Devuelve ÚNICAMENTE este JSON válido, sin texto adicional ni markdown:

{
  "nicho": "<tipo de negocio detectado, ej: Spa y Centro de Bienestar, Restaurante, Clínica Dental>",
  "producto": "<producto o servicio principal que se anuncia, específico>",
  "publico": "<público objetivo probable basado en la imagen, ej: Mujeres 25-45 años>",
  "plataforma": "<una de estas opciones exactas: Instagram Stories|Instagram Feed|Facebook|TikTok|WhatsApp Status|Google Ads|Web / Landing page|Impreso / Flyer>",
  "objetivo": "<una de estas opciones exactas: Mensajes / WhatsApp|Ventas directas|Reservas|Llamadas|Tráfico web|Reconocimiento de marca|Captación de leads>",
  "oferta": "<precio u oferta visible en la imagen, o cadena vacía si no hay>"
}

Basa tus inferencias en los elementos visuales, texto, colores y estilo. Responde en español.`,
          },
        ],
      }],
    });

    const raw   = message.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "No se pudo extraer la información." });

    res.json({ success: true, data: JSON.parse(match[0]) });
  } catch (err) {
    console.error("❌ Extract:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Analyze prompt builder ────────────────────────────────────────────────────
function buildAnalyzePrompt({ nicho, producto, publico, plataforma, objetivo, oferta }) {
  const objectiveKey   = getObjectiveKey(objetivo);
  const rawWeights     = SCORE_WEIGHTS[objectiveKey] || SCORE_WEIGHTS.default;
  const weights        = normalizeWeights(rawWeights);
  const profileName    = PROFILE_NAMES[objectiveKey] || "Performance balanceado";
  const platformNote   = getPlatformNote(plataforma);

  const categoriesBlock = Object.entries(PANDA_SCORE_CATEGORIES)
    .map(([key, { label, question }]) => {
      const w = weights[key] ?? 0;
      return `• [${key}] ${label} — peso: ${w}%\n  ${question}`;
    })
    .join("\n\n");

  return `Eres Panda Proof, un director creativo senior con 20 años de experiencia en campañas de performance para marcas en Latinoamérica y Puerto Rico. Tu evaluación es honesta, empática y orientada a resultados comerciales reales.

CONTEXTO DEL ARTE A EVALUAR:
- Tipo de negocio: ${nicho}
- Producto / Servicio: ${producto}
- Público objetivo: ${publico}
- Plataforma destino: ${plataforma}
- Objetivo de conversión: ${objetivo}
- Perfil de evaluación activo: ${profileName}
${oferta ? `- Oferta o precio: ${oferta}` : "- Sin oferta de precio explícita"}
${platformNote ? `\n${platformNote}` : ""}

═══════════════════════════════════════════════════════════════════
INSTRUCCIÓN: Analiza este arte publicitario. NO evalúes si es bonito genéricamente.
Evalúa si puede convertir según su contexto específico.
═══════════════════════════════════════════════════════════════════

CRITERIOS A EVALUAR (califica cada uno de 0 a 100):
${categoriesBlock}

REGLA IMPORTANTE para conversionFriction:
- 100 = no hay fricción, el siguiente paso es perfectamente obvio
- 0   = máxima fricción, la persona no sabe qué hacer ni cómo actuar

Para CADA criterio devuelve:
- score: número de 0 a 100 (sé honesto y preciso)
- explanation: 1-2 oraciones describiendo qué observas específicamente en el arte
- recommendation: acción concreta y específica para mejorar ese criterio

Luego devuelve:
- mainProblemsDetected: array de 3-5 problemas principales que afectan la conversión (frases cortas y directas)
- topRecommendations: array de 3-5 recomendaciones prioritarias y concretas (frases de acción)
- regenerationPriorities: array de 3-5 elementos a mejorar en el arte optimizado, en orden de impacto
- regenerationPrompt: briefing detallado (mínimo 200 palabras) para regenerar el arte preservando concepto, logo, persona/modelo y marca — mejorar CTA, claridad, jerarquía, legibilidad móvil y percepción premium

Devuelve ÚNICAMENTE este JSON válido, sin texto adicional ni markdown:

{
  "categories": {
    "messageClarity":       { "score": <0-100>, "explanation": "...", "recommendation": "..." },
    "offerStrength":        { "score": <0-100>, "explanation": "...", "recommendation": "..." },
    "visualHierarchy":      { "score": <0-100>, "explanation": "...", "recommendation": "..." },
    "ctaStrength":          { "score": <0-100>, "explanation": "...", "recommendation": "..." },
    "mobileReadability":    { "score": <0-100>, "explanation": "...", "recommendation": "..." },
    "nicheRelevance":       { "score": <0-100>, "explanation": "...", "recommendation": "..." },
    "audienceRelevance":    { "score": <0-100>, "explanation": "...", "recommendation": "..." },
    "trustCredibility":     { "score": <0-100>, "explanation": "...", "recommendation": "..." },
    "premiumVisualQuality": { "score": <0-100>, "explanation": "...", "recommendation": "..." },
    "conversionFriction":   { "score": <0-100>, "explanation": "...", "recommendation": "..." }
  },
  "mainProblemsDetected": ["...", "...", "..."],
  "topRecommendations": ["...", "...", "..."],
  "regenerationPriorities": ["...", "...", "..."],
  "regenerationPrompt": "<briefing detallado mínimo 200 palabras>"
}`;
}

// ── Analyze endpoint ──────────────────────────────────────────────────────────
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)                      return res.status(400).json({ error: "No se recibió imagen." });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada." });

    const { nicho, producto, publico, plataforma, objetivo, oferta } = req.body;
    const imageBase64 = req.file.buffer.toString("base64");
    const mediaType   = req.file.mimetype;

    const message = await client.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text",  text: buildAnalyzePrompt({ nicho, producto, publico, plataforma, objetivo, oferta }) },
        ],
      }],
    });

    const raw   = message.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "No se pudo parsear la respuesta." });

    const claudeResult = JSON.parse(match[0]);

    // ── Post-process: calculate pandaScore server-side ────────────────────────
    const objectiveKey = getObjectiveKey(objetivo);
    const rawWeights   = SCORE_WEIGHTS[objectiveKey] || SCORE_WEIGHTS.default;
    const activeWeights = normalizeWeights(rawWeights);

    // Extract category scores for weighted calculation
    const categoryScores = {};
    for (const key in claudeResult.categories ?? {}) {
      categoryScores[key] = claudeResult.categories[key]?.score ?? 0;
    }

    const pandaScore          = calculatePandaScore(categoryScores, rawWeights);
    const interpretation      = getPandaScoreInterpretation(pandaScore);
    const accionRecomendada   = getRecommendedAction(pandaScore);
    const profileApplied      = PROFILE_NAMES[objectiveKey] || "Performance balanceado";

    // Add label + status to each category
    const categories = {};
    for (const [key, cat] of Object.entries(claudeResult.categories ?? {})) {
      const { status, statusLabel } = getScoreStatus(cat.score ?? 0);
      categories[key] = {
        label:          PANDA_SCORE_CATEGORIES[key]?.label ?? key,
        score:          cat.score         ?? 0,
        status,
        statusLabel,
        explanation:    cat.explanation    ?? "",
        recommendation: cat.recommendation ?? "",
        weight:         activeWeights[key] ?? 0,
      };
    }

    const analysis = {
      pandaScore,
      shortLabel:          interpretation.shortLabel,
      scoreLabel:          interpretation.scoreLabel,
      scoreInterpretation: interpretation.scoreInterpretation,
      objectiveDetected:   objectiveKey,
      platformDetected:    plataforma,
      profileApplied,
      accionRecomendada,
      activeWeights,
      contextUsed: {
        businessType:    nicho,
        whatIsBeingSold: producto,
        targetAudience:  publico,
        platform:        plataforma,
        objective:       objetivo,
        promotion:       oferta || null,
      },
      categories,
      mainProblemsDetected:  claudeResult.mainProblemsDetected  ?? [],
      topRecommendations:    claudeResult.topRecommendations    ?? [],
      regenerationPriorities:claudeResult.regenerationPriorities ?? [],
      regenerationPrompt:    claudeResult.regenerationPrompt    ?? "",
    };

    res.json({ success: true, analysis });
  } catch (err) {
    console.error("❌ Analyze:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Panda Proof preservation prompt ──────────────────────────────────────────
const PANDA_PROOF_BASE_PROMPT = `Rediseña y mejora este arte publicitario manteniendo intacta su esencia comercial y visual. Preserva el concepto original, la oferta, el producto o servicio anunciado, la identidad visual de la marca, el logo y la persona o modelo principal.

Tu objetivo es convertir el mismo arte en una versión más efectiva para conversión, especialmente en móvil. Mejora la claridad del mensaje, la jerarquía visual, la legibilidad, el balance de composición, el contraste, la fuerza del CTA y la percepción premium.

PRIORIDADES (en orden):
1. Preservar concepto, marca, logo y persona/modelo — NUNCA reemplazar
2. Simplificar jerarquía visual a 3 niveles: titular / oferta-beneficio / CTA
3. Reforzar el CTA — más visible, específico, orientado a acción
4. Optimizar legibilidad en móvil — texto legible sin zoom
5. Mejorar contraste y eliminar ruido visual

REGLAS ABSOLUTAS:
- NO reemplazar al sujeto principal por otro distinto
- NO alterar el logo ni la identidad de marca
- NO inventar precios o beneficios que no existen
- NO reinventar — OPTIMIZAR`;

// ── Dynamic generation prompt builder ─────────────────────────────────────────
function buildGenerationPrompt({ nicho, producto, publico, plataforma, objetivo, oferta, problemas, mejoras }) {
  const ofertaLine    = oferta    ? `La promoción u oferta principal es: ${oferta}.`    : "No se especificó oferta — no inventes precios.";
  const problemasLine = problemas ? `Problemas detectados por el análisis: ${problemas}.` : "Aplica mejoras generales de legibilidad, jerarquía y conversión.";
  const mejorasLine   = mejoras   ? `Prioridades de mejora: ${mejoras}.`               : "Prioriza: reforzar CTA, simplificar jerarquía, mejorar legibilidad móvil.";

  return `Rediseña y mejora este arte publicitario para un negocio de tipo ${nicho}, promoviendo ${producto}, dirigido a ${publico}, para publicarse en ${plataforma} con objetivo de ${objetivo}. ${ofertaLine}

PRESERVA INTACTO (reglas absolutas):
- La persona o modelo principal — NO la reemplaces
- El logo y la identidad visual de marca — NO lo alteres
- El concepto central del anuncio — NO cambies la idea
- La oferta y precios presentes — NO inventes datos

${problemasLine}
${mejorasLine}

MEJORAS ESPECÍFICAS:
- Jerarquía visual: 3 niveles claros → titular / oferta-beneficio / CTA
- CTA: más visible, específico y orientado a acción inmediata
- Legibilidad móvil: texto principal legible sin zoom en celular
- Contraste: suficiente entre texto y fondo
- Composición: elimina elementos que compiten innecesariamente
- Percepción premium: limpio, ordenado, profesional

El resultado debe ser una versión OPTIMIZADA del mismo arte — no una reinvención.`;
}

// ── Generate / Edit image (gpt-image-1) ──────────────────────────────────────
app.post("/api/generate", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió imagen." });

    const { nicho, producto, publico, plataforma, objetivo, oferta, problemas, mejoras, customInstructions } = req.body;

    const sourcePrompt = (nicho && producto)
      ? buildGenerationPrompt({ nicho, producto, publico, plataforma, objetivo, oferta, problemas, mejoras })
      : PANDA_PROOF_BASE_PROMPT;

    // Append user's custom instructions (highest priority)
    const finalPrompt = customInstructions
      ? `${sourcePrompt}\n\nINSTRUCCIONES ADICIONALES DEL USUARIO (PRIORIDAD MÁXIMA — aplica estas correcciones específicas):\n${customInstructions}`
      : sourcePrompt;

    // Paso 1: Sonnet condensa el prompt para gpt-image-1
    const reformatMsg = await client.messages.create({
      model:      "claude-sonnet-4-5",
      max_tokens: 700,
      messages: [{
        role: "user",
        content: `You are an image editing prompt engineer for gpt-image-1 (OpenAI).
Condense the following creative brief into a single, clear editing instruction under 1800 characters.

ABSOLUTE RULES — never break these:
- OUTPUT must be the EXACT same aspect ratio and orientation as the input image
- Do NOT add black bars, padding, or change canvas size in any way
- Preserve ALL brand elements: logo, color palette, font style, photography
- Do NOT replace the main person/model with a different person
- Do NOT alter or reinterpret the logo or brand identity
- Do NOT change the core concept of the ad
- Do NOT invent prices or benefits not present in the original
- If user added "INSTRUCCIONES ADICIONALES DEL USUARIO" they have HIGHEST priority — apply them precisely

Write in English only. Start with: "Optimize this advertising image to improve conversion while preserving its core concept, main person/model, logo, and brand identity. Keep the exact same dimensions, format and aspect ratio:"

Brief:
${finalPrompt}

Reply with ONLY the condensed prompt (no explanation).`,
      }],
    });

    const editPrompt = reformatMsg.content[0].text.trim().slice(0, 3900);
    console.log("✏️  Edit prompt:", editPrompt.slice(0, 120) + "…");

    // Paso 2: Convertir imagen a PNG RGBA
    const pngBuffer = await sharp(req.file.buffer).ensureAlpha().png().toBuffer();
    const imageFile = await toFile(pngBuffer, "arte.png", { type: "image/png" });

    // Paso 3: Editar con gpt-image-1
    const openai   = getOpenAI();
    const response = await openai.images.edit({
      model:   "gpt-image-1",
      image:   imageFile,
      prompt:  editPrompt,
      size:    "auto",
      quality: "high",
    });

    const base64 = response.data[0].b64_json;
    res.json({ success: true, image: `data:image/png;base64,${base64}` });
  } catch (err) {
    console.error("❌ Generate:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🐼 Panda Proof API → http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn("⚠️  ANTHROPIC_API_KEY no encontrada");
});
