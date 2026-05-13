import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";

// ── Constantes ────────────────────────────────────────────────────────────────
const FORUM_CATEGORIES = [
  "Anuncios con IA","Diseño que convierte","Copywriting",
  "Meta Ads","Errores comunes","Prompts","Resultados y pruebas","Preguntas generales",
];

// ── Mini UI Primitives ────────────────────────────────────────────────────────
function Btn({ children, onClick, variant="primary", disabled=false, small=false, full=false, loading=false, type="button" }) {
  const base = `rounded-2xl font-black transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${full?"w-full":""} ${small?"px-3 py-1.5 text-xs":"px-5 py-3 text-sm"}`;
  const v = variant==="primary" ? "bg-white text-black hover:bg-white/90 active:scale-[0.98]"
    : variant==="danger"  ? "border border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
    : variant==="ghost2"  ? "border border-purple-400/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20"
    : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10";
  return (
    <button type={type} onClick={onClick} disabled={disabled||loading} className={`${base} ${v}`}>
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent border-t-current"/>}
      {children}
    </button>
  );
}

function CategoryBadge({ cat, small=false }) {
  const colors = {
    "Anuncios con IA":"border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
    "Diseño que convierte":"border-purple-400/30 bg-purple-400/10 text-purple-300",
    "Copywriting":"border-pink-400/30 bg-pink-400/10 text-pink-300",
    "Meta Ads":"border-blue-400/30 bg-blue-400/10 text-blue-300",
    "Errores comunes":"border-red-400/30 bg-red-400/10 text-red-300",
    "Prompts":"border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    "Resultados y pruebas":"border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
    "Preguntas generales":"border-white/20 bg-white/5 text-white/50",
    "Estrategia":"border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
    "Diseño":"border-purple-400/30 bg-purple-400/10 text-purple-300",
    "Panda AdLab":"border-pink-400/30 bg-pink-400/10 text-pink-300",
  };
  const c = colors[cat] || "border-white/20 bg-white/5 text-white/50";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-black ${small?"text-[9px]":"text-[10px]"} ${c}`}>
      {cat}
    </span>
  );
}

function Avatar({ name, size=8 }) {
  const initial = (name||"?")[0].toUpperCase();
  const colors = ["from-pink-500 to-cyan-400","from-purple-500 to-pink-400","from-cyan-400 to-blue-500","from-emerald-400 to-cyan-400"];
  const idx = (name||"").charCodeAt(0) % colors.length;
  return (
    <div className={`flex h-${size} w-${size} flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${colors[idx]} text-[10px] font-black text-white`}>
      {initial}
    </div>
  );
}

function RelTime({ ts }) {
  const d = new Date(ts);
  const diff = (Date.now() - d) / 1000;
  const s = diff < 60 ? "ahora"
    : diff < 3600 ? `${Math.floor(diff/60)}m`
    : diff < 86400 ? `${Math.floor(diff/3600)}h`
    : diff < 604800 ? `${Math.floor(diff/86400)}d`
    : d.toLocaleDateString("es-PR",{day:"2-digit",month:"short"});
  return <span className="text-[10px] text-white/30">{s}</span>;
}

function GuestBanner() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center text-sm text-white/50">
      <span className="mr-1">🔒</span>
      Inicia sesión para publicar o comentar en la comunidad.
    </div>
  );
}

// ── FORUM ─────────────────────────────────────────────────────────────────────
function ForumView({ session, isAdmin }) {
  const [posts,       setPosts]      = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [activePost,  setActivePost] = useState(null); // post completo abierto
  const [showCreate,  setShowCreate] = useState(false);
  const [filterCat,   setFilterCat]  = useState("Todas");
  const [commentCounts, setCounts]   = useState({});

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const q = supabase
      .from("community_posts")
      .select("id,title,content,category,user_id,created_at,status")
      .eq("status","active")
      .order("created_at",{ascending:false})
      .limit(100);
    const { data } = await q;
    const rows = data || [];
    setPosts(rows);
    // Cargar conteo de comentarios
    if (rows.length) {
      const ids = rows.map(r=>r.id);
      const { data: cc } = await supabase
        .from("community_comments")
        .select("post_id")
        .in("post_id", ids)
        .eq("status","active");
      const m = {};
      (cc||[]).forEach(r=>{ m[r.post_id]=(m[r.post_id]||0)+1; });
      setCounts(m);
    }
    setLoading(false);
  }, []);

  useEffect(()=>{ loadPosts(); },[loadPosts]);

  const cats = ["Todas",...FORUM_CATEGORIES];
  const filtered = filterCat==="Todas" ? posts : posts.filter(p=>p.category===filterCat);

  if (activePost) {
    return (
      <PostDetail
        post={activePost}
        session={session}
        isAdmin={isAdmin}
        onBack={()=>{ setActivePost(null); loadPosts(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {cats.map(c=>(
            <button key={c} onClick={()=>setFilterCat(c)}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${filterCat===c?"border-white bg-white text-black":"border-white/10 bg-white/5 text-white/50 hover:bg-white/10"}`}>
              {c}
            </button>
          ))}
        </div>
        {session && (
          <Btn small onClick={()=>setShowCreate(true)}>+ Crear publicación</Btn>
        )}
      </div>

      {!session && <GuestBanner/>}

      {showCreate && session && (
        <CreatePostForm
          session={session}
          onClose={()=>setShowCreate(false)}
          onCreated={()=>{ setShowCreate(false); loadPosts(); }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-purple-400"/>
        </div>
      ) : filtered.length===0 ? (
        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-4xl mb-3">💬</p>
          <p className="font-black text-white/70">Aún no hay publicaciones</p>
          <p className="text-xs text-white/30 mt-1">Sé el primero en compartir algo.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(p=>(
            <ForumCard
              key={p.id}
              post={p}
              commentCount={commentCounts[p.id]||0}
              session={session}
              isAdmin={isAdmin}
              onClick={()=>setActivePost(p)}
              onDeleted={()=>loadPosts()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ForumCard({ post, commentCount, session, isAdmin, onClick, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const isOwner = session?.user?.id === post.user_id;
  const excerpt = post.content.length > 150 ? post.content.slice(0,150)+"…" : post.content;
  const authorName = post.author_name || post.user_id?.slice(0,8)+"…";

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar esta publicación?")) return;
    setDeleting(true);
    if (isAdmin) {
      await supabase.from("community_posts").update({status:"deleted"}).eq("id",post.id);
    } else {
      await supabase.from("community_posts").delete().eq("id",post.id);
    }
    onDeleted();
  };

  return (
    <div className="group relative flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl transition hover:border-white/20">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <CategoryBadge cat={post.category}/>
        {(isOwner||isAdmin) && (
          <button onClick={handleDelete} disabled={deleting}
            className="flex-shrink-0 rounded-lg bg-black/40 px-2 py-1 text-[10px] font-black text-red-400/70 opacity-0 transition hover:text-red-300 group-hover:opacity-100">
            {deleting?"…":"✕"}
          </button>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-black leading-snug text-white/90 line-clamp-2">{post.title}</h3>

      {/* Excerpt */}
      <p className="flex-1 text-xs leading-relaxed text-white/45 line-clamp-3">{excerpt}</p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-3">
        <div className="flex items-center gap-1.5">
          <Avatar name={authorName} size={6}/>
          <span className="text-[10px] text-white/40 truncate max-w-[80px]">{authorName}</span>
          <RelTime ts={post.created_at}/>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30">💬 {commentCount}</span>
          <button onClick={onClick}
            className="rounded-xl bg-white/8 px-3 py-1.5 text-[10px] font-black text-white/60 transition hover:bg-white/15 hover:text-white">
            Ver →
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatePostForm({ session, onClose, onCreated }) {
  const [form, setForm] = useState({ title:"", content:"", category:FORUM_CATEGORIES[0] });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) { setErr("Completa título y contenido."); return; }
    setSaving(true);
    const { error } = await supabase.from("community_posts").insert({
      user_id: session.user.id,
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      type: "forum",
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onCreated();
  };

  return (
    <div className="rounded-[24px] border border-purple-400/20 bg-gradient-to-br from-purple-600/10 via-pink-500/5 to-cyan-500/10 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-black">Nueva publicación</h3>
        <button onClick={onClose} className="text-white/30 hover:text-white/70">✕</button>
      </div>
      <div className="space-y-3">
        <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
          placeholder="Escribe el título de tu publicación"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-400/60"/>
        <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}
          className="w-full rounded-2xl border border-white/10 bg-[#0d0f1c] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60">
          {FORUM_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))}
          placeholder="Comparte tu duda, experiencia o idea sobre publicidad con IA"
          rows={5}
          className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-400/60"/>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex gap-2">
          <Btn onClick={handleSubmit} loading={saving} full>Publicar</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </div>
  );
}

function PostDetail({ post, session, isAdmin, onBack }) {
  const [comments, setComments]   = useState([]);
  const [loadingC, setLoadingC]   = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting]     = useState(false);
  const [reported, setReported]   = useState(false);

  const loadComments = useCallback(async () => {
    setLoadingC(true);
    const { data } = await supabase
      .from("community_comments")
      .select("*")
      .eq("post_id", post.id)
      .eq("status","active")
      .order("created_at",{ascending:true});
    setComments(data||[]);
    setLoadingC(false);
  }, [post.id]);

  useEffect(()=>{ loadComments(); },[loadComments]);

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    await supabase.from("community_comments").insert({
      post_id: post.id,
      user_id: session.user.id,
      content: newComment.trim(),
    });
    setNewComment("");
    setPosting(false);
    loadComments();
  };

  const handleDeleteComment = async (cid) => {
    if (!confirm("¿Eliminar comentario?")) return;
    if (isAdmin) {
      await supabase.from("community_comments").update({status:"deleted"}).eq("id",cid);
    } else {
      await supabase.from("community_comments").delete().eq("id",cid);
    }
    loadComments();
  };

  const handleReport = async () => {
    if (!session) return;
    await supabase.from("reported_content").insert({
      user_id: session.user.id, content_type:"forum_post", content_id:post.id, reason:"Reportado por usuario",
    });
    setReported(true);
  };

  const authorName = post.author_name || post.user_id?.slice(0,8)+"…";

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white/80 transition">
        ← Volver al forum
      </button>

      {/* Post */}
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <CategoryBadge cat={post.category}/>
          <RelTime ts={post.created_at}/>
        </div>
        <h2 className="mb-4 text-xl font-black leading-snug sm:text-2xl">{post.title}</h2>
        <div className="flex items-center gap-2 mb-4">
          <Avatar name={authorName} size={7}/>
          <span className="text-xs text-white/50">{authorName}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">{post.content}</p>
        {session && !reported && (
          <button onClick={handleReport} className="mt-4 text-[10px] text-white/20 hover:text-red-400 transition">
            ⚑ Reportar contenido
          </button>
        )}
        {reported && <p className="mt-4 text-[10px] text-white/30">Reporte enviado. Gracias.</p>}
      </div>

      {/* Comments */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-white/60">
          {comments.length} {comments.length===1?"comentario":"comentarios"}
        </h3>

        {loadingC ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-purple-400"/>
          </div>
        ) : comments.length===0 ? (
          <p className="text-xs text-white/30 text-center py-4">Sé el primero en comentar.</p>
        ) : (
          comments.map(c=>(
            <CommentRow
              key={c.id}
              comment={c}
              session={session}
              isAdmin={isAdmin}
              onDelete={()=>handleDeleteComment(c.id)}
            />
          ))
        )}

        {/* New comment */}
        {session ? (
          <div className="flex gap-2 pt-2">
            <Avatar name={session.user.email} size={8}/>
            <div className="flex-1 space-y-2">
              <textarea value={newComment} onChange={e=>setNewComment(e.target.value)}
                placeholder="Escribe tu comentario…"
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-400/60"/>
              <Btn onClick={handleComment} loading={posting} disabled={!newComment.trim()} small>
                Comentar
              </Btn>
            </div>
          </div>
        ) : (
          <GuestBanner/>
        )}
      </div>
    </div>
  );
}

function CommentRow({ comment, session, isAdmin, onDelete }) {
  const isOwner = session?.user?.id === comment.user_id;
  const name = comment.author_name || comment.user_id?.slice(0,8)+"…";
  return (
    <div className="group flex gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3">
      <Avatar name={name} size={7}/>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold text-white/60 truncate">{name}</span>
          <RelTime ts={comment.created_at}/>
        </div>
        <p className="text-xs leading-relaxed text-white/65 whitespace-pre-wrap">{comment.content}</p>
      </div>
      {(isOwner||isAdmin) && (
        <button onClick={onDelete}
          className="flex-shrink-0 rounded-lg px-2 py-1 text-[10px] text-red-400/50 opacity-0 transition hover:text-red-300 group-hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
}

// ── CENTRO EDUCATIVO ──────────────────────────────────────────────────────────
function EduView({ session, isAdmin }) {
  const [posts,      setPosts]    = useState([]);
  const [loading,    setLoading]  = useState(true);
  const [activePost, setActive]   = useState(null);
  const [filterCat,  setFilterCat] = useState("Todas");
  const [showAdminCreate, setAdminCreate] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("educational_posts")
      .select("id,title,slug,excerpt,category,read_time,featured,created_at")
      .eq("published",true)
      .order("featured",{ascending:false})
      .order("created_at",{ascending:false});
    setPosts(data||[]);
    setLoading(false);
  }, []);

  useEffect(()=>{ loadPosts(); },[loadPosts]);

  const allCats = ["Todas",...new Set((posts||[]).map(p=>p.category))];
  const filtered = filterCat==="Todas" ? posts : posts.filter(p=>p.category===filterCat);

  if (activePost) {
    return (
      <EduPostDetail
        postId={activePost}
        session={session}
        isAdmin={isAdmin}
        onBack={()=>{ setActive(null); loadPosts(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter + admin */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {allCats.map(c=>(
            <button key={c} onClick={()=>setFilterCat(c)}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${filterCat===c?"border-white bg-white text-black":"border-white/10 bg-white/5 text-white/50 hover:bg-white/10"}`}>
              {c}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Btn small onClick={()=>setAdminCreate(true)}>+ Nuevo artículo</Btn>
        )}
      </div>

      {isAdmin && showAdminCreate && (
        <AdminEduPostForm
          onClose={()=>setAdminCreate(false)}
          onSaved={()=>{ setAdminCreate(false); loadPosts(); }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-purple-400"/>
        </div>
      ) : (
        <>
          {/* Featured */}
          {filtered.filter(p=>p.featured).length>0 && (
            <section className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-300">⭐ Destacados</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {filtered.filter(p=>p.featured).map(p=>(
                  <EduCard key={p.id} post={p} onClick={()=>setActive(p.id)} featured/>
                ))}
              </div>
            </section>
          )}
          {/* All */}
          <section className="space-y-3">
            {filtered.filter(p=>!p.featured).length>0 && (
              <p className="text-[10px] font-black uppercase tracking-widest text-white/25">Todos los artículos</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.filter(p=>!p.featured).map(p=>(
                <EduCard key={p.id} post={p} onClick={()=>setActive(p.id)}/>
              ))}
            </div>
          </section>
          {filtered.length===0 && (
            <div className="rounded-[24px] border border-dashed border-white/10 p-10 text-center">
              <p className="text-4xl mb-2">📚</p>
              <p className="font-black text-white/50">No hay artículos en esta categoría.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EduCard({ post, onClick, featured=false }) {
  const date = new Date(post.created_at).toLocaleDateString("es-PR",{day:"2-digit",month:"short",year:"numeric"});
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-[24px] border p-5 backdrop-blur-xl transition hover:scale-[1.01] ${
        featured
          ? "border-pink-400/20 bg-gradient-to-br from-pink-600/10 via-purple-500/5 to-cyan-500/10 hover:border-pink-400/35"
          : "border-white/10 bg-white/[0.03] hover:border-white/20"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CategoryBadge cat={post.category}/>
        {featured && <span className="text-[9px] font-black uppercase tracking-widest text-pink-300">⭐ Destacado</span>}
      </div>
      <h3 className="mb-2 text-sm font-black leading-snug sm:text-base line-clamp-3">{post.title}</h3>
      <p className="text-xs leading-relaxed text-white/45 line-clamp-3">{post.excerpt}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[10px] text-white/30">{date}</span>
        <span className="text-[10px] text-white/30">📖 {post.read_time} min</span>
      </div>
    </div>
  );
}

function EduPostDetail({ postId, session, isAdmin, onBack }) {
  const [post,       setPost]     = useState(null);
  const [comments,   setComments] = useState([]);
  const [loading,    setLoading]  = useState(true);
  const [newComment, setNew]      = useState("");
  const [posting,    setPosting]  = useState(false);
  const [saved,      setSaved]    = useState(false);
  const [related,    setRelated]  = useState([]);
  const [editing,    setEditing]  = useState(false);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const { data:p } = await supabase.from("educational_posts").select("*").eq("id",postId).single();
      setPost(p);
      if (p) {
        const { data:c } = await supabase.from("educational_comments").select("*").eq("post_id",postId).eq("status","active").order("created_at",{ascending:true});
        setComments(c||[]);
        // Related
        const { data:r } = await supabase.from("educational_posts")
          .select("id,title,category,read_time")
          .eq("published",true)
          .eq("category",p.category)
          .neq("id",postId)
          .limit(3);
        setRelated(r||[]);
        // Saved?
        if (session) {
          const { data:sv } = await supabase.from("saved_posts").select("id").eq("user_id",session.user.id).eq("post_id",postId).single();
          if (sv) setSaved(true);
        }
      }
      setLoading(false);
    })();
  },[postId, session]);

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    await supabase.from("educational_comments").insert({ post_id:postId, user_id:session.user.id, content:newComment.trim() });
    setNew("");
    setPosting(false);
    const { data:c } = await supabase.from("educational_comments").select("*").eq("post_id",postId).eq("status","active").order("created_at",{ascending:true});
    setComments(c||[]);
  };

  const handleSave = async () => {
    if (!session||saved) return;
    await supabase.from("saved_posts").insert({ user_id:session.user.id, post_id:postId, post_type:"educational" });
    setSaved(true);
  };

  const handleDeleteComment = async (cid) => {
    if (!confirm("¿Eliminar comentario?")) return;
    if (isAdmin) await supabase.from("educational_comments").update({status:"deleted"}).eq("id",cid);
    else await supabase.from("educational_comments").delete().eq("id",cid);
    const { data:c } = await supabase.from("educational_comments").select("*").eq("post_id",postId).eq("status","active").order("created_at",{ascending:true});
    setComments(c||[]);
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-purple-400"/>
    </div>
  );
  if (!post) return <p className="text-center text-white/30 py-8">Artículo no encontrado.</p>;

  if (editing && isAdmin) {
    return (
      <AdminEduPostForm
        post={post}
        onClose={()=>setEditing(false)}
        onSaved={()=>{ setEditing(false); window.location.reload(); }}
      />
    );
  }

  const date = new Date(post.created_at).toLocaleDateString("es-PR",{day:"2-digit",month:"long",year:"numeric"});
  // Render simple markdown (## → h2, ** → bold, newlines)
  const renderContent = (text) => {
    return text.split("\n").map((line,i)=>{
      if (line.startsWith("## ")) return <h2 key={i} className="mt-6 mb-2 text-lg font-black text-white">{line.slice(3)}</h2>;
      if (line.startsWith("### ")) return <h3 key={i} className="mt-4 mb-1 text-base font-black text-white/80">{line.slice(4)}</h3>;
      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-bold text-white/80 mt-2">{line.slice(2,-2)}</p>;
      if (line.startsWith("✅")||line.startsWith("❌")||line.startsWith("1.")||line.startsWith("2.")||line.startsWith("-")) {
        return <p key={i} className="ml-3 text-sm leading-relaxed text-white/60">{line}</p>;
      }
      if (line.trim()==="") return <div key={i} className="h-2"/>;
      return <p key={i} className="text-sm leading-relaxed text-white/65">{line}</p>;
    });
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white/80 transition">
        ← Centro Educativo
      </button>

      {/* Article */}
      <article className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <CategoryBadge cat={post.category}/>
          <span className="text-[10px] text-white/30">{date}</span>
          <span className="text-[10px] text-white/30">📖 {post.read_time} min de lectura</span>
          {post.featured && <span className="text-[9px] font-black uppercase tracking-widest text-pink-300">⭐ Destacado</span>}
        </div>
        <h1 className="mb-3 text-2xl font-black leading-snug sm:text-3xl">{post.title}</h1>
        <p className="mb-6 text-sm leading-relaxed text-white/50 italic">{post.excerpt}</p>
        <div className="space-y-0.5">{renderContent(post.content)}</div>
      </article>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {session && (
          <Btn onClick={handleSave} variant={saved?"ghost2":"ghost"} small>
            {saved?"✓ Guardado":"🔖 Guardar"}
          </Btn>
        )}
        {isAdmin && (
          <>
            <Btn onClick={()=>setEditing(true)} variant="ghost" small>✏️ Editar</Btn>
            <AdminTogglePublish post={post} onToggled={()=>window.location.reload()}/>
            <AdminToggleFeatured post={post} onToggled={()=>window.location.reload()}/>
          </>
        )}
      </div>

      {/* Related */}
      {related.length>0 && (
        <section>
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/30">Artículos relacionados</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {related.map(r=>(
              <button key={r.id} onClick={()=>{ setPost(null); window.dispatchEvent(new CustomEvent("openEduPost",{detail:r.id})); }}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-white/20">
                <p className="text-xs font-bold leading-snug text-white/70 line-clamp-2">{r.title}</p>
                <p className="mt-1 text-[10px] text-white/30">📖 {r.read_time} min</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Comments */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-white/60">{comments.length} {comments.length===1?"comentario":"comentarios"}</h3>
        {comments.map(c=>(
          <CommentRow key={c.id} comment={c} session={session} isAdmin={isAdmin} onDelete={()=>handleDeleteComment(c.id)}/>
        ))}
        {session ? (
          <div className="flex gap-2 pt-2">
            <Avatar name={session.user.email} size={8}/>
            <div className="flex-1 space-y-2">
              <textarea value={newComment} onChange={e=>setNew(e.target.value)} placeholder="Escribe tu comentario…" rows={3}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-400/60"/>
              <Btn onClick={handleComment} loading={posting} disabled={!newComment.trim()} small>Comentar</Btn>
            </div>
          </div>
        ) : <GuestBanner/>}
      </div>
    </div>
  );
}

function AdminTogglePublish({ post, onToggled }) {
  const [loading, setLoading] = useState(false);
  const toggle = async () => {
    setLoading(true);
    await supabase.from("educational_posts").update({published:!post.published}).eq("id",post.id);
    setLoading(false);
    onToggled();
  };
  return <Btn onClick={toggle} variant="ghost" small loading={loading}>{post.published?"⬇ Despublicar":"⬆ Publicar"}</Btn>;
}

function AdminToggleFeatured({ post, onToggled }) {
  const [loading, setLoading] = useState(false);
  const toggle = async () => {
    setLoading(true);
    await supabase.from("educational_posts").update({featured:!post.featured}).eq("id",post.id);
    setLoading(false);
    onToggled();
  };
  return <Btn onClick={toggle} variant="ghost" small loading={loading}>{post.featured?"☆ Quitar destacado":"⭐ Destacar"}</Btn>;
}

function AdminEduPostForm({ post=null, onClose, onSaved }) {
  const [form, setForm] = useState({
    title:     post?.title||"",
    slug:      post?.slug||"",
    excerpt:   post?.excerpt||"",
    content:   post?.content||"",
    category:  post?.category||"Estrategia",
    read_time: post?.read_time||5,
    published: post?.published??true,
    featured:  post?.featured??false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  const genSlug = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

  const handleSubmit = async () => {
    if (!form.title.trim()||!form.content.trim()) { setErr("Título y contenido requeridos."); return; }
    setSaving(true);
    const payload = { ...form, slug: form.slug||genSlug(form.title), updated_at: new Date().toISOString() };
    let error;
    if (post) {
      ({ error } = await supabase.from("educational_posts").update(payload).eq("id",post.id));
    } else {
      ({ error } = await supabase.from("educational_posts").insert(payload));
    }
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };

  const EDU_CATS = ["Estrategia","Diseño","Prompts","Meta Ads","Panda AdLab","Copywriting","General"];

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-black">{post?"Editar artículo":"Nuevo artículo educativo"}</h3>
        <button onClick={onClose} className="text-white/30 hover:text-white/70">✕</button>
      </div>
      <div className="space-y-3">
        {[
          {k:"title",      ph:"Título del artículo"},
          {k:"slug",       ph:"slug-del-articulo (auto si vacío)"},
          {k:"excerpt",    ph:"Resumen corto (1-2 oraciones)"},
        ].map(({k,ph})=>(
          <input key={k} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
            placeholder={ph}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-400/60"/>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}
            className="rounded-2xl border border-white/10 bg-[#0d0f1c] px-4 py-3 text-sm text-white outline-none">
            {EDU_CATS.map(c=><option key={c}>{c}</option>)}
          </select>
          <input type="number" value={form.read_time} onChange={e=>setForm(f=>({...f,read_time:+e.target.value}))}
            placeholder="Minutos de lectura"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-400/60"/>
        </div>
        <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))}
          placeholder="Contenido completo del artículo (soporta ## para títulos, ** para negritas)"
          rows={12}
          className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-cyan-400/60 font-mono"/>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
            <input type="checkbox" checked={form.published} onChange={e=>setForm(f=>({...f,published:e.target.checked}))} className="accent-cyan-400"/>
            Publicado
          </label>
          <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
            <input type="checkbox" checked={form.featured} onChange={e=>setForm(f=>({...f,featured:e.target.checked}))} className="accent-pink-400"/>
            Destacado
          </label>
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex gap-2">
          <Btn onClick={handleSubmit} loading={saving} full>{post?"Guardar cambios":"Publicar artículo"}</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMMUNITY VIEW ───────────────────────────────────────────────────────
export default function CommunityView({ session, isAdmin }) {
  const [tab, setTab] = useState("forum");

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-6 sm:max-w-2xl lg:max-w-none">
      {/* Hero */}
      <section className="rounded-[24px] border border-purple-400/20 bg-gradient-to-br from-purple-600/10 via-pink-500/5 to-cyan-500/10 p-5 backdrop-blur-xl sm:rounded-[32px] sm:p-7">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-purple-300/30 bg-purple-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-purple-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400"/>
          Comunidad
        </div>
        <h2 className="text-2xl font-black leading-tight sm:text-3xl">Comunidad Panda AdLab</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          Aprende, comparte y mejora tus anuncios con inteligencia artificial aplicada al mercadeo real.
        </p>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {[
          { id:"forum",   label:"💬 Forum" },
          { id:"edu",     label:"📚 Centro Educativo" },
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-black transition ${tab===t.id?"bg-white text-black shadow":"text-white/50 hover:text-white/80"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab==="forum" && <ForumView session={session} isAdmin={isAdmin}/>}
      {tab==="edu"   && <EduView   session={session} isAdmin={isAdmin}/>}
    </div>
  );
}
