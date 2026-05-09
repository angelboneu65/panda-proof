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
app.use(express.json({ limit: "30mb" }));

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

// ── Build full analysis context for the edit prompt ──────────────────────────
function buildSurgicalContext({ nicho, producto, publico, plataforma, objetivo, oferta, problemas, recomendaciones, mejoras, briefing, customInstructions }) {
  const lines = [];

  if (nicho && producto) {
    lines.push(`ADVERTISEMENT CONTEXT:`);
    lines.push(`Business type: ${nicho} | Product/Service: ${producto}`);
    lines.push(`Target audience: ${publico || "general"} | Platform: ${plataforma || "social media"} | Goal: ${objetivo || "conversion"}`);
    if (oferta) lines.push(`Offer/price in the image: ${oferta} — preserve exactly, do NOT change`);
  }

  if (problemas) {
    lines.push(`\nPROBLEMS DETECTED BY ANALYSIS (fix these):\n${problemas}`);
  }

  if (recomendaciones) {
    lines.push(`\nTOP RECOMMENDATIONS FROM ANALYSIS (apply these):\n${recomendaciones}`);
  }

  if (mejoras) {
    lines.push(`\nREGENERATION PRIORITIES (in order of impact):\n${mejoras}`);
  }

  if (briefing) {
    lines.push(`\nPROFESSIONAL CREATIVE BRIEFING (follow this direction):\n${briefing}`);
  }

  if (customInstructions) {
    lines.push(`\nUSER-SPECIFIC INSTRUCTIONS (HIGHEST PRIORITY — apply exactly):\n${customInstructions}`);
  }

  return lines.join("\n");
}

