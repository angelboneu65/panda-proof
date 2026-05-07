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

// ── Build surgical edit list for gpt-image-1 ─────────────────────────────────
function buildSurgicalContext({ nicho, producto, publico, plataforma, objetivo, oferta, problemas, mejoras, customInstructions }) {
  const lines = [];

  if (nicho && producto) {
    lines.push(`Advertising image for: ${nicho} — promoting: ${producto}`);
    lines.push(`Target audience: ${publico || "general"} | Platform: ${plataforma || "social media"} | Goal: ${objetivo || "conversion"}`);
    if (oferta) lines.push(`Offer shown in the image: ${oferta} — do NOT change this price/offer`);
  }

  if (mejoras)   lines.push(`Improvements required: ${mejoras}`);
  if (problemas) lines.push(`Problems to fix: ${problemas}`);

  if (customInstructions) {
    lines.push(`\nUSER-SPECIFIC INSTRUCTIONS (HIGHEST PRIORITY — apply exactly):\n${customInstructions}`);
  }

  return lines.join("\n");
}

// ── Generate / Edit image (gpt-image-1) ──────────────────────────────────────
app.post("/api/generate", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió imagen." });

    const { nicho, producto, publico, plataforma, objetivo, oferta, problemas, mejoras, customInstructions } = req.body;

    const context = buildSurgicalContext({ nicho, producto, publico, plataforma, objetivo, oferta, problemas, mejoras, customInstructions });

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
