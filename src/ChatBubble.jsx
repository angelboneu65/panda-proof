import React, { useState, useEffect, useRef, useCallback } from "react";
import { BRAND } from "./brand";
import { supabaseEnabled, listResults, listAnalyses, rowToAnalysis } from "./supabase";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const STORAGE_KEY = "panda-adlab-chat-history";

// País del usuario desde el navegador (ej: "es-PR" → "PR")
function detectCountry() {
  try {
    const lang = navigator.language || (navigator.languages && navigator.languages[0]) || "";
    const parts = lang.split("-");
    return { country: (parts[1] || "").toUpperCase() || null, locale: lang || null };
  } catch (e) {
    return { country: null, locale: null };
  }
}

// Extrae [QUICK_REPLIES: A | B | C] del mensaje del asistente.
// Devuelve { content (sin tag), replies (array) }
function parseQuickReplies(text) {
  if (!text) return { content: "", replies: [] };
  const m = text.match(/\[QUICK_REPLIES:\s*([^\]]+)\]/i);
  if (!m) return { content: text, replies: [] };
  const replies = m[1].split("|").map((s) => s.trim()).filter(Boolean);
  const content = text.replace(m[0], "").trim();
  return { content, replies };
}

// Extrae bloques de código (```...```) y los marca para render especial con botón "copiar"
// Devuelve un array de segmentos: { type: "text" | "code", value: string }
function parseSegments(text) {
  if (!text) return [];
  const segments = [];
  const regex = /```([\s\S]*?)```/g;
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ type: "text", value: text.slice(lastIdx, match.index) });
    }
    segments.push({ type: "code", value: match[1].replace(/^\n/, "").replace(/\n$/, "") });
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    segments.push({ type: "text", value: text.slice(lastIdx) });
  }
  return segments.filter((s) => s.value.trim().length > 0);
}

function CodeBlock({ value }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) { /* ignore */ }
  };
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/15 bg-black/35">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Copy listo para pegar</span>
        <button
          onClick={handleCopy}
          className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-black text-white/80 transition hover:bg-white/20"
        >
          {copied ? "✓ Copiado" : "📋 Copiar"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words px-3 py-2.5 text-[13px] leading-relaxed text-white/90 font-sans">{value}</pre>
    </div>
  );
}

