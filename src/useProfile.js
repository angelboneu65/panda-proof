import { useState, useEffect, useCallback } from "react";
import { authedFetch } from "./api";

// Hook compartido para perfil + créditos. Se refresca después de cada acción cara.
export function useProfile(session) {
  const [profile, setProfile]               = useState(null);
  const [creditsEnabled, setCreditsEnabled] = useState(true);
  const [loading, setLoading]               = useState(false);

  const refresh = useCallback(async () => {
    if (!session) { setProfile(null); return; }
    setLoading(true);
    try {
      const res = await authedFetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        setCreditsEnabled(data.creditsEnabled !== false);
        setProfile(data.profile || null);
      }
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { refresh(); }, [refresh]);

  return { profile, creditsEnabled, loading, refresh };
}
