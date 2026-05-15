import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (URL && KEY)
  ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export const supabaseEnabled = !!supabase;

// ═══════════════════════════════════════════════════════════════════════════
// SISTEMA DE GUARDADO v2 — Storage de imágenes
// ───────────────────────────────────────────────────────────────────────────
// REGLA DE ORO: la base de datos NUNCA guarda imágenes base64.
// Toda imagen generada se comprime y se sube a Supabase Storage (object
// storage). En la DB solo viven URLs públicas livianas (~80 bytes).
//
// Por qué: meter PNG de 2-4 MB como base64 en columnas de Postgres llenaba
// la DB de 500 MB del free tier en pocos usos; al excederse, Supabase pone
// la DB en read-only y TODOS los INSERT fallan en silencio. Ese era el bug
// del "se vuelve a dañar".
// ═══════════════════════════════════════════════════════════════════════════

// Bucket público existente (creado por supabase-avatars-migration.sql) con RLS
// por carpeta = auth.uid(). Reutilizarlo evita depender de un bucket nuevo.
const STORAGE_BUCKET = "panda-media";
const STORAGE_BUCKET_FALLBACK = "avatars";

// ¿Es una imagen embebida (base64 / blob) que DEBE subirse a Storage?
function isEmbeddedImage(str) {
  return typeof str === "string" &&
    (str.startsWith("data:image") || str.startsWith("blob:"));
}

// Comprime una imagen a WebP (o JPEG de fallback) y la reescala si excede
// maxDim. Reduce el peso 3-5x sin pérdida visible — clave para que Storage
// no se llene. Devuelve un Blob. Si algo falla, cae al blob original.
async function compressImageBlob(src, { maxDim = 1600, quality = 0.9 } = {}) {
  const originalBlob = await (await fetch(src)).blob();
  try {
    const bitmap = await createImageBitmap(originalBlob);
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width  = Math.round(width  * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const out = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/webp", quality);
    });
    // Si WebP no está soportado o salió más pesado, intentar JPEG
    if (!out || out.size >= originalBlob.size) {
      const jpeg = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
      });
      if (jpeg && jpeg.size < originalBlob.size) return jpeg;
      return out || originalBlob;
    }
    return out;
  } catch (e) {
    console.warn("[compressImageBlob] usando blob original:", e?.message);
    return originalBlob;
  }
}

/**
 * Sube una imagen embebida (dataURL/blob) a Storage y devuelve su URL pública.
 * - Si `src` ya es una URL http(s) → la devuelve tal cual (idempotente).
 * - Si no hay sesión o Supabase está apagado → devuelve `src` sin tocar.
 * - 3 reintentos con backoff. Prueba bucket principal y luego el de fallback.
 * Lanza Error solo si TODOS los intentos fallan.
 */
export async function uploadImageToStorage(src, { folder = "gen", userId = null } = {}) {
  if (!supabase || !src || typeof src !== "string") return src || null;
  if (src.startsWith("http")) return src;          // ya está en Storage / es URL
  if (!isEmbeddedImage(src))  return src;          // no es imagen embebida

  let uid = userId;
  if (!uid) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id || null;
    } catch (_) { /* ignore */ }
  }
  if (!uid) return src; // sin usuario no podemos cumplir la RLS por carpeta

  let blob;
  try {
    blob = await compressImageBlob(src);
  } catch (e) {
    blob = await (await fetch(src)).blob();
  }
  const ext = blob.type.includes("webp") ? "webp"
            : blob.type.includes("jpeg") ? "jpg"
            : blob.type.includes("png")  ? "png" : "img";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  const buckets = [STORAGE_BUCKET, STORAGE_BUCKET_FALLBACK];
  let lastErr = null;
  for (const bucket of buckets) {
    const path = `${uid}/${folder}/${fileName}`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, blob, { contentType: blob.type || "image/webp", upsert: false });
      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
      }
      lastErr = error;
      // "Bucket not found" → no reintentar este bucket, pasar al fallback
      if (/not found|does not exist/i.test(error.message || "")) break;
      await new Promise((r) => setTimeout(r, 350 * attempt));
    }
  }
  console.error("[uploadImageToStorage] falló en todos los buckets:", lastErr?.message);
  throw new Error("storage_upload_failed");
}

/**
 * Recorre recursivamente un objeto/array y sube a Storage cualquier string
 * que sea una imagen embebida, reemplazándola por su URL pública.
 * Usado para sanitizar los JSON `data` de campañas y sesiones de menú.
 */
