import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (URL && KEY)
  ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export const supabaseEnabled = !!supabase;

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
export async function saveCampaign(data) {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Thumbnail: usamos la primera imagen generada (si existe) para preview
  const thumb = data.adAngles?.find?.((a) => a.generatedImage)?.generatedImage || null;

  const { data: row, error } = await supabase
    .from("campaigns")
    .insert({
      user_id:      user.id,
      product_name: data.productName || "Sin nombre",
      niche:        data.detectedNiche || null,
      city:         data.location?.city || null,
      thumbnail:    thumb,
      data,
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
  const thumb = data.adAngles?.find?.((a) => a.generatedImage)?.generatedImage || null;
  const { error } = await supabase
    .from("campaigns")
    .update({
      product_name: data.productName || "Sin nombre",
      niche:        data.detectedNiche || null,
      city:         data.location?.city || null,
      thumbnail:    thumb,
      data,
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

// ── Saved Results (galería de artes optimizados guardados) ──────────────────
export async function saveResult(result) {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row, error } = await supabase
    .from("saved_results")
    .insert({
      user_id:             user.id,
      image_url:           result.imageUrl,
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
