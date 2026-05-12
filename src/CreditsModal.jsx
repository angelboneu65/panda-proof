import React, { useState, useEffect } from "react";
import { authedFetch, apiPostJSON } from "./api";

// Modal que aparece cuando un endpoint devuelve 402 (créditos insuficientes).
// También se puede abrir manualmente desde el botón "Comprar créditos" en el sidebar.
export default function CreditsModal({ open, info, onClose }) {
  const [plans, setPlans]       = useState([]);
  const [packages, setPackages] = useState([]);
  const [busy, setBusy]         = useState(null); // slug en checkout
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await authedFetch("/api/plans");
        if (res.ok) {
          const data = await res.json();
          setPlans(data.plans || []);
          setPackages(data.packages || []);
        }
      } catch (e) { /* ignore */ }
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
              Esta acción requiere {info.required || "más"} créditos. Tienes <strong>{info.credits_balance ?? 0}</strong> créditos y <strong>{info.rounds_balance ?? 0}</strong> rondas. Puedes comprar una recarga o subir tu plan.
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">⚠️ {error}</div>
          )}

          {/* Planes (suscripción) */}
          {plans.length > 0 && (
            <section>
              <h3 className="text-[15px] font-black">Planes</h3>
              <p className="text-[12px] text-white/40">Suscripción mensual — créditos + rondas todos los meses</p>
              <div className="mt-2 space-y-2">
                {plans.filter((p) => p.slug !== "free").map((p) => (
                  <div key={p.slug} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div>
                      <p className="text-[15px] font-black">{p.name}</p>
                      <p className="text-[12px] text-white/55">{p.monthly_credits} créditos · {p.image_rounds} rondas · {p.analysis_limit} análisis / mes</p>
                    </div>
                    <button
                      onClick={() => startCheckout(p.slug, "subscription")}
                      disabled={busy === p.slug}
                      className="flex-shrink-0 rounded-full bg-white px-4 py-2 text-[13px] font-black text-black hover:bg-white/90 disabled:opacity-60"
                    >
                      {busy === p.slug ? "…" : `$${Number(p.price).toFixed(2)}/mes`}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Paquetes (compra única) */}
          {packages.length > 0 && (
            <section>
              <h3 className="text-[15px] font-black">Recargas únicas</h3>
              <p className="text-[12px] text-white/40">Pago único — no renovable</p>
              <div className="mt-2 space-y-2">
                {packages.map((p) => (
                  <div key={p.slug} className="flex items-center justify-between gap-3 rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-600/10 via-pink-500/5 to-cyan-500/10 p-3">
                    <div>
                      <p className="text-[14px] font-black">{p.name}</p>
                      <p className="text-[11px] text-white/55">
                        {p.credits > 0 ? `+${p.credits} créditos` : ""}
                        {p.credits > 0 && p.image_rounds > 0 ? " · " : ""}
                        {p.image_rounds > 0 ? `+${p.image_rounds} rondas (5 imgs c/u)` : ""}
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
                ))}
              </div>
            </section>
          )}

          <p className="text-center text-[10px] text-white/30">
            Los créditos se asignan después de que Stripe confirma el pago.
          </p>
        </div>
      </div>
    </div>
  );
}