export async function uploadAllImagesDeep(value, { folder = "gen", userId = null } = {}) {
  if (value == null) return value;
  if (typeof value === "string") {
    if (isEmbeddedImage(value)) {
      try { return await uploadImageToStorage(value, { folder, userId }); }
      catch (_) { return value; } // si falla, conservar (caso raro)
    }
    return value;
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await uploadAllImagesDeep(item, { folder, userId }));
    return out;
  }
  if (typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = await uploadAllImagesDeep(value[k], { folder, userId });
    }
    return out;
  }
  return value;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function signUp({ email, password, name }) {
  if (!supabase) throw new Error("Supabase no configurado");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  if (!supabase) throw new Error("Supabase no configurado");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ── Analyses (DB) ─────────────────────────────────────────────────────────────
export async function saveAnalysis(analysis) {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("analyses")
    .insert({
      user_id:                 user.id,
      panda_score:             analysis.pandaScore,
      short_label:             analysis.shortLabel,
      score_label:             analysis.scoreLabel,
      score_interpretation:    analysis.scoreInterpretation,
      profile_applied:         analysis.profileApplied,
      platform_detected:       analysis.platformDetected,
      accion_recomendada:      analysis.accionRecomendada,
      active_weights:          analysis.activeWeights,
      context:                 analysis.contextUsed,
      categories:              analysis.categories,
      main_problems_detected:  analysis.mainProblemsDetected,
      top_recommendations:     analysis.topRecommendations,
      regeneration_priorities: analysis.regenerationPriorities,
      regeneration_prompt:     analysis.regenerationPrompt,
    })
    .select()
    .single();

  if (error) {
    console.error("saveAnalysis:", error.message);
    return null;
  }
  return data;
}

export async function listAnalyses() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("listAnalyses:", error.message);
    return [];
  }
  return data || [];
}

export async function deleteAnalysis(id) {
  if (!supabase) return;
  const { error } = await supabase.from("analyses").delete().eq("id", id);
  if (error) console.error("deleteAnalysis:", error.message);
}

// ── Campaigns (Foto a Campaña) ────────────────────────────────────────────────
// Antes de guardar, TODA imagen embebida dentro de `data` (foto subida, logo,
// anuncios generados) se sube a Storage y se reemplaza por su URL.
export async function saveCampaign(data) {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const cleanData = await uploadAllImagesDeep(data, { folder: "campaign", userId: user.id });
  const thumb = cleanData.adAngles?.find?.((a) => a.generatedImage)?.generatedImage || null;

  const { data: row, error } = await supabase
    .from("campaigns")
    .insert({
      user_id:      user.id,
      product_name: cleanData.productName || "Sin nombre",
      niche:        cleanData.detectedNiche || null,
      city:         cleanData.location?.city || null,
      thumbnail:    thumb,
      data:         cleanData,
    })
    .select()
    .single();

  if (error) {
    console.error("saveCampaign:", error.message);
    return null;
  }
  return row;
}

export async function updateCampaign(id, data) {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id || null;

  const cleanData = await uploadAllImagesDeep(data, { folder: "campaign", userId: uid });
  const thumb = cleanData.adAngles?.find?.((a) => a.generatedImage)?.generatedImage || null;

  const { error } = await supabase
    .from("campaigns")
    .update({
      product_name: cleanData.productName || "Sin nombre",
      niche:        cleanData.detectedNiche || null,
      city:         cleanData.location?.city || null,
      thumbnail:    thumb,
      data:         cleanData,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", id);
  if (error) console.error("updateCampaign:", error.message);
}

export async function listCampaigns() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, created_at, product_name, niche, city, thumbnail")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("listCampaigns:", error.message);
    return [];
  }
  return data || [];
}

export async function getCampaign(id) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("getCampaign:", error.message);
    return null;
  }
  return data;
}

export async function deleteCampaign(id) {
  if (!supabase) return;
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) console.error("deleteCampaign:", error.message);
}

