import React, { useState, useEffect, useCallback } from "react";
import { authedFetch, apiPostJSON } from "./api";

export default function AdminPanel() {
  const [users, setUsers]       = useState([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [openTxs, setOpenTxs]   = useState(null); // user_id cuyo historial se está mirando
  const [txs, setTxs]           = useState([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const url = "/api/admin/users" + (search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "");
      const res = await authedFetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const act = async (user_id, action, payload = {}) => {
    setError(null);
    try {
      const res = await apiPostJSON("/api/admin/update-user", { user_id, action, ...payload });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Falló");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const showTxs = async (user_id) => {
    setOpenTxs(user_id); setTxs([]);
    try {
      const res = await authedFetch(`/api/admin/user/${user_id}/transactions`);
      const data = await res.json();
      if (res.ok) setTxs(data.transactions || []);
    } catch (e) { /* ignore */ }
  };

  const prompt = (msg, def = "") => {
    const v = window.prompt(msg, def);
    if (v === null) return null;
    return v;
  };

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-5 sm:max-w-3xl lg:max-w-none">
      <div>
        <h2 className="text-2xl font-black sm:text-3xl">Admin · Usuarios</h2>
        <p className="mt-1 text-[13px] text-white/40">Gestiona créditos, planes y permisos.</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por email…"
          className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
        />
        <button onClick={load} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20">
          Buscar
        </button>
      </div>

      {error && <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">⚠️ {error}</div>}
      {loading && <p className="text-center text-xs text-white/40">Cargando…</p>}

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-black">{u.email}</p>
                <p className="text-[11px] text-white/40">{u.full_name || "—"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                  <span className={`rounded-full border px-2 py-0.5 font-black ${u.role === "admin" ? "border-pink-400/40 bg-pink-400/15 text-pink-200" : "border-white/15 bg-white/5 text-white/60"}`}>{u.role}</span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 font-black text-white/60">plan: {u.plan}</span>
                  {u.is_unlimited && <span className="rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2 py-0.5 font-black text-emerald-200">∞ ilimitado</span>}
                  {u.subscription_status && <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 font-black text-cyan-200">{u.subscription_status}</span>}
                </div>
                <p className="mt-2 text-[12px] text-white/65">
                  💰 <strong>{u.credits_balance}</strong> créditos
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <button onClick={() => { const n = prompt("¿Cuántos créditos añadir? (negativo para quitar)", "100"); if (n !== null) act(u.id, "grant_credits", { amount: parseInt(n, 10), description: "Ajuste admin" }); }}
                      className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 font-black text-white/80 hover:bg-white/10">+/− Créditos</button>
              <button onClick={() => act(u.id, "set_unlimited", { value: !u.is_unlimited })}
                      className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 font-black text-white/80 hover:bg-white/10">
                {u.is_unlimited ? "Quitar ∞" : "Activar ∞"}
              </button>
              <button onClick={() => act(u.id, "set_role", { value: u.role === "admin" ? "user" : "admin" })}
                      className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 font-black text-white/80 hover:bg-white/10">
                {u.role === "admin" ? "Quitar admin" : "Hacer admin"}
              </button>
              <button onClick={() => { const p = prompt("Plan (free, basic, pro, admin):", u.plan); if (p) act(u.id, "set_plan", { value: p.trim() }); }}
                      className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 font-black text-white/80 hover:bg-white/10">Cambiar plan</button>
              <button onClick={() => showTxs(u.id)}
                      className="col-span-2 rounded-xl border border-purple-400/20 bg-purple-400/10 px-2 py-2 font-black text-purple-200 hover:bg-purple-400/20 sm:col-span-2">
                Ver historial
              </button>
            </div>

            {openTxs === u.id && (
              <div className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2 text-[11px]">
                {txs.length === 0 ? <p className="text-white/40">Sin movimientos.</p> : (
                  <ul className="space-y-1.5">
                    {txs.map((t) => (
                      <li key={t.id} className="flex justify-between gap-2 border-b border-white/5 pb-1">
                        <span className="text-white/70">
                          <span className={t.amount > 0 ? "text-emerald-300" : t.amount < 0 ? "text-red-300" : "text-white/50"}>
                            {t.amount > 0 ? "+" : ""}{t.amount}
                          </span>
                          {" "}<span className="text-white/40">[{t.transaction_type}]</span>{" "}
                          {t.description}
                        </span>
                        <span className="flex-shrink-0 text-white/30">{new Date(t.created_at).toLocaleString("es")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
        {!loading && users.length === 0 && (
          <p className="text-center text-xs text-white/40">Sin usuarios.</p>
        )}
      </div>
    </div>
  );
}