// ── Generate / Edit image (gpt-image-1) ──────────────────────────────────────
app.post("/api/generate", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió imagen." });

    const { nicho, producto, publico, plataforma, objetivo, oferta, problemas, recomendaciones, mejoras, briefing, customInstructions } = req.body;

    const context = buildSurgicalContext({ nicho, producto, publico, plataforma, objetivo, oferta, problemas, recomendaciones, mejoras, briefing, customInstructions });

    // Paso 1: Sonnet genera una lista de cambios QUIRÚRGICOS mínimos
    const reformatMsg = await client.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `You are a surgical image-editing prompt engineer for gpt-image-1 (OpenAI image edit API).

The user is EDITING an existing advertisement — NOT creating a new one. The source image is uploaded as reference.
Your job: write a SHORT, SURGICAL list of ONLY the specific changes needed. Everything not mentioned must stay pixel-identical to the original.

ABSOLUTE RULES:
- Keep the main person/model/subject EXACTLY as they appear — never replace or alter them
- Keep the logo, brand name, and color palette EXACTLY as they appear
- Keep all existing prices, phone numbers, and contact info EXACTLY as shown
- Keep the same aspect ratio, canvas size, and orientation
- Do NOT redesign or recreate from scratch — ONLY apply the listed targeted changes
- If USER-SPECIFIC INSTRUCTIONS are provided, they have HIGHEST priority

OUTPUT FORMAT — write in English, under 900 characters, starting exactly with:
"This is an existing advertisement. Apply ONLY these specific targeted edits while keeping everything else in the image exactly as it is:"

Then list 3-6 concrete, minimal changes. Be specific (e.g. "increase font size of the phone number", "add stronger contrast behind the CTA text", "make the CTA button more prominent").

Context about the image:
${context || "General advertising image — improve readability, visual hierarchy, and CTA visibility."}

Reply with ONLY the prompt text. No explanation.`,
      }],
    });

    const editPrompt = reformatMsg.content[0].text.trim().slice(0, 3900);
    console.log("✏️  Edit prompt:", editPrompt.slice(0, 150) + "…");

    // Paso 2: Convertir imagen a PNG RGBA (requerido por gpt-image-1 edit)
    const pngBuffer = await sharp(req.file.buffer).ensureAlpha().png().toBuffer();
    const imageFile = await toFile(pngBuffer, "arte.png", { type: "image/png" });

    // Paso 3: Editar con gpt-image-1 (imagen original como base)
    const openai   = getOpenAI();
    const response = await openai.images.edit({
      model:   "gpt-image-2",
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

// ═════════════════════════════════════════════════════════════════════════════
// FOTO A CAMPAÑA — endpoints nuevos
// ═════════════════════════════════════════════════════════════════════════════

// 1) Analiza una foto de producto y devuelve contexto de campaña
app.post("/api/analyze-photo", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió imagen." });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada." });

    const imageBase64 = req.file.buffer.toString("base64");
    const mediaType   = req.file.mimetype;

    const message = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          {
            type: "text",
            text: `Eres un consultor de marketing y producto experto. Analiza esta foto y devuelve información estructurada para crear una campaña publicitaria.

Devuelve ÚNICAMENTE este JSON, sin markdown ni texto extra:
{
  "detectedObject": "<qué objeto/producto/escena aparece>",
  "detectedNiche": "<industria o nicho específico, ej: Bienestar y Spa, Restaurante, Joyería artesanal, etc.>",
  "productName": "<nombre claro del producto o servicio>",
  "shortDescription": "<una frase descriptiva breve>",
  "mainBenefit": "<beneficio principal para el cliente>",
  "problemSolved": "<problema concreto que resuelve>",
  "targetAudience": "<público objetivo probable, ej: Mujeres 25-45 años profesionales>",
  "offerType": "<UNA opción exacta de: Descuento %|2x1|Combo|Precio especial|Sin oferta>",
  "suggestedRegularPrice": "<precio regular estimado, ej: $79>",
  "suggestedPromoPrice": "<precio promocional estimado, ej: $49>",
  "finalRecommendedPrice": "<precio final recomendado, ej: $59>",
  "priceJustification": "<1-2 frases explicando por qué esos precios>",
  "cta": "<call-to-action sugerido en español, ej: Reserva ahora>"
}

Sé específico y aterrizado. Responde en español los strings descriptivos.`,
          },
        ],
      }],
    });

    const raw   = message.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "No se pudo extraer la información." });

    res.json({ success: true, data: JSON.parse(match[0]) });
  } catch (err) {
    console.error("❌ analyze-photo:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2) Analiza un logo y extrae rasgos de marca
app.post("/api/extract-brand", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió logo." });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada." });

    const imageBase64 = req.file.buffer.toString("base64");
    const mediaType   = req.file.mimetype;

    const message = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          {
            type: "text",
            text: `Eres un experto en branding visual. Analiza este logo y extrae los rasgos de la marca.

Devuelve ÚNICAMENTE este JSON, sin texto extra:
{
  "primaryColors": ["#hex1", "#hex2"],
  "secondaryColors": ["#hex3", "#hex4"],
  "visualStyle": "<estilo visual breve, ej: Minimalista moderno|Vibrante divertido|Premium clásico>",
  "brandPersonality": "<personalidad, ej: Profesional confiable|Cercana y cálida|Lujosa elegante|Energética joven>",
  "suggestedTypography": "<sugerencia tipográfica, ej: Sans-serif moderna como Inter o Helvetica Neue>"
}

Estima los hex de los colores con precisión. Responde los strings en español.`,
          },
        ],
      }],
    });

    const raw   = message.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "No se pudo analizar el logo." });

    res.json({ success: true, brand: JSON.parse(match[0]) });
  } catch (err) {
    console.error("❌ extract-brand:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3) Genera 5 anuncios diferentes en paralelo
app.post("/api/generate-campaign", async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.productName) return res.status(400).json({ error: "Faltan datos del producto." });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada." });
    if (!process.env.OPENAI_API_KEY)    return res.status(500).json({ error: "OPENAI_API_KEY no configurada." });

    // ── Paso 1: Estrategia con Claude — define los 5 ángulos ─────────────────
    const strategy = await client.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 3000,
      messages: [{
        role: "user",
        content: `Eres director creativo senior. Crea ESTRATEGIA para 5 anuncios DIFERENTES para esta campaña.

PRODUCTO: ${data.productName}
NICHO: ${data.niche || "general"}
DESCRIPCIÓN: ${data.shortDescription || ""}
BENEFICIO PRINCIPAL: ${data.mainBenefit || ""}
PROBLEMA QUE RESUELVE: ${data.problemSolved || ""}
PÚBLICO OBJETIVO: ${data.targetAudience || ""}
TIPO DE OFERTA: ${data.offerType || "Sin oferta"}
${data.regularPrice ? `PRECIO REGULAR: ${data.regularPrice}` : ""}
${data.promoPrice ? `PRECIO PROMO: ${data.promoPrice}` : ""}
${data.finalPrice ? `PRECIO FINAL: ${data.finalPrice}` : ""}
${data.location?.city ? `UBICACIÓN: ${data.location.city}, ${data.location.country || ""}` : ""}
${data.brand?.visualStyle ? `ESTILO DE MARCA: ${data.brand.visualStyle}` : ""}
${data.brand?.brandPersonality ? `PERSONALIDAD: ${data.brand.brandPersonality}` : ""}
${data.brand?.primaryColors?.length ? `COLORES MARCA: ${data.brand.primaryColors.join(", ")}` : ""}

REGLAS para los 5 ángulos:
- Adapta los nombres y enfoques al nicho específico (NO uses los mismos genéricos)
- Cada ángulo debe ser estratégicamente DISTINTO (no 5 versiones del mismo)
- Inspírate en estos arquetipos pero adáptalos: Oferta directa, Problema/Solución, Deseo emocional, Confianza/Autoridad, Urgencia/Temporada
- Optimiza para Instagram y Facebook Ads
- Legible en móvil
- Máximo: 1 mensaje principal + 1 beneficio + 1 CTA por anuncio
- Sin saturar de texto

Devuelve ÚNICAMENTE este JSON, sin markdown:
{
  "adAngles": [
    {
      "angleName": "<nombre del ángulo, específico al nicho>",
      "objective": "<objetivo del anuncio>",
      "headline": "<titular corto y potente, máx 8 palabras>",
      "subheadline": "<beneficio o sub-mensaje, máx 12 palabras>",
      "cta": "<call to action, máx 4 palabras, ej: Reserva ahora>",
      "designDirection": "<descripción visual: layout, paleta, ánimo, énfasis>",
      "generationPrompt": "<prompt EN INGLÉS para gpt-image, 80-150 palabras: describe el ad completo, layout, hero del producto desde la foto, jerarquía visual, brand colors, typography, CTA prominent, mobile-optimized>"
    }
  ]
}

Genera EXACTAMENTE 5 entradas. generationPrompt SIEMPRE en inglés.`,
      }],
    });

    const rawStrat   = strategy.content[0].text;
    const stratMatch = rawStrat.match(/\{[\s\S]*\}/);
    if (!stratMatch) return res.status(500).json({ error: "No se pudo generar la estrategia." });

    const parsed = JSON.parse(stratMatch[0]);
    const adAngles = parsed.adAngles || [];
    if (adAngles.length === 0) return res.status(500).json({ error: "Estrategia vacía." });

    console.log(`🎯 Estrategia generada: ${adAngles.length} ángulos`);

    // ── Paso 2: Genera las 5 imágenes en paralelo con gpt-image-2 ─────────────
    const openai = getOpenAI();
    const format = (data.formats && data.formats[0]) || "1080x1920";
    const size   = format === "1080x1920" ? "1024x1536" : (format === "1080x1080" ? "1024x1024" : "1024x1024");

    let sourcePng = null;
    if (data.sourcePhoto) {
      try {
        const b64 = data.sourcePhoto.includes(",") ? data.sourcePhoto.split(",")[1] : data.sourcePhoto;
        sourcePng = await sharp(Buffer.from(b64, "base64")).ensureAlpha().png().toBuffer();
      } catch (e) {
        console.warn("⚠️  No se pudo procesar sourcePhoto:", e.message);
      }
    }

    const brandColors  = data.brand?.primaryColors?.join(", ") || "use confident brand accents";
    const visualStyle  = data.brand?.visualStyle || "modern, premium";

    const generations = await Promise.allSettled(
      adAngles.slice(0, 5).map(async (angle) => {
        try {
          const fullPrompt = `${angle.generationPrompt}

Brand color palette: ${brandColors}.
Visual style: ${visualStyle}.
Logo placement: top corner, small but visible.
CTA: clearly visible, high contrast.
Typography: clean, mobile-readable.
The product from the source photo MUST be the visual hero of the composition.`;

          const response = sourcePng
            ? await openai.images.edit({
                model:   "gpt-image-2",
                image:   await toFile(sourcePng, "source.png", { type: "image/png" }),
                prompt:  fullPrompt.slice(0, 3900),
                size,
                quality: "medium",
              })
            : await openai.images.generate({
                model:   "gpt-image-2",
                prompt:  fullPrompt.slice(0, 3900),
                size,
                quality: "medium",
              });

          const b64 = response.data[0].b64_json;
          return { ...angle, generatedImage: `data:image/png;base64,${b64}` };
        } catch (err) {
          console.error(`❌ Imagen "${angle.angleName}":`, err.message);
          return { ...angle, generatedImage: null, error: err.message };
        }
      })
    );

    const results = generations.map((g) =>
      g.status === "fulfilled" ? g.value : { generatedImage: null, error: g.reason?.message || "fail" }
    );

    res.json({ success: true, adAngles: results });
  } catch (err) {
    console.error("❌ generate-campaign:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4) Reverse geocode + estimación de competencia (sin Google Places, gratis)
//    - OpenStreetMap Nominatim para ciudad/región/país (rate limit: 1 req/s)
//    - Claude para estimar 3-5 competidores plausibles con rangos de precio
app.post("/api/reverse-geocode", async (req, res) => {
  try {
    const { lat, lng, niche, productName, city: cityHint } = req.body || {};
    if (!lat || !lng) return res.status(400).json({ error: "Faltan coordenadas." });

    // Nominatim — reverse geocoding gratis
    let city = "", region = "", country = "";
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`;
      const r = await fetch(url, { headers: { "User-Agent": "PandaProof/1.0 (panda-proof.onrender.com)" } });
      if (r.ok) {
        const j  = await r.json();
        const ad = j.address || {};
        city    = ad.city || ad.town || ad.village || ad.municipality || "";
        region  = ad.state || ad.region || "";
        country = ad.country || "";
      }
    } catch (e) {
      console.warn("Nominatim falló:", e.message);
    }

    const finalCity = cityHint || city;

    // Claude — estima competencia local + rango de precios para el nicho
    let competitors = [];
    if (finalCity && niche && process.env.ANTHROPIC_API_KEY) {
      try {
        const message = await client.messages.create({
          model:      "claude-haiku-4-5",
          max_tokens: 700,
          messages: [{
            role: "user",
            content: `Estás analizando competencia local para una campaña publicitaria.

UBICACIÓN: ${finalCity}, ${region || country || ""}
NICHO: ${niche}
PRODUCTO/SERVICIO: ${productName || "general del nicho"}

Estima 3-5 tipos de competidores típicos que existirían en esa ubicación + nicho, con rangos de precio realistas en moneda local. NO inventes nombres específicos de negocios — usa categorías o arquetipos (ej: "Spa boutique premium del centro", "Cadena nacional", "Profesional independiente a domicilio").

Devuelve ÚNICAMENTE este JSON:
{
  "competitors": [
    { "name": "<arquetipo o categoría>", "estimatedPriceRange": "<ej: $40-70 USD>", "source": "Estimación basada en mercado local" }
  ]
}

Responde en español.`,
          }],
        });

        const raw   = message.content[0].text;
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed.competitors)) competitors = parsed.competitors;
        }
      } catch (e) {
        console.warn("Estimación de competencia falló:", e.message);
      }
    }

    res.json({ success: true, city: finalCity, region, country, competitors });
  } catch (err) {
    console.error("❌ reverse-geocode:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 5) Regenerar UN solo anuncio (cuando el usuario edita texto o pide nueva versión)
app.post("/api/regenerate-ad", async (req, res) => {
  try {
    const { angle, brand, sourcePhoto, format } = req.body || {};
    if (!angle?.generationPrompt) return res.status(400).json({ error: "Falta el prompt del ángulo." });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY no configurada." });

    const openai = getOpenAI();
    const size   = format === "1080x1920" ? "1024x1536"
                 : format === "1080x1080" ? "1024x1024"
                 : "1024x1536";

    let sourcePng = null;
    if (sourcePhoto) {
      try {
        const b64 = sourcePhoto.includes(",") ? sourcePhoto.split(",")[1] : sourcePhoto;
        sourcePng = await sharp(Buffer.from(b64, "base64")).ensureAlpha().png().toBuffer();
      } catch (e) {
        console.warn("⚠️  No se pudo procesar sourcePhoto:", e.message);
      }
    }

    const brandColors = brand?.primaryColors?.join(", ") || "use confident brand accents";
    const visualStyle = brand?.visualStyle || "modern, premium";

    // Si el usuario editó headline/subheadline/cta, los inyectamos en el prompt
    const overrides = [];
    if (angle.headline)    overrides.push(`Main headline: "${angle.headline}"`);
    if (angle.subheadline) overrides.push(`Sub-headline: "${angle.subheadline}"`);
    if (angle.cta)         overrides.push(`CTA button text: "${angle.cta}"`);

    const fullPrompt = `${angle.generationPrompt}

${overrides.length ? `IMPORTANT — use these EXACT texts (do not rewrite):\n${overrides.join("\n")}` : ""}

Brand color palette: ${brandColors}.
Visual style: ${visualStyle}.
Logo placement: top corner, small but visible.
CTA: clearly visible, high contrast.
Typography: clean, mobile-readable.
The product from the source photo MUST be the visual hero of the composition.`;

    const response = sourcePng
      ? await openai.images.edit({
          model:   "gpt-image-2",
          image:   await toFile(sourcePng, "source.png", { type: "image/png" }),
          prompt:  fullPrompt.slice(0, 3900),
          size,
          quality: "medium",
        })
      : await openai.images.generate({
          model:   "gpt-image-2",
          prompt:  fullPrompt.slice(0, 3900),
          size,
          quality: "medium",
        });

    const b64 = response.data[0].b64_json;
    res.json({ success: true, image: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error("❌ regenerate-ad:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🐼 Panda Proof API → http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn("⚠️  ANTHROPIC_API_KEY no encontrada");
});
