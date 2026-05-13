import React, { useState, useEffect } from "react";
import { authedFetch, apiPostJSON } from "./api";
import { PLANS as CONFIG_PLANS, CREDIT_PACKAGES as CONFIG_PACKAGES } from "./config/credits";

// Modal que aparece cuando un endpoint devuelve 402 (créditos insuficientes).
// También se puede abrir manualmente desde el botón "Comprar créditos".
//
// Usa el endpoint /api/plans como fuente de verdad (que lee de Supabase). Si
// el endpoint falla, hace fallback a la config local de src/config/credits.js
// para que la UI nunca se quede vacía.
export default function CreditsModal({ open, info, onClose }) {
  const [plans, setPlans]       = useState(CONFIG_PLANS);
  const [packages, setPackages] = useState(CONFIG_PACKAGES);
  const [busy, setBusy]         = useState(null); // slug en checkout
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await authedFetch("/api/plans");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.plans) && data.plans.length > 0) {
            setPlans(data.plans.map((p) => ({
              slug: p.slug,
              name: p.name,
              price: Number(p.price),
              monthlyCredits: Number(p.monthly_credits ?? p.monthlyCredits ?? 0),
            })));
          }
          if (Array.isArray(data.packages) && data.packages.length > 0) {
            setPackages(data.packages.map((p) => ({
              slug: p.slug,
              name: p.name,
              price: Number(p.price),
              credits: Number(p.credits ?? 0),
            })));
          }
        }
      } catch (e) { /* fallback a config local */ }
    })();
  }, [open]);

  const startCheckout = async (slug, type) => {
    setBusy(slug); setError(null);
    try {
      const res = await apiPostJSON("/api/stripe/create-checkout", { slug, type, return_url: window.location.origin });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "No se pudo crear sesión de pago");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#0d0f22] shadow-2xl sm:rounded-[24px]"
           style={{ maxHeight: "90vh" }}>

        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
          <h2 className="text-lg font-black sm:text-xl">
            {info ? "Necesitas más créditos" : "Comprar créditos"}
          </h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20">✕</button>
        </div>

        <div className="space-y-5 overflow-y-auto p-4">
          {info && (
            <div className="rounded-2xl border border-purple-400/20 bg-purple-400/10 p-3 text-[13px] text-white/80">
              Esta acción requiere <strong>{info.required || "más"}</strong> créditos. Tienes <strong>{info.credits_balance ?? 0}</strong>. Suscríbete o compra una recarga abajo.
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">⚠️ {error}</div>
          )}

          {/* Planes (suscripción) */}
          {plans.length > 0 && (
            <section>
              <h3 className="text-[15px] font-black">Planes mensuales</h3>
              <p className="text-[12px] text-white/40">Créditos automáticos cada mes · AdChat IA incluido</p>
              <div className="mt-2 space-y-2">
                {plans.filter((p) => p.slug && p.slug !== "free").map((p) => {
                  const isPro = p.slug === "pro";
                  return (
                    <div key={p.slug} className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${
                      isPro
                        ? "border-purple-400/30 bg-gradient-to-br from-purple-600/12 via-pink-500/8 to-cyan-500/12"
                        : "border-white/10 bg-white/[0.03]"
                    }`}>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-[15px] font-black">
                          {p.name}
                          {isPro && <span className="rounded-full bg-gradient-to-r from-pink-500 to-cyan-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">Recomendado</span>}
                        </p>
                        <p className="mt-0.5 text-[12px] text-white/55">{p.monthlyCredits} créditos/mes · AdChat IA incluido</p>
                      </div>
                      <button
                        onClick={() => startCheckout(p.slug, "subscription")}
                        disabled={busy === p.slug}
                        className={`flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-black disabled:opacity-60 ${
                          isPro
                            ? "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 text-white shadow-lg shadow-purple-500/30 hover:brightness-110"
                            : "bg-white text-black hover:bg-white/90"
                        }`}
                      >
                        {busy === p.slug ? "…" : `$${Number(p.price).toFixed(2)}/mes`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Paquetes (compra única) */}
          {packages.length > 0 && (
            <section>
              <h3 className="text-[15px] font-black">Recargas de créditos</h3>
              <p className="text-[12px] text-white/40">Pago único · se suman a tu balance actual</p>
              <div className="mt-2 space-y-2">
                {packages.map((p) => {
                  const perCredit = p.credits > 0 ? (Number(p.price) / Number(p.credits)) : 0;
                  return (
                    <div key={p.slug} className="flex items-center justify-between gap-3 rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-600/8 via-pink-500/4 to-cyan-500/8 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-black">{p.credits} créditos</p>
                        <p className="mt-0.5 text-[11px] text-white/50">
                          {perCredit > 0 ? `≈ $${perCredit.toFixed(3)}/crédito` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => startCheckout(p.slug, "package")}
                        disabled={busy === p.slug}
                        className="flex-shrink-0 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 px-4 py-2 text-[13px] font-black text-white shadow-lg hover:brightness-110 disabled:opacity-60"
                      >
                        {busy === p.slug ? "…" : `$${Number(p.price).toFixed(2)}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <p className="text-center text-[10px] text-white/30">
            Los créditos se acreditan automáticamente al confirmarse el pago en Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}