// ── Mejorar Menú (reutiliza la tabla "campaigns" con flag interno) ────────────
// Guardamos cada sesión de menú como una fila en `campaigns` con
// `niche = "menu_improver"` y la data completa en el campo JSON `data`.
// Así no necesitamos migración de schema y reutilizamos listCampaigns/getCampaign
// para historial. La UI filtra por niche.
export async function saveMenuSession(session) {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const uid = user.id;

  // Subir TODAS las imágenes a Storage en paralelo. La DB solo verá URLs.
  let originalImage = session.originalImage || null;
  let improvedImage = session.improvedImage || null;
  let stories       = Array.isArray(session.stories) ? session.stories : [];

  try {
    const [orig, improved, storyImgs] = await Promise.all([
      originalImage ? uploadImageToStorage(originalImage, { folder: "menu", userId: uid }).catch(() => originalImage) : null,
      improvedImage ? uploadImageToStorage(improvedImage, { folder: "menu", userId: uid }).catch(() => improvedImage) : null,
      Promise.all(stories.map((s) =>
        s?.image
          ? uploadImageToStorage(s.image, { folder: "menu", userId: uid })
              .then((url) => ({ ...s, image: url }))
              .catch(() => s)
          : Promise.resolve(s)
      )),
    ]);
    originalImage = orig;
    improvedImage = improved;
    stories       = storyImgs;
  } catch (e) {
    console.error("saveMenuSession: error subiendo imágenes —", e.message);
  }

  const thumb = improvedImage
             || stories.find?.((s) => s.image)?.image
             || originalImage
             || null;

  const payload = {
    kind: "menu_improver",
    mode: session.mode || "improve",          // "improve" | "segment" | "both"
    format: session.format || "1080x1920",
    instructions: session.instructions || "",
    originalImage,
    improvedImage,
    stories,
    analysis: session.analysis || null,
    summary: session.summary || [],
    analysisModel: "panda-analyzer",
    generationModel: "panda-image",
  };

  const { data: row, error } = await supabase
    .from("campaigns")
    .insert({
      user_id:      uid,
      product_name: session.analysis?.businessName || session.analysis?.businessType || "Menú mejorado",
      niche:        "menu_improver",
      city:         session.analysis?.address || null,
      thumbnail:    thumb,
      data:         payload,
    })
    .select()
    .single();

  if (error) {
    console.error("saveMenuSession:", error.message);
    return null;
  }
  return row;
}

export async function listMenuSessions() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, created_at, product_name, niche, city, thumbnail, data")
    .eq("niche", "menu_improver")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) { console.error("listMenuSessions:", error.message); return []; }
  return data || [];
}

export async function getMenuSession(id) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("campaigns").select("*").eq("id", id).single();
  if (error) { console.error("getMenuSession:", error.message); return null; }
  return data;
}

export async function deleteMenuSession(id) {
  if (!supabase) return;
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) console.error("deleteMenuSession:", error.message);
}

// ── Saved Results (galería de artes optimizados guardados) ──────────────────
// La imagen SIEMPRE se sube a Storage; la fila guarda solo la URL pública.
export async function saveResult(result) {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!result?.imageUrl) { console.error("saveResult: sin imageUrl"); return null; }

  // Subir a Storage. Si falla tras los reintentos, abortamos: NO metemos
  // base64 a la DB (eso es justo lo que la rompía).
  let imageUrl;
  try {
    imageUrl = await uploadImageToStorage(result.imageUrl, {
      folder: "results", userId: user.id,
    });
  } catch (e) {
    console.error("saveResult: upload a Storage falló —", e.message);
    return null;
  }

  const { data: row, error } = await supabase
    .from("saved_results")
    .insert({
      user_id:             user.id,
      image_url:           imageUrl,
      type:                result.type || "optimized",
      title:               result.title || null,
      prompt:              result.prompt || null,
      source_flow:         result.sourceFlow || null,
      related_analysis_id: result.relatedAnalysisId || null,
    })
    .select()
    .single();

  if (error) {
    console.error("saveResult:", error.message);
    return null;
  }
  return row;
}

export async function listResults() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("saved_results")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("listResults:", error.message);
    return [];
  }
  return data || [];
}

export async function deleteResult(id) {
  if (!supabase) return;
  const { error } = await supabase.from("saved_results").delete().eq("id", id);
  if (error) console.error("deleteResult:", error.message);
}

// ── Account / Profile mutations ───────────────────────────────────────────────