export default function ChatBubble() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState(null);

  // Imagen adjunta (para copy)
  const [pendingImage, setPendingImage] = useState(null); // { dataUrl, name, sizeKB }

  // Contexto del usuario (savedResults + país)
  const [userContext, setUserContext] = useState({ country: null, locale: null, savedResults: [], recentAnalyses: [] });

  const scrollRef = useRef(null);
  const inputRef  = useRef(null);
  const imageRef  = useRef(null);

  // ── Carga conversación previa de la sesión ─────────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch (e) { /* ignore */ }
  }, []);

  // Persist messages
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) { /* ignore */ }
  }, [messages]);

  // ── Saludo inicial cuando se abre por primera vez ──────────────────────────
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `¡Hola! 🐼 Soy **AdChat IA** — incluido en tu plan, sin consumir créditos.\n\nPuedo ayudarte con:\n• Cómo usar la app y mejorar tu Panda Score\n• Estrategia de Meta Ads, métricas (CTR, CPM, ROAS) y formatos\n• Escribirte **copys** profesionales — sube una foto con 📎 o pídeme uno de tus resultados guardados\n\nPregúntame lo que necesites.`,
      }]);
    }
  }, [open, messages.length]);

  // ── Cargar contexto del usuario al abrir (país + saved results + análisis) ──
  useEffect(() => {
    if (!open) return;

    const { country, locale } = detectCountry();

    (async () => {
      let savedResults = [], recentAnalyses = [];
      if (supabaseEnabled) {
        try {
          const [results, analyses] = await Promise.all([listResults(), listAnalyses()]);
          savedResults = (results || []).slice(0, 8).map((r) => ({
            id:         r.id,
            title:      r.title,
            created_at: r.created_at,
          }));
          recentAnalyses = (analyses || []).slice(0, 5).map((row) => {
            const a = rowToAnalysis(row);
            return {
              businessType: a.contextUsed?.businessType,
              product:      a.contextUsed?.whatIsBeingSold,
              pandaScore:   a.pandaScore,
            };
          });
        } catch (e) { /* ignore */ }
      }
      setUserContext({ country, locale, savedResults, recentAnalyses });
    })();
  }, [open]);

  // ── Auto-scroll cuando llegan mensajes ─────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Focus en input al abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  // ESC para cerrar
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ── Auto-resize del textarea ───────────────────────────────────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };

  // ── Adjuntar imagen ────────────────────────────────────────────────────────
  const handleImagePick = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Solo se aceptan imágenes (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen pesa más de 5 MB. Súbela más liviana.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setPendingImage({
        dataUrl: e.target.result,
        name:    file.name || "imagen.jpg",
        sizeKB:  Math.round(file.size / 1024),
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // ── Enviar mensaje (opcionalmente con override desde chips) ────────────────
  const sendInternal = useCallback(async ({ overrideContent = null } = {}) => {
    if (sending) return;

    const textRaw = overrideContent !== null ? overrideContent : input.trim();
    if (!textRaw && !pendingImage) return;
    if (textRaw.length > 1500) return;

    const displayContent = textRaw || (pendingImage ? "📷 Imagen adjunta" : "");
    const userMsg = {
      role:    "user",
      content: textRaw || "Aquí está la imagen para que generes el copy.",
      _localImage: pendingImage?.dataUrl || null,
      _displayContent: displayContent,
    };

    const next = [...messages, userMsg];
    setMessages(next);
    if (overrideContent === null) setInput("");
    const imageToSend = pendingImage?.dataUrl || null;
    setPendingImage(null);
    setError(null);
    setSending(true);

    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          image:    imageToSend,
          context:  userContext,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "No pude responder");

      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, pendingImage, userContext]);

  const handleSend     = useCallback(() => sendInternal(), [sendInternal]);
  const handleChipTap  = (option) => sendInternal({ overrideContent: option });

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  // ── Render del mensaje (markdown muy simple: **bold**, listas) ─────────────
  const renderContent = (text) => {
    // Bold inline + saltos de línea + bullets básicos
    const escaped = text
      .split("\n")
      .map((line) => {
        // simple markdown bold
        const bolded = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        return bolded;
      })
      .join("<br/>");
    return <span dangerouslySetInnerHTML={{ __html: escaped }} />;
  };

  return (
    <>
      {/* ── BURBUJA FLOTANTE ─────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir chat con asistente"
        className={`fixed z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-2xl transition-transform duration-200 hover:scale-105 active:scale-95 sm:h-16 sm:w-16 ${
          open ? "pointer-events-none scale-0 opacity-0" : "scale-100 opacity-100"
        }`}
        style={{
          right: "calc(env(safe-area-inset-right, 0px) + 16px)",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          boxShadow:
            "0 0 0 1px rgba(168, 85, 247, 0.35), 0 12px 36px -8px rgba(168, 85, 247, 0.55), 0 0 60px rgba(236, 72, 153, 0.25)",
        }}
      >
        <img
          src={BRAND.logo}
          alt={BRAND.appName}
          className="h-full w-full rounded-full object-contain p-1"
        />
        {/* Indicador online */}
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-[#070812] bg-emerald-500" />
        </span>
      </button>

      {/* ── PANEL DE CHAT ────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-end sm:justify-end sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="flex w-full flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#0d0f22] shadow-2xl sm:max-w-md sm:rounded-[24px]"
            style={{
              height: "85vh",
              maxHeight: "calc(100vh - env(safe-area-inset-top, 0px) - 24px)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-br from-purple-600/15 via-pink-500/5 to-cyan-500/15 p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={BRAND.logo}
                  alt=""
                  className="h-10 w-10 flex-shrink-0 rounded-xl bg-white object-contain p-0.5 shadow"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">AdChat IA</p>
                  <p className="flex items-center gap-1 text-[10px] text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Incluido en tu plan · sin consumir créditos
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                {messages.length > 1 && (
                  <button
                    onClick={clearChat}
                    title="Limpiar conversación"
                    className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/50 transition hover:bg-white/10 hover:text-white/80"
                  >Limpiar</button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20"
                >✕</button>
              </div>
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => {
                const isUser = m.role === "user";
                const lastAssistantIdx = (() => {
                  for (let k = messages.length - 1; k >= 0; k--) {
                    if (messages[k].role === "assistant") return k;
                  }
                  return -1;
                })();
                const isLastAssistant = !isUser && i === lastAssistantIdx;

                // Para el asistente: extrae quick-replies + bloques de código
                const assistantText = isUser ? null : m.content;
                const { content: cleanText, replies } = isUser
                  ? { content: m._displayContent ?? m.content, replies: [] }
                  : parseQuickReplies(assistantText);
                const segments = isUser ? null : parseSegments(cleanText);

                return (
                  <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <img
                        src={BRAND.logo}
                        alt=""
                        className="mr-2 h-7 w-7 flex-shrink-0 rounded-lg bg-white object-contain p-0.5"
                      />
                    )}
                    <div className="flex max-w-[88%] flex-col gap-2">
                      {/* Imagen del usuario en el bubble */}
                      {isUser && m._localImage && (
                        <img
                          src={m._localImage}
                          alt=""
                          className="max-h-48 self-end rounded-2xl border border-white/15 object-contain"
                        />
                      )}

                      {/* Burbuja del usuario */}
                      {isUser && (m._displayContent ?? m.content) && (
                        <div className="self-end rounded-2xl bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-black">
                          {renderContent(m._displayContent ?? m.content)}
                        </div>
                      )}

                      {/* Burbuja del asistente: render por segmentos */}
                      {!isUser && segments?.length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white/90">
                          {segments.map((s, j) => (
                            s.type === "code"
                              ? <CodeBlock key={j} value={s.value} />
                              : <span key={j} className="block">{renderContent(s.value)}</span>
                          ))}
                        </div>
                      )}

                      {/* Chips de quick-replies (solo en el último mensaje del asistente) */}
                      {!isUser && isLastAssistant && replies.length > 0 && !sending && (
                        <div className="flex flex-wrap gap-2">
                          {replies.map((opt, j) => (
                            <button
                              key={j}
                              onClick={() => handleChipTap(opt)}
                              className="rounded-full border border-purple-400/30 bg-gradient-to-r from-purple-500/15 to-pink-500/10 px-3 py-1.5 text-[12px] font-black text-purple-100 transition hover:border-purple-400/60 hover:from-purple-500/25 hover:to-pink-500/20 active:scale-95"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {sending && (
                <div className="flex justify-start">
                  <img src={BRAND.logo} alt="" className="mr-2 h-7 w-7 flex-shrink-0 rounded-lg bg-white object-contain p-0.5" />
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-white/40" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-white/40" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-white/40" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
                  ⚠️ {error}
                </div>
              )}
            </div>

            {/* Input */}
            <div
              className="border-t border-white/10 bg-[#0a0c1a] p-3"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              {/* Preview de imagen pendiente */}
              {pendingImage && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-purple-400/30 bg-purple-400/10 p-2">
                  <img src={pendingImage.dataUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg border border-white/10 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-white/80">{pendingImage.name}</p>
                    <p className="text-[10px] text-white/40">{pendingImage.sizeKB} KB · listo para enviar</p>
                  </div>
                  <button
                    onClick={() => setPendingImage(null)}
                    aria-label="Quitar imagen"
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20"
                  >✕</button>
                </div>
              )}

              <div className="flex items-end gap-2">
                {/* Botón adjuntar imagen */}
                <button
                  onClick={() => imageRef.current?.click()}
                  disabled={sending || !!pendingImage}
                  aria-label="Adjuntar imagen para copy"
                  title="Adjuntar imagen para generar copy"
                  className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-30"
                >📎</button>
                <input
                  ref={imageRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => { handleImagePick(e.target.files?.[0]); e.target.value = ""; }}
                />

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={pendingImage ? "Añade contexto opcional o envía tal cual…" : "Escribe tu pregunta…"}
                  rows={1}
                  maxLength={1500}
                  disabled={sending}
                  className="flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-[14px] text-white placeholder-white/30 outline-none transition focus:border-purple-400/60"
                  style={{ minHeight: "42px", maxHeight: "120px" }}
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !pendingImage) || sending}
                  aria-label="Enviar"
                  className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 text-lg font-black text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:brightness-100"
                >↑</button>
              </div>
              <p className="mt-2 text-center text-[10px] leading-snug text-white/25">
                Adjunta una foto con 📎 para que te escriba un copy. Sin generación de imágenes.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
