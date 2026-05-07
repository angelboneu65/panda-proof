import express from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI, { toFile } from "openai";
import cors from "cors";
import sharp from "sharp";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env ─────────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
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
  if (!process.env.OPENAI_API_KEY)
    throw new Error("OPENAI_API_KEY no configurada en .env");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
}));
app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, key: !!process.env.ANTHROPIC_API_KEY })
);

// ── Extract business data from image ─────────────────────────────────────────
app.post("/api/extract", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió imagen." });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada." });

    const imageBase64 = req.file.buffer.toString("base64");
    const mediaType   = req.file.mimetype;

    const message = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: `Eres un experto en marketing digital. Analiza esta imagen publicitaria e infiere los datos del negocio.

Devuelve ÚNICAMENTE este JSON válido, sin texto adicional ni markdown:

{
  "nicho": "<tipo de negocio detectado, ej: Spa y Centro de Bienestar, Restaurante, Clínica Dental>",
  "producto": "<producto o servicio principal que se anuncia, específico>",
  "publico": "<público objetivo probable basado en la imagen, ej: Mujeres 25-45 años>",
  "plataforma": "<una de estas opciones: Instagram Feed|Instagram Stories|Facebook|TikTok|WhatsApp Status|Google Ads|Web / Landing page|Impreso / Flyer>",
  "objetivo": "<una de estas opciones: Mensajes / WhatsApp|Ventas directas|Reservas|Llamadas|Tráfico web|Reconocimiento de marca|Captación de leads>",
  "oferta": "<precio u oferta visible en la imagen, o cadena vacía si no hay>"
}

Basa tus inferencias en los elementos visuales, texto, colores y estilo de la imagen. Responde en español.` },
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

// ── Panda Score — weight profiles per conversion objective ────────────────────
const WEIGHT_PROFILES = {
  "Mensajes / WhatsApp": {
    perfil: "Conversión directa — Mensajes",
    pesos: {
      cta: 20, claridad_mensaje: 15, fuerza_oferta: 15, legibilidad_movil: 15,
      confianza_credibilidad: 10, jerarquia_visual: 10, relevancia_publico: 10,
      calidad_visual: 5, relevancia_nicho: 0, friccion_conversion: 0,
    },
  },
  "Ventas directas": {
    perfil: "Venta online / E-commerce",
    pesos: {
      fuerza_oferta: 20, claridad_mensaje: 20, confianza_credibilidad: 15, cta: 15,
      legibilidad_movil: 10, calidad_visual: 10, friccion_conversion: 10,
      jerarquia_visual: 0, relevancia_nicho: 0, relevancia_publico: 0,
    },
  },
  "Reservas": {
    perfil: "Captación de reservas / Citas",
    pesos: {
      cta: 18, claridad_mensaje: 15, confianza_credibilidad: 15, fuerza_oferta: 12,
      legibilidad_movil: 12, jerarquia_visual: 10, relevancia_publico: 10,
      calidad_visual: 8, relevancia_nicho: 0, friccion_conversion: 0,
    },
  },
  "Llamadas": {
    perfil: "Captación telefónica",
    pesos: {
      cta: 20, confianza_credibilidad: 18, claridad_mensaje: 15, fuerza_oferta: 12,
      legibilidad_movil: 12, jerarquia_visual: 10, relevancia_publico: 8,
      calidad_visual: 5, relevancia_nicho: 0, friccion_conversion: 0,
    },
  },
  "Tráfico web": {
    perfil: "Generación de tráfico web",
    pesos: {
      claridad_mensaje: 18, cta: 18, fuerza_oferta: 15, jerarquia_visual: 12,
      legibilidad_movil: 12, calidad_visual: 10, relevancia_publico: 10,
      confianza_credibilidad: 5, relevancia_nicho: 0, friccion_conversion: 0,
    },
  },
  "Reconocimiento de marca": {
    perfil: "Branding y awareness",
    pesos: {
      calidad_visual: 20, relevancia_nicho: 20, relevancia_publico: 20,
      jerarquia_visual: 15, claridad_mensaje: 10, confianza_credibilidad: 10,
      cta: 5, fuerza_oferta: 0, legibilidad_movil: 0, friccion_conversion: 0,
    },
  },
  "Captación de leads": {
    perfil: "Lead generation",
    pesos: {
      fuerza_oferta: 18, cta: 18, confianza_credibilidad: 15, claridad_mensaje: 15,
      legibilidad_movil: 12, jerarquia_visual: 10, relevancia_publico: 8,
      calidad_visual: 4, relevancia_nicho: 0, friccion_conversion: 0,
    },
  },
};

