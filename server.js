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

// OpenAI se inicializa solo cuando hay clave para no crashear al arrancar
const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY)
    throw new Error("OPENAI_API_KEY no configurada en .env");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

app.use(cors({
  origin: (origin, cb) => cb(null, true),   // permite cualquier origen (Netlify, localhost, etc.)
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

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt({ nicho, producto, publico, plataforma, objetivo, oferta }) {
  const year = new Date().getFullYear();
  return `Eres un director creativo con 20 años de experiencia en campañas de performance para marcas de consumo masivo, spas, clínicas, restaurantes y e-commerce en Latinoamérica y Puerto Rico. Eres un mentor apasionado: tu objetivo es ayudar al negocio a crecer, no solo señalar errores. Combinás honestidad con empatía — reconocés el esfuerzo detrás de cada diseño y dás feedback constructivo que motiva a mejorar.

CONTEXTO DEL ARTE A EVALUAR:
- Negocio: ${nicho}
- Producto/Servicio: ${producto}
- Público objetivo: ${publico}
- Plataforma destino: ${plataforma}
- Objetivo de conversión: ${objetivo}
${oferta ? `- Oferta/Precio en el arte: ${oferta}` : "— Sin oferta de precio explícita"}

ESTÁNDAR DE REFERENCIA — INSTAGRAM STORY OPTIMIZADO (hacia donde va este arte):
Este arte será transformado en un Instagram Story vertical (1080×1920px) profesional para el mercado de Puerto Rico. El estándar con el que debe medirse es ese resultado final optimizado, que cumple:
• Formato vertical 9:16 con márgenes seguros para no quedar cortado por la UI de Instagram
• UN solo mensaje dominante visible en 1.5 segundos: oferta principal + beneficio clave
• Jerarquía de 3 niveles: (1) visual de impacto / titular, (2) detalle del servicio + precio, (3) CTA específico
• Texto grande, legible en mobile sin hacer zoom — mínimo 40px equivalente en Story
• CTA directo del mercado PR: "Reserva hoy", "Agenda tu cita", "Escríbenos por WhatsApp"
• Paleta de colores, logo e identidad de marca preservados 100%
• Sin elementos redundantes ni texto pequeño que no se lee en pantalla de celular
• Estilo premium y limpio — como pauta de Meta Ads profesional, no como flyer

CRITERIOS DE EVALUACIÓN vs. ESE ESTÁNDAR (100 puntos totales):
1. Claridad de la oferta (0-15): ¿Se entiende en 1.5 seg qué se vende, a qué precio y por qué actuar HOY? En el estándar Story esto es inmediato.
2. Fuerza del mensaje de venta (0-15): ¿El copy habla de beneficios concretos para ${publico}? ¿O solo describe características? El estándar usa beneficio + urgencia.
3. Jerarquía visual (0-15): ¿Hay un recorrido claro atención→interés→acción? El estándar Story tiene exactamente 3 niveles de peso visual.
4. Legibilidad móvil (0-10): ¿Todo el texto es legible en pantalla de celular sin hacer zoom? El estándar Story es 100% mobile-first.
5. Confianza y credibilidad (0-15): ¿Se proyecta profesionalismo, autoridad de marca, resultados reales? El estándar preserva identidad de marca para generar confianza.
6. Adecuación al formato Story e identidad de marca (0-15): ¿El formato actual se acerca al 9:16 vertical optimizado? ¿La paleta y logo están presentes y bien posicionados?
7. Llamado a la acción (0-10): ¿El CTA dice exactamente qué hacer? ¿Es urgente y específico como "Reserva hoy — cupos limitados"?
8. Potencial de conversión global (0-5): Si este arte se pauta tal como está, ¿qué retorno generaría vs. el estándar Story optimizado?

ESCALA DE VEREDICTO:
90-100: Excelente — casi listo para pauta
80-89: Muy bueno — pequeños ajustes y está perfecto
70-79: Bueno — tiene base sólida, la versión mejorada lo llevará al siguiente nivel
60-69: En desarrollo — buenos elementos, pero necesita la optimización Story para brillar
40-59: Con potencial — el contenido es valioso, el formato Story lo va a transformar
1-39: Punto de partida — la versión mejorada va a hacer una diferencia enorme

TONO DEL ANÁLISIS:
- Empático y motivador: reconocé el trabajo hecho, luego mostrá el camino de mejora
- En "resumen": empezá reconociendo algo positivo del arte, luego explicá qué oportunidad de mejora tiene hacia el estándar Story
- En "lo_que_funciona": sé genuino y específico — qué elementos reales tienen valor
- En "lo_que_mejorar": sé concreto y accionable, pero con tono de coach — "una gran oportunidad es cambiar X por Y porque Z"
- Recordá siempre que la versión mejorada con IA va a resolver exactamente estos puntos

Devuelve ÚNICAMENTE este JSON válido, sin texto adicional ni markdown:

{
  "score_final": <número 1-100>,
  "veredicto": "<Excelente|Muy bueno|Bueno|En desarrollo|Con potencial|Punto de partida>",
  "resumen": "<2-3 líneas empáticas: reconocé algo positivo, luego mostrá la oportunidad de mejora hacia el estándar Story optimizado>",
  "lo_que_funciona": ["<punto genuino y específico 1>", "<punto genuino y específico 2>", "<punto genuino y específico 3>"],
  "lo_que_mejorar": ["<oportunidad concreta y accionable 1>", "<oportunidad concreta y accionable 2>", "<oportunidad concreta y accionable 3>"],
  "desglose": {
    "claridad_oferta": <0-15>,
    "mensaje_venta": <0-15>,
    "jerarquia_visual": <0-15>,
    "legibilidad_movil": <0-10>,
    "confianza_profesional": <0-15>,
    "adecuacion_nicho": <0-15>,
    "cta": <0-10>,
    "conversion_general": <0-5>
  },
  "prompt_profesional": "<instrucciones profesionales completas de rediseño — mínimo 200 palabras, específicas, accionables, como briefing de agencia>",
  "accion_recomendada": "<Publicarlo como está|Hacer ajustes menores|Rediseñarlo parcialmente|Rediseñarlo completo>"
}`;
}

// ── Prompt fijo de Color Panda Media Lab para mejora de artes publicitarios ──
const CPML_STORY_PROMPT = `Analyze the provided advertising image and improve it professionally. CRITICAL: Keep EXACTLY the same dimensions, format, orientation and aspect ratio as the original image — do NOT change the size or layout structure.

Goal: Make the existing ad cleaner, more professional and higher-converting for the Puerto Rico market, without altering its format.

Instructions:
1. PRESERVE: exact same dimensions, orientation (horizontal/vertical/square), overall layout structure, brand color palette, logo position, and all genuine offer details (prices, discounts, services).
2. IMPROVE the text hierarchy: make the main offer/headline the most visually dominant element. Reduce or remove secondary text that clutters without adding value.
3. IMPROVE legibility: increase font sizes for key text, ensure strong contrast between text and background, remove small print that can't be read on mobile.
4. IMPROVE visual clarity: reduce competing visual elements, establish a clear focal point — one dominant image, one key message, one CTA.
5. IMPROVE the CTA: make it specific and action-oriented for the Puerto Rico market — "Reserva hoy", "Agenda tu cita", "Escríbenos por WhatsApp", "Disponible por tiempo limitado".
6. DO NOT invent prices, services, benefits, dates, conditions or discounts not present in the original. No medical claims or exaggerated promises.
7. Result: a cleaner, more premium version of the same ad — same format, same brand identity, but with better visual hierarchy, stronger message and clearer CTA.

The final result must look like a professional upgrade of the original — not a completely different piece.`;

// ── Generate / Edit image (gpt-image-1) ──────────────────────────────────────
app.post("/api/generate", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió imagen." });

    // Paso 1: Sonnet adapta el brief fijo a instrucción concisa para gpt-image-1
    const reformatMsg = await client.messages.create({
      model:      "claude-sonnet-4-5",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `You are an image editing prompt engineer for gpt-image-1 (OpenAI).
Condense the following creative brief into a single, clear editing instruction under 1800 characters.

ABSOLUTE RULES — never break these:
- OUTPUT must be the EXACT same aspect ratio and orientation as the input image (square stays square, horizontal stays horizontal, vertical stays vertical)
- Do NOT add black bars, padding, or change canvas size in any way
- Preserve ALL brand elements: logo, color palette, fonts style, photography

Write in English only. Start with: "Edit this advertising image to improve it while keeping the exact same dimensions, format and aspect ratio as the original:"

Brief:
${CPML_STORY_PROMPT}

Reply with ONLY the condensed prompt.`,
      }],
    });

    const editPrompt = reformatMsg.content[0].text.trim().slice(0, 3900);
    console.log("✏️  Edit prompt:", editPrompt.slice(0, 120) + "…");

    // Paso 2: Convertir imagen a PNG RGBA (requerido por gpt-image-1)
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
      size:    "auto",       // gpt-image-1 elige el tamaño ideal según la imagen
      quality: "high",       // máxima calidad disponible
    });

    // gpt-image-1 devuelve base64 directamente
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
