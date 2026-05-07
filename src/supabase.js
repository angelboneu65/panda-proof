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
