// ═══════════════════════════════════════════════════════════════════════════
// API helper — agrega el Authorization: Bearer <jwt> automáticamente
// y detecta respuestas 402 (sin créditos) para que la UI las maneje.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

let _onInsufficientCredits = null;
export function onInsufficientCredits(cb) { _onInsufficientCredits = cb; }

// Listener global para cuando se realiza una acción que cobra créditos.
// El frontend lo usa para refrescar el perfil y mostrar toast.
let _onCreditCharge = null;
export function onCreditCharge(cb) { _onCreditCharge = cb; }

export async function authedFetch(path, options = {}) {
  let token = null;
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token || null;
    } catch (e) { /* ignore */ }
  }
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { ...options, headers });

  // Manejo global de 402 — dispara modal de "sin créditos"
  if (res.status === 402) {
    try {
      const info = await res.clone().json();
      if (_onInsufficientCredits) _onInsufficientCredits(info);
    } catch (e) { /* ignore */ }
  }

  // Si el endpoint cobró créditos (header X-Credits-Charged), avisamos
  const charged = res.headers.get("x-credits-charged");
  if (charged && _onCreditCharge) {
    try { _onCreditCharge(JSON.parse(charged)); } catch (e) { /* ignore */ }
  }
  return res;
}

export async function apiGet(path)             { return authedFetch(path); }
export async function apiPostJSON(path, body)  { return authedFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
export async function apiPostForm(path, form)  { return authedFetch(path, { method: "POST", body: form }); }