/** Sube un archivo de imagen al bucket "avatars" y devuelve la URL pública */
export async function uploadAvatar(file) {
  if (!supabase) throw new Error("Supabase no configurado");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const ext = (file.name || "jpg").split(".").pop().toLowerCase() || "jpg";
  const path = `${user.id}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-busting para forzar recarga de la imagen en el navegador
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Actualiza el nombre de display en auth.users (user_metadata) */
export async function updateAuthDisplayName(name) {
  if (!supabase) throw new Error("Supabase no configurado");
  const { error } = await supabase.auth.updateUser({ data: { name: name.trim() } });
  if (error) throw error;
}

/** Cambia la contraseña del usuario autenticado */
export async function changePassword(newPassword) {
  if (!supabase) throw new Error("Supabase no configurado");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Devuelve el origen al que debe redirigir el usuario al volver de OAuth/recovery.
 *
 * Prioridad:
 *   1. VITE_APP_URL si está seteada en build (override explícito por entorno)
 *   2. window.location.origin (dinámico: funciona en Netlify, previews y dev)
 *
 * Nunca devuelve "localhost" en producción porque window.location.origin
 * SIEMPRE refleja el dominio donde corre el bundle actualmente.
 *
 * IMPORTANTE: Esta URL debe estar en la lista de "Redirect URLs" del proyecto
 * Supabase (Authentication → URL Configuration), de lo contrario Supabase
 * caerá silenciosamente al "Site URL" — si ese estaba en localhost,
 * el usuario se quedaba viendo localhost después del login.
 */
export function getAppOrigin() {
  const fromEnv = import.meta.env?.VITE_APP_URL;
  if (fromEnv && typeof fromEnv === "string" && fromEnv.startsWith("http")) {
    return fromEnv.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

/** Inicia sesión con Google OAuth (redirige a Google y vuelve a la app) */
export async function signInWithGoogle() {
  if (!supabase) throw new Error("Supabase no configurado");
  const origin = getAppOrigin();
  if (!origin || origin.includes("localhost")) {
    // En producción nunca debería ser localhost. Logueamos por si el bundle
    // queda corriendo en algún entorno sin ventana real (Capacitor, etc).
    console.warn("[auth] getAppOrigin devolvió un valor sospechoso:", origin);
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: origin,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error) throw error;
  return data;
}

/** Envía un correo con enlace para restablecer la contraseña */
export async function sendPasswordReset(email) {
  if (!supabase) throw new Error("Supabase no configurado");
  const origin = getAppOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/?recovery=1`,
  });
  if (error) throw error;
}

// ── Design Edits (Polotno) ────────────────────────────────────────────────────
// Guarda una versión editada de un saved_result (capa por capa).
// La imagen exportada se sube al bucket "avatars" (reutilizamos el storage
// que ya tiene RLS configurado) o se mantiene como dataURL si falla la subida.
export async function saveDesignEdit({ resultId = null, baseImageUrl, polotnoJson, exportedDataUrl, title = null }) {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Intenta subir el PNG exportado al storage (bucket avatars ya existe + RLS OK)
  let exportedUrl = null;
  if (exportedDataUrl && typeof exportedDataUrl === "string" && exportedDataUrl.startsWith("data:")) {
    try {
      const blob = await (await fetch(exportedDataUrl)).blob();
      const path = `${user.id}/edits/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/png" });
      if (!upErr) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        exportedUrl = data.publicUrl;
      }
    } catch (e) {
      console.warn("[saveDesignEdit] upload failed, fallback to dataURL:", e.message);
    }
  }

  const row = {
    user_id:            user.id,
    result_id:          resultId,
    base_image_url:     baseImageUrl || null,
    polotno_json:       polotnoJson || null,
    exported_image_url: exportedUrl || exportedDataUrl || null,
    title:              title || "Diseño editado",
  };

  const { data, error } = await supabase.from("design_edits").insert(row).select().single();
  if (error) {
    console.error("[saveDesignEdit]:", error.message);
    return null;
  }
  return data;
}

export async function listDesignEdits(resultId = null) {
  if (!supabase) return [];
  let q = supabase.from("design_edits").select("*").order("created_at", { ascending: false }).limit(50);
  if (resultId) q = q.eq("result_id", resultId);
  const { data, error } = await q;
  if (error) { console.error("listDesignEdits:", error.message); return []; }
  return data || [];
}

// Convert DB row → app analysis shape
export function rowToAnalysis(row) {
  return {
    id:                     row.id,
    createdAt:              row.created_at,
    pandaScore:             row.panda_score,
    shortLabel:             row.short_label,
    scoreLabel:             row.score_label,
    scoreInterpretation:    row.score_interpretation,
    profileApplied:         row.profile_applied,
    platformDetected:       row.platform_detected,
    accionRecomendada:      row.accion_recomendada,
    activeWeights:          row.active_weights || {},
    contextUsed:            row.context || {},
    categories:             row.categories || {},
    mainProblemsDetected:   row.main_problems_detected || [],
    topRecommendations:     row.top_recommendations || [],
    regenerationPriorities: row.regeneration_priorities || [],
    regenerationPrompt:     row.regeneration_prompt || "",
  };
}