const DEFAULT_PROFILE = {
  perfil: "Performance balanceado",
  pesos: {
    claridad_mensaje: 12, fuerza_oferta: 12, jerarquia_visual: 10,
    cta: 14, legibilidad_movil: 10, relevancia_nicho: 8,
    relevancia_publico: 8, confianza_credibilidad: 10,
    calidad_visual: 8, friccion_conversion: 8,
  },
};

function getWeightProfile(objetivo) {
  return WEIGHT_PROFILES[objetivo] || DEFAULT_PROFILE;
}

// ── Analyze ───────────────────────────────────────────────────────────────────
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)                    return res.status(400).json({ error: "No se recibió imagen." });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada." });

    const { nicho, producto, publico, plataforma, objetivo, oferta } = req.body;
    const imageBase64 = req.file.buffer.toString("base64");
    const mediaType   = req.file.mimetype;

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text",  text: buildPrompt({ nicho, producto, publico, plataforma, objetivo, oferta }) },
        ],
      }],
    });

    const raw   = message.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "No se pudo parsear la respuesta." });

    res.json({ success: true, analysis: JSON.parse(match[0]) });
  } catch (err) {
    console.error("❌", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Prompt builder — Panda Score system ───────────────────────────────────────
function buildPrompt({ nicho, producto, publico, plataforma, objetivo, oferta }) {
  const { perfil, pesos } = getWeightProfile(objetivo);

  const criteriaBlock = Object.entries({
    claridad_mensaje:    { label: "Claridad del mensaje",       desc: `¿Se entiende en 1–2 segundos qué se vende, a quién y por qué actuar ahora?` },
    fuerza_oferta:       { label: "Fuerza de la oferta",        desc: "¿La oferta/precio se percibe concreta, atractiva y con sentido de urgencia?" },
    jerarquia_visual:    { label: "Jerarquía visual",           desc: "¿Existe un recorrido claro: titular → beneficio/oferta → CTA? ¿Hay 3 niveles de peso visual?" },
    cta:                 { label: "CTA / Llamado a la acción",  desc: "¿La acción está clara, domina visualmente, es específica y urgente?" },
    legibilidad_movil:   { label: "Legibilidad móvil",          desc: "¿Todo el texto es legible en pantalla de celular sin hacer zoom?" },
    relevancia_nicho:    { label: "Relevancia con el nicho",    desc: `¿El arte se siente correcto para un negocio de tipo "${nicho}"?` },
    relevancia_publico:  { label: "Relevancia con el público",  desc: `¿El mensaje y la estética conectan auténticamente con "${publico}"?` },
    confianza_credibilidad: { label: "Confianza y credibilidad", desc: "¿El arte transmite seguridad, autoridad profesional y legitimidad de marca?" },
    calidad_visual:      { label: "Calidad visual premium",     desc: "¿Se ve limpio, coherente, bien ejecutado y con estética de pauta profesional?" },
    friccion_conversion: { label: "Fricción de conversión",     desc: "¿Hay elementos confusos, contradictorios o que dificulten que el usuario tome acción?" },
  })
    .map(([key, { label, desc }], i) => {
      const max = pesos[key] ?? 0;
      if (max === 0) return `${i + 1}. ${label} (0 pts — no aplica para objetivo "${objetivo}"): ${desc}`;
      return `${i + 1}. ${label} (0-${max} pts): ${desc}`;
    })
    .join("\n");

  const pesosJSON = JSON.stringify(pesos);

  return `Eres Panda Proof, un director creativo senior con 20 años de experiencia en campañas de performance para marcas de consumo masivo, spas, clínicas, restaurantes y e-commerce en Latinoamérica y Puerto Rico. Combinas honestidad con empatía — reconoces el esfuerzo detrás de cada diseño y das feedback constructivo orientado a resultados comerciales reales.

CONTEXTO DEL ARTE A EVALUAR:
- Negocio / Nicho: ${nicho}
- Producto o servicio: ${producto}
- Público objetivo: ${publico}
- Plataforma destino: ${plataforma}
- Objetivo de conversión: ${objetivo}
- Perfil de evaluación activo: ${perfil}
${oferta ? `- Oferta o precio visible en el arte: ${oferta}` : "— Sin oferta de precio explícita"}

═══════════════════════════════════════════════════════════
PANDA SCORE — SISTEMA DE EVALUACIÓN (100 puntos totales)
Perfil activo: ${perfil.toUpperCase()}
═══════════════════════════════════════════════════════════

Los pesos de cada criterio se ajustan según el objetivo "${objetivo}".
Criterios con 0 puntos = no aplican para este perfil de conversión.

${criteriaBlock}

PESOS ACTIVOS (JSON): ${pesosJSON}

CÓMO CALCULAR EL SCORE FINAL:
score_final = SUMA de todos los subscores del desglose.
El score_final no puede ser mayor a 100 ni menor a 1.

ESCALA DE VEREDICTO:
90-100: Excelente — prácticamente listo para pauta
80-89:  Muy bueno — pequeños ajustes y estará perfecto
70-79:  Bueno — base sólida, la versión mejorada lo lleva al siguiente nivel
60-69:  En desarrollo — buenos elementos, necesita optimización clara
40-59:  Con potencial — el contenido es valioso, el formato necesita trabajo
1-39:   Punto de partida — la versión mejorada hará una diferencia enorme

TONO DEL ANÁLISIS:
- Empático y orientado a resultados comerciales reales
- "resumen": reconoce algo genuinamente positivo, luego muestra la oportunidad clave
- "lo_que_funciona": específico y honesto — qué elementos reales tienen valor en este arte
- "lo_que_mejorar": concreto y accionable, como un director creativo senior
- "prompt_profesional": briefing detallado (mínimo 200 palabras) para regenerar el arte PRESERVANDO su esencia — incluye instrucciones específicas sobre qué conservar y qué mejorar

Devuelve ÚNICAMENTE este JSON válido, sin texto adicional ni markdown:

{
  "score_final": <número 1-100>,
  "veredicto": "<Excelente|Muy bueno|Bueno|En desarrollo|Con potencial|Punto de partida>",
  "resumen": "<2-3 líneas empáticas y comercialmente orientadas>",
  "lo_que_funciona": ["<punto genuino 1>", "<punto genuino 2>", "<punto genuino 3>"],
  "lo_que_mejorar": ["<oportunidad concreta 1>", "<oportunidad concreta 2>", "<oportunidad concreta 3>"],
  "desglose": {
    "claridad_mensaje": <0-${pesos.claridad_mensaje ?? 0}>,
    "fuerza_oferta": <0-${pesos.fuerza_oferta ?? 0}>,
    "jerarquia_visual": <0-${pesos.jerarquia_visual ?? 0}>,
    "cta": <0-${pesos.cta ?? 0}>,
    "legibilidad_movil": <0-${pesos.legibilidad_movil ?? 0}>,
    "relevancia_nicho": <0-${pesos.relevancia_nicho ?? 0}>,
    "relevancia_publico": <0-${pesos.relevancia_publico ?? 0}>,
    "confianza_credibilidad": <0-${pesos.confianza_credibilidad ?? 0}>,
    "calidad_visual": <0-${pesos.calidad_visual ?? 0}>,
    "friccion_conversion": <0-${pesos.friccion_conversion ?? 0}>
  },
  "pesos_activos": ${pesosJSON},
  "perfil_aplicado": "${perfil}",
  "prompt_profesional": "<briefing de rediseño — mínimo 200 palabras, específico, accionable, con instrucciones precisas para preservar la esencia del arte y mejorar su conversión>",
  "accion_recomendada": "<Publicarlo como está|Hacer ajustes menores|Rediseñarlo parcialmente|Rediseñarlo completo>"
}`;
}

// ── Panda Proof base preservation prompt ─────────────────────────────────────
const PANDA_PROOF_BASE_PROMPT = `Rediseña y mejora este arte publicitario manteniendo intacta su esencia comercial y visual. Preserva el concepto original, la idea principal, la oferta, el producto o servicio anunciado, la identidad visual de la marca, el logo y la persona o modelo principal. No reemplaces la modelo, no cambies el logo, no cambies la marca y no alteres el concepto del anuncio.

Tu objetivo es convertir el mismo arte en una versión más efectiva para conversión, especialmente en móvil. Mejora la claridad del mensaje, la jerarquía visual, la legibilidad, el balance de composición, el contraste, el orden visual, la fuerza del CTA y la percepción premium. Reduce ruido visual, evita saturación innecesaria, organiza la información en niveles claros y asegúrate de que la pieza pueda entenderse en 1–2 segundos.

Mantén la esencia original del diseño, pero optimízalo para que el usuario entienda rápidamente:
1. qué se está ofreciendo,
2. cuál es el beneficio o promoción principal,
3. qué acción debe tomar.

La nueva versión debe sentirse más clara, más profesional, más limpia, más comercial y más lista para vender, sin perder el estilo base de la pieza. Si el anuncio ya tiene un buen concepto visual, consérvalo y solo mejora su ejecución.

PRIORIDADES DE MEJORA (en orden):
1. Preservar concepto, marca, logo y persona/modelo principal — NUNCA reemplazar
2. Simplificar jerarquía visual a máximo 3 niveles: titular / oferta-beneficio / CTA
3. Reforzar el CTA — más visible, específico y orientado a acción
4. Optimizar legibilidad en móvil — texto principal legible sin zoom
5. Mejorar contraste entre texto y fondo
6. Eliminar elementos que compiten por atención innecesariamente
7. CTA del mercado: "Reserva hoy", "Agenda tu cita", "Escríbenos por WhatsApp", "Llama ahora"

REGLAS ABSOLUTAS:
- NO reemplazar al sujeto principal por otro distinto
- NO alterar el logo ni la identidad de marca
- NO inventar precios o beneficios que no existen en el arte
- NO hacer una reinvención — hacer una optimización
- MANTENER el formato/orientación/dimensiones exactas del arte original`;

// ── Dynamic generation prompt builder ─────────────────────────────────────────
function buildGenerationPrompt({ nicho, producto, publico, plataforma, objetivo, oferta, problemas, mejoras }) {
  const ofertaLine = oferta
    ? `La promoción u oferta principal es: ${oferta}.`
    : "No se especificó oferta de precio explícita — no inventes precios.";

  const problemasLine = problemas
    ? `Los principales problemas detectados por el análisis son: ${problemas}.`
    : "Aplica mejoras generales de legibilidad, jerarquía y conversión.";

  const mejorasLine = mejoras
    ? `Las prioridades de mejora son: ${mejoras}.`
    : "Prioriza: reforzar CTA, simplificar jerarquía, mejorar legibilidad móvil.";

  return `Rediseña y mejora este arte publicitario para un negocio de tipo ${nicho}, donde se está promoviendo ${producto}, dirigido a ${publico}, pensado para publicarse en ${plataforma} con el objetivo de ${objetivo}. ${ofertaLine}

PRESERVA INTACTO (REGLAS ABSOLUTAS — nunca violar):
- La persona o modelo principal — NO la reemplaces por otra persona distinta
- El logo y la identidad visual de marca — NO lo alteres ni reinterpretes
- El concepto central del anuncio — NO cambies la idea principal
- El estilo visual base que ya funciona — NO reinventes, OPTIMIZA
- La oferta y precios presentes — NO inventes datos que no están en el arte

${problemasLine}
${mejorasLine}

MEJORA ESPECÍFICAMENTE:
- Jerarquía visual: organiza en 3 niveles claros → titular / oferta-beneficio / CTA
- CTA: hazlo más visible, específico y orientado a acción inmediata
  • Para WhatsApp/mensajes: "Escríbenos hoy", "Reserva por WhatsApp"
  • Para reservas/citas: "Reserva ahora", "Agenda tu cita"
  • Para ventas: "Compra ahora", "Aprovecha hoy"
- Legibilidad móvil: texto principal debe leerse sin zoom en celular
- Contraste: texto sobre fondo con contraste suficiente
- Composición: elimina elementos que compiten por atención innecesariamente
- Percepción premium: limpio, ordenado, profesional — como pauta de agencia

El resultado debe ser una versión OPTIMIZADA del mismo arte — no una reinvención.
Mismo concepto + mejor ejecución = más conversión.`;
}

// ── Generate / Edit image (gpt-image-1) ──────────────────────────────────────
app.post("/api/generate", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió imagen." });

    const { nicho, producto, publico, plataforma, objetivo, oferta, problemas, mejoras } = req.body;

    // Build prompt: dynamic if context available, base otherwise
    const sourcePrompt = (nicho && producto)
      ? buildGenerationPrompt({ nicho, producto, publico, plataforma, objetivo, oferta, problemas, mejoras })
      : PANDA_PROOF_BASE_PROMPT;

    // Paso 1: Sonnet condensa el prompt para gpt-image-1
    const reformatMsg = await client.messages.create({
      model:      "claude-sonnet-4-5",
      max_tokens: 700,
      messages: [{
        role: "user",
        content: `You are an image editing prompt engineer for gpt-image-1 (OpenAI).
Condense the following creative brief into a single, clear editing instruction under 1800 characters.

ABSOLUTE RULES — never break these:
- OUTPUT must be the EXACT same aspect ratio and orientation as the input image (square stays square, horizontal stays horizontal, vertical stays vertical)
- Do NOT add black bars, padding, or change canvas size in any way
- Preserve ALL brand elements: logo, color palette, font style, photography
- Do NOT replace the main person/model with a different person — preserve the same subject
- Do NOT alter or reinterpret the logo or brand identity
- Do NOT change the core concept of the ad
- Do NOT invent prices or benefits not present in the original

Write in English only. Start with: "Optimize this advertising image to improve conversion while preserving its core concept, main person/model, logo, and brand identity. Keep the exact same dimensions, format and aspect ratio:"

Brief:
${sourcePrompt}

Reply with ONLY the condensed prompt (no explanation).`,
      }],
    });

    const editPrompt = reformatMsg.content[0].text.trim().slice(0, 3900);
    console.log("✏️  Edit prompt:", editPrompt.slice(0, 150) + "…");

    // Paso 2: Convertir imagen a PNG RGBA
    const pngBuffer = await sharp(req.file.buffer)
      .ensureAlpha()
      .png()
      .toBuffer();

    const imageFile = await toFile(pngBuffer, "arte.png", { type: "image/png" });

    // Paso 3: Editar con gpt-image-1
    const openai = getOpenAI();
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
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠️  ANTHROPIC_API_KEY no encontrada en .env");
  }
});
