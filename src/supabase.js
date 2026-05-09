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
