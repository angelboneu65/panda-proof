-- ═══════════════════════════════════════════════════════════════════════════
-- Panda AdLab — Comunidad (Forum + Centro Educativo)
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── community_posts ───────────────────────────────────────────────────────
create table if not exists public.community_posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  title        text not null,
  content      text not null,
  category     text not null,
  type         text not null default 'forum' check (type in ('forum')),
  status       text not null default 'active' check (status in ('active','hidden','deleted')),
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);
create index if not exists community_posts_user_idx     on public.community_posts(user_id);
create index if not exists community_posts_category_idx on public.community_posts(category);
create index if not exists community_posts_status_idx   on public.community_posts(status);
alter table public.community_posts enable row level security;

drop policy if exists "Community posts public read"   on public.community_posts;
drop policy if exists "Community posts auth insert"   on public.community_posts;
drop policy if exists "Community posts owner update"  on public.community_posts;
drop policy if exists "Community posts owner delete"  on public.community_posts;
drop policy if exists "Community posts admin all"     on public.community_posts;

create policy "Community posts public read" on public.community_posts
  for select using (status = 'active');
create policy "Community posts auth insert" on public.community_posts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Community posts owner update" on public.community_posts
  for update to authenticated using (auth.uid() = user_id);
create policy "Community posts owner delete" on public.community_posts
  for delete to authenticated using (auth.uid() = user_id);
-- Admin via service role handles the rest on server side

-- ── community_comments ────────────────────────────────────────────────────
create table if not exists public.community_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references public.community_posts(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  content    text not null,
  status     text not null default 'active' check (status in ('active','hidden','deleted')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index if not exists community_comments_post_idx on public.community_comments(post_id);
alter table public.community_comments enable row level security;

drop policy if exists "Community comments public read"   on public.community_comments;
drop policy if exists "Community comments auth insert"   on public.community_comments;
drop policy if exists "Community comments owner delete"  on public.community_comments;

create policy "Community comments public read" on public.community_comments
  for select using (status = 'active');
create policy "Community comments auth insert" on public.community_comments
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Community comments owner delete" on public.community_comments
  for delete to authenticated using (auth.uid() = user_id);

-- ── educational_posts ─────────────────────────────────────────────────────
create table if not exists public.educational_posts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  slug        text unique not null,
  excerpt     text not null,
  content     text not null,
  category    text not null,
  read_time   integer not null default 5,
  published   boolean not null default true,
  featured    boolean not null default false,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);
alter table public.educational_posts enable row level security;

drop policy if exists "Edu posts public read" on public.educational_posts;
create policy "Edu posts public read" on public.educational_posts
  for select using (published = true);

-- ── educational_comments ──────────────────────────────────────────────────
create table if not exists public.educational_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references public.educational_posts(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  content    text not null,
  status     text not null default 'active' check (status in ('active','hidden','deleted')),
  created_at timestamptz default now() not null
);
create index if not exists edu_comments_post_idx on public.educational_comments(post_id);
alter table public.educational_comments enable row level security;

drop policy if exists "Edu comments public read"  on public.educational_comments;
drop policy if exists "Edu comments auth insert"  on public.educational_comments;
drop policy if exists "Edu comments owner delete" on public.educational_comments;

create policy "Edu comments public read" on public.educational_comments
  for select using (status = 'active');
create policy "Edu comments auth insert" on public.educational_comments
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Edu comments owner delete" on public.educational_comments
  for delete to authenticated using (auth.uid() = user_id);

-- ── saved_posts ───────────────────────────────────────────────────────────
create table if not exists public.saved_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  post_id    uuid not null,
  post_type  text not null check (post_type in ('forum','educational')),
  created_at timestamptz default now() not null,
  unique(user_id, post_id)
);
alter table public.saved_posts enable row level security;

drop policy if exists "Saved posts own" on public.saved_posts;
create policy "Saved posts own" on public.saved_posts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── reported_content ──────────────────────────────────────────────────────
create table if not exists public.reported_content (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  content_type text not null,
  content_id   uuid not null,
  reason       text not null,
  status       text not null default 'pending',
  created_at   timestamptz default now() not null
);
alter table public.reported_content enable row level security;
drop policy if exists "Reports auth insert" on public.reported_content;
create policy "Reports auth insert" on public.reported_content
  for insert to authenticated with check (auth.uid() = user_id);

-- ── Función: contar comentarios por post ──────────────────────────────────
create or replace function public.get_community_post_comment_counts(post_ids uuid[])
returns table(post_id uuid, count bigint)
language sql stable security definer as $$
  select post_id, count(*) as count
  from public.community_comments
  where post_id = any(post_ids) and status = 'active'
  group by post_id;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- POSTS EDUCATIVOS INICIALES (10 artículos)
-- ════════════════════════════════════════════════════════════════════════════
insert into public.educational_posts (title, slug, excerpt, content, category, read_time, published, featured) values

('Usar IA no significa dejar de pensar: por qué tus anuncios todavía necesitan estrategia',
 'ia-no-reemplaza-estrategia',
 'La IA puede crear diseños, copies e ideas, pero no reemplaza tu estrategia. Un anuncio bonito no necesariamente vende.',
 E'## La IA es una herramienta, no una estrategia\n\nCada semana más negocios empiezan a usar inteligencia artificial para crear sus anuncios. Generan imágenes en segundos, copys en minutos y artes que se ven increíbles. Pero hay un problema: muchos de esos anuncios no venden.\n\n¿Por qué? Porque una cosa es crear un anuncio que se ve bien, y otra muy distinta es crear un anuncio que convierte.\n\n## Lo que la IA no puede hacer por ti\n\nLa IA no conoce a tu cliente. No sabe qué problema tiene tu público específico, qué palabras usan para describir su dolor, qué los frena para comprar o qué los motiva a actuar ahora.\n\nEso solo lo sabes tú.\n\n## Lo que necesita cualquier anuncio efectivo\n\nAntes de pedirle nada a la IA, tienes que tener claro:\n\n**¿A quién le estás hablando?** No "todo el mundo". Tu cliente ideal tiene edad, problema, deseo, miedo y vocabulario específico.\n\n**¿Qué problema resuelves?** No el servicio que ofreces, sino el resultado que produce.\n\n**¿Cuál es tu oferta?** Precio, beneficio, urgencia, garantía.\n\n**¿Qué quieres que hagan?** Llamar, escribir, comprar, visitar. Un solo CTA por anuncio.\n\n**¿Dónde se va a ver?** Instagram, Facebook, WhatsApp, señalética. Cada plataforma tiene su formato y comportamiento.\n\n## Cómo usar la IA con estrategia\n\n1. Define tu estrategia primero (audiencia, oferta, objetivo, CTA)\n2. Usa la IA para generar opciones visuales y de copy\n3. Evalúa cada opción contra tu estrategia\n4. Optimiza con datos reales cuando empieces a pautar\n\nLa IA acelera el proceso. La estrategia lo dirige. Necesitas las dos.',
 'Estrategia', 6, true, true),

('Cuando un diseño se ve bonito pero no convierte',
 'diseno-bonito-no-convierte',
 'Errores comunes de diseño que hacen que tus anuncios se vean bien pero no generen ventas.',
 E'## El problema del anuncio "Instagram-worthy" que no vende\n\nMuchos diseñadores y emprendedores caen en la trampa del anuncio bonito. Se ve increíble en el feed, recibe likes y comentarios... pero no genera clientes.\n\nEso no es un éxito. Es un gasto.\n\n## Los errores más comunes que matan la conversión\n\n**1. Demasiado texto**\nLos usuarios de redes sociales escanean, no leen. Si tu anuncio parece un párrafo de contrato, lo van a ignorar. Regla básica: si tienes que leerlo para entenderlo, está mal.\n\n**2. Jerarquía visual débil**\nEl ojo del usuario necesita saber qué ver primero. Si todo tiene el mismo tamaño y peso visual, nada destaca. Titular → beneficio → CTA. En ese orden.\n\n**3. CTA escondido o ausente**\nSi alguien interesado ve tu anuncio y no sabe qué hacer después, perdiste el cliente. El CTA debe ser visible, claro y directo: "Llámanos", "Reserva hoy", "Pide tu cita".\n\n**4. Imágenes genéricas de stock**\nLas fotos de banco que todo el mundo usa no generan confianza. El cliente siente que no es un negocio real. Usa fotos tuyas, de tu producto real o de tu equipo.\n\n**5. Poco contraste**\nTexto blanco sobre fondo claro, o texto oscuro sobre fondo oscuro. Si hay que esforzarse para leer, el usuario pasa de largo.\n\n**6. Beneficio ausente**\nTu anuncio dice qué vendes, pero no por qué importa. "Manicure profesional" no convierte. "Uñas perfectas en 45 minutos, sin cita" sí.\n\n**7. El diseño no guía la mirada**\nUn buen anuncio tiene una ruta visual. El ojo sigue el diseño hacia el CTA. Si hay elementos en todos lados sin orden, el cerebro abandona.\n\n## Cómo corregirlo\n\nAntes de publicar cualquier anuncio, hazte estas preguntas:\n- ¿Se entiende en 3 segundos?\n- ¿El beneficio está visible?\n- ¿El CTA se ve a primera vista?\n- ¿Funciona en pantalla de celular?',
 'Diseño', 5, true, true),

('Delegar todo a la IA puede hacerte perder dinero',
 'delegar-todo-a-ia-riesgo',
 'Usar IA sin dirección puede producir anuncios genéricos que consumen tu presupuesto sin resultados.',
 E'## El error de "generar y publicar"\n\nCon el auge de herramientas de IA, muchos negocios están cayendo en una trampa peligrosa: generan anuncios rápido, los publican sin revisarlos bien y esperan resultados.\n\nEl problema no es la velocidad. El problema es la falta de dirección.\n\n## Qué pasa cuando delegas todo a la IA\n\n**Mensajes genéricos que no conectan**\nLa IA no conoce a tu cliente local, tu barrio, tu comunidad o tu competencia. Sin esa información, genera mensajes que podrían ser de cualquier negocio en cualquier parte del mundo.\n\n**Anuncios que no representan tu marca**\nSi tus anuncios generados con IA se ven diferentes a tu negocio real, el cliente se confunde. La confianza se construye con consistencia visual y de mensaje.\n\n**Presupuesto quemado en tráfico incorrecto**\nUn anuncio mal planteado puede atraer clics de personas que nunca van a comprar. Estás pagando por atención que no convierte.\n\n**Ofertas confusas o mal comunicadas**\nLa IA puede redactar un texto que suena bien pero que no explica claramente qué vendes, a qué precio y por qué vale la pena.\n\n## La solución: dirección humana + ejecución con IA\n\n1. **Tú defines**: público, oferta, beneficio, CTA, tono\n2. **La IA ejecuta**: variaciones de diseño, copy, formatos\n3. **Tú validas**: ¿representa mi marca? ¿conecta con mi cliente? ¿es claro?\n4. **La IA optimiza**: con tus correcciones y retroalimentación\n\nLa IA ahorra tiempo. Pero el tiempo ahorrado debe usarse en pensar mejor, no en publicar más rápido sin estrategia.',
 'Estrategia', 4, true, false),

('La IA te ahorra tiempo, pero solo si sabes pedirle bien',
 'prompts-efectivos-para-ia',
 'La calidad de lo que produce la IA depende directamente de la calidad de lo que le pides.',
 E'## El prompt es tu brief creativo\n\nCuando trabajas con un diseñador o copywriter, les das un brief: qué necesitas, para quién, con qué objetivo, en qué tono. La IA no es diferente.\n\nLa calidad del resultado depende directamente de la calidad del input.\n\n## Qué debe incluir un buen prompt para anuncios\n\n**Objetivo del anuncio**\n¿Quieres que llamen? ¿Que visiten? ¿Que compren en línea? ¿Que guarden para después?\n\n**Público objetivo**\n¿Mujeres de 28-45 años en Puerto Rico? ¿Dueños de pequeños negocios? ¿Mamás que buscan opciones saludables para sus hijos?\n\n**La oferta**\nNo solo el producto. El precio, el beneficio, la urgencia. "50% de descuento este fin de semana" es mejor que "buena oferta".\n\n**Plataforma**\nInstagram Stories tiene un formato diferente a un post en feed. Facebook tiene otra dinámica. Define dónde se va a publicar.\n\n**Tono de voz**\n¿Tu marca es divertida y casual? ¿Profesional y seria? ¿Cercana y local? La IA puede adaptar el tono si se lo dices.\n\n**Formato**\n¿Imagen estática? ¿Carrusel? ¿Video? ¿Vertical u horizontal?\n\n**CTA específico**\n"Escribe al inbox", "Reserva tu cita en el link de la bio", "Llama ahora al 787-...".\n\n## Ejemplo de prompt débil vs fuerte\n\n❌ Débil: "Crea un anuncio para mi salón de belleza"\n\n✅ Fuerte: "Crea un anuncio para Instagram Stories de un salón de belleza en Bayamón, Puerto Rico. Oferta: manicure y pedicure por $35 este sábado y domingo. Público: mujeres de 25-50 años. Tono: cercano, amigable. CTA: reserva por WhatsApp. Incluir urgencia de tiempo limitado."\n\nLa diferencia en el resultado es enorme.',
 'Prompts', 5, true, true),

('Por qué tus anuncios generados con IA pueden parecer falsos',
 'anuncios-ia-parecen-falsos',
 'Problemas visuales comunes en anuncios generados con IA y cómo evitar que se vean artificiales.',
 E'## El problema de lo "demasiado perfecto"\n\nLa IA puede generar imágenes visualmente impresionantes. Pero muchas veces esa perfección trabaja en contra del anuncio.\n\nLos consumidores de hoy son sofisticados. Reconocen cuando algo se ve generado por computadora. Y esa percepción afecta la confianza.\n\n## Señales de que tu anuncio generado con IA se ve falso\n\n**Rostros con detalles extraños**\nManos con dedos incorrectos, ojos que no están alineados, sonrisas que no se ven naturales. Los modelos de IA todavía cometen errores en anatomía humana.\n\n**Textos mal integrados**\nLa IA genera imágenes con texto que muchas veces está distorsionado, mal colocado o con errores. Si el texto es parte de la imagen, revísalo siempre antes de publicar.\n\n**Composición rara o irrealista**\nProductos flotando en el aire, fondos que no existen en la realidad, proporciones fuera de lugar. El cliente lo nota aunque no sepa exactamente qué está mal.\n\n**Exceso de efectos visuales**\nBrillo extremo, reflejos artificiales, partículas de luz por todos lados. Cuando todo brilla igual, nada importa.\n\n**Falta de coherencia con la marca**\nSi el estilo visual del anuncio no tiene nada que ver con tu negocio real, crea desconexión. El cliente llega esperando algo y encuentra otra cosa.\n\n## Cómo hacer que tus anuncios de IA se vean auténticos\n\n1. **Combina IA con fotos reales** de tu negocio, producto o equipo\n2. **Añade texto fuera de la imagen**, no dentro de ella\n3. **Usa paleta de colores consistente** con tu marca\n4. **Evita modelos de stock de IA** — usa personas reales cuando sea posible\n5. **Revisa cada detalle** antes de publicar: texto, proporciones, colores\n\nLa autenticidad vende más que la perfección.',
 'Diseño', 5, true, false),

('IA en mercadeo: herramienta, no sustituto de tu negocio',
 'ia-herramienta-no-sustituto',
 'Nadie conoce tu negocio mejor que tú. La IA acelera procesos, pero no puede reemplazar tu conocimiento del cliente real.',
 E'## Tu negocio no es un prompt\n\nHay algo que ninguna IA puede replicar: el conocimiento que tienes de tu propio negocio, tus clientes, tu comunidad y tu mercado local.\n\nEsa es tu ventaja competitiva real.\n\n## Lo que solo tú sabes\n\n- **Quién es tu cliente ideal** y cómo habla\n- **Qué objeciones** tienen antes de comprar\n- **Qué los hizo comprar** en el pasado\n- **Qué dice la competencia** y qué oportunidades existen\n- **Cuál es la personalidad** de tu marca y cómo quieres que te perciban\n- **Qué funciona** en tu mercado local específico\n\n## El rol correcto de la IA\n\nLa IA es como un asistente extremadamente rápido y capaz. Puede:\n\n✅ Generar opciones de diseño en segundos\n✅ Escribir 10 variaciones de copy para que elijas\n✅ Sugerir formatos y estructuras de anuncios\n✅ Analizar qué puede estar fallando en un diseño\n✅ Acelerar la producción de contenido\n\nPero tú eres quien decide cuál usar, cuál descarta y cuál ajusta.\n\n## El proceso correcto\n\n1. **Tú defines** la estrategia y el mensaje central\n2. **La IA genera** opciones rápidas basadas en tu dirección\n3. **Tú validas** si el resultado representa tu marca correctamente\n4. **Juntos optimizan** con datos reales del mercado\n\nEl dueño del negocio que entiende cómo usar la IA estratégicamente tiene una ventaja brutal sobre el que solo genera y publica sin pensar.',
 'Estrategia', 4, true, false),

('El costo oculto de hacer anuncios sin estrategia',
 'costo-oculto-anuncios-sin-estrategia',
 'Un anuncio malo no solo se ve feo. Puede quemar presupuesto, atraer clientes incorrectos y dañar tu imagen de marca.',
 E'## El verdadero costo de un mal anuncio\n\nCuando publicamos un anuncio sin estrategia, pensamos que el peor escenario es que "no funcione". Pero el impacto real es mucho mayor.\n\n## Los costos que nadie calcula\n\n**Presupuesto quemado en clics irrelevantes**\nSi el anuncio no está bien segmentado y el mensaje no es claro, pagarás por clics de personas que nunca iban a comprar. Ese dinero no regresa.\n\n**Tiempo del equipo en leads no calificados**\nResponder mensajes de personas que no son tu cliente ideal consume tiempo que podría dedicarse a cerrar ventas reales.\n\n**Imagen de marca deteriorada**\nUn anuncio mal diseñado o con errores comunica falta de profesionalismo. Muchos clientes potenciales juzgan la calidad de tu servicio por la calidad de tu publicidad.\n\n**Clientes incorrectos que generan conflictos**\nUn anuncio con el mensaje equivocado puede atraer personas con expectativas que no puedes cumplir. Eso genera devoluciones, quejas o malas reseñas.\n\n**Oportunidad de mercado perdida**\nMientras tu anuncio malo consume presupuesto sin convertir, tu competencia bien posicionada captura los clientes que deberían ser tuyos.\n\n## Lo que cuesta hacer las cosas bien\n\nDedicar 30 minutos extra a planificar un anuncio antes de crearlo puede ahorrar semanas de presupuesto mal invertido.\n\nPreguntas clave antes de publicar cualquier anuncio:\n- ¿A quién le estoy hablando exactamente?\n- ¿Qué problema resuelvo?\n- ¿Por qué ahora y no después?\n- ¿Qué quiero que hagan?\n- ¿Está claro el precio o beneficio?\n\nUn buen anuncio no garantiza ventas. Pero un mal anuncio garantiza pérdidas.',
 'Estrategia', 5, true, false),

('Cómo usar IA para crear mejores campañas sin perder autenticidad',
 'ia-campanas-autenticidad',
 'La fórmula para combinar IA con elementos reales que generan confianza y conexión con tu cliente.',
 E'## La autenticidad en la era de la IA\n\nEn un mundo donde la IA puede generar miles de anuncios al día, lo que diferencia a las marcas exitosas es la autenticidad. Los clientes compran a personas y negocios en los que confían.\n\n## Cómo combinar IA y autenticidad\n\n**1. Fotos reales como base**\nUsa fotos de tu negocio, tu producto real o tu equipo como punto de partida. La IA puede mejorarlas, pero la autenticidad viene de lo real.\n\n**2. Testimonios reales de clientes**\nNinguna IA puede fabricar la credibilidad de una reseña genuina. Incluye testimonios reales en tus anuncios — son el activo más poderoso que tienes.\n\n**3. Ofertas claras y honestas**\nLa IA puede ayudarte a comunicar mejor una oferta, pero la oferta debe ser real, específica y cumplible.\n\n**4. Branding consistente**\nDefine colores, tipografía y tono de voz de tu marca. Úsalos en todos los anuncios generados con IA. La consistencia construye reconocimiento y confianza.\n\n**5. Mensajes humanos**\nEvita el lenguaje corporativo o demasiado formal que suena a robot. Habla como hablarías con un cliente frente a ti.\n\n## El proceso que funciona\n\n1. **Fotografía real** → base del anuncio\n2. **IA mejora** la composición, colores y texto\n3. **Tú añades** el beneficio real y el CTA específico\n4. **Revisas** que represente correctamente tu marca\n5. **Publicas** con segmentación correcta\n\nEl resultado: velocidad de la IA + confianza de lo auténtico.',
 'Estrategia', 5, true, false),

('Cinco señales de que tu anuncio necesita ser optimizado antes de pautarlo',
 'cinco-senales-anuncio-optimizar',
 'Antes de invertir presupuesto, revisa estas 5 señales que indican que tu anuncio no está listo.',
 E'## El checklist de los 5 segundos\n\nAntes de darle "publicar" a cualquier anuncio pautado, hazle esta prueba: muéstraselo a alguien que no conoce tu negocio por 5 segundos y pregúntale qué entendió.\n\nSi no puede responder claramente, el anuncio necesita trabajo.\n\n## Las 5 señales de alerta\n\n### 1. No se entiende en 3 segundos\nEn redes sociales, tienes entre 1 y 3 segundos para captar la atención antes de que el usuario haga scroll. Si tu mensaje no es inmediatamente obvio, perdiste esa oportunidad.\n\n**Solución:** Un titular claro, una imagen directa y un beneficio visible sin tener que leer todo el anuncio.\n\n### 2. El precio o beneficio no destaca\nSi alguien tiene que buscar cuánto cuesta o qué gana, el anuncio está mal. El precio o el beneficio principal debe ser uno de los elementos más visibles.\n\n**Solución:** Colócalo en tipografía grande, con contraste, en la parte superior o central del diseño.\n\n### 3. El CTA no se ve\nEl Call to Action es la instrucción que le dices al cliente: qué hacer ahora. Si está en letra pequeña, color similar al fondo o al final de un párrafo largo, no funciona.\n\n**Solución:** Un botón o texto de CTA visible, directo y en contraste con el resto del diseño.\n\n### 4. Hay demasiado texto\nLa regla general: si parece un correo, no es un anuncio. En mobile, el texto abundante se ve aún más intimidante.\n\n**Solución:** Un titular (máx 8 palabras), un beneficio (máx 1 línea) y un CTA. Todo lo demás sobra.\n\n### 5. No parece diseñado para mobile\nMás del 80% de los usuarios de redes sociales ven los anuncios desde su celular. Si el texto se ve pequeño, los elementos están muy juntos o el formato es horizontal en una plataforma vertical, el anuncio pierde efectividad.\n\n**Solución:** Diseña siempre pensando primero en pantalla vertical de celular.\n\n## Antes de publicar, pregúntate\n¿Pasaría este anuncio el checklist de los 5 puntos? Si no, optimízalo antes de invertir presupuesto.',
 'Diseño', 4, true, true),

('Por qué Panda AdLab analiza antes de crear',
 'por-que-panda-analiza-antes-de-crear',
 'El diagnóstico correcto antes de rediseñar es la diferencia entre un anuncio que se ve bien y uno que convierte.',
 E'## Diagnosticar antes de crear\n\nUno de los errores más costosos en publicidad es rediseñar un anuncio sin saber exactamente qué falla. Es como cambiar el motor de un carro sin diagnosticar el problema primero.\n\nPanda AdLab existe para resolver eso.\n\n## El problema de "crear primero"\n\nCuando generamos un nuevo diseño sin analizar el anterior, asumimos que el problema era visual. Pero muchas veces el problema es:\n\n- El mensaje no es claro\n- La oferta no es atractiva\n- El CTA está mal ubicado\n- El público objetivo no está bien definido\n- La jerarquía visual confunde en vez de guiar\n\nCambiar el color de fondo no arregla ninguno de esos problemas.\n\n## Qué analiza Panda AdLab\n\nEl sistema evalúa cada anuncio en 10 criterios clave:\n\n1. **Claridad del mensaje** — ¿Se entiende en 3 segundos?\n2. **Fuerza del CTA** — ¿Es visible y directo?\n3. **Jerarquía visual** — ¿El ojo sabe dónde ir?\n4. **Legibilidad móvil** — ¿Funciona en celular?\n5. **Propuesta de valor** — ¿El beneficio está claro?\n6. **Contraste y legibilidad** — ¿El texto se lee fácil?\n7. **Coherencia de marca** — ¿Representa el negocio?\n8. **Intención de venta** — ¿Está diseñado para convertir?\n9. **Público objetivo** — ¿Habla al cliente correcto?\n10. **Urgencia o razón para actuar** — ¿Por qué ahora?\n\n## El Panda Score\n\nCada uno de estos criterios contribuye al Panda Score, una calificación del 0 al 100 que te dice exactamente qué tan listo está tu anuncio para convertir.\n\nNo es solo una calificación bonita. Es un diagnóstico con recomendaciones específicas y prioridades de mejora.\n\n## Primero analizar, luego crear\n\nCuando Panda AdLab genera una versión optimizada de tu anuncio, no lo hace al azar. Lo hace basado en los problemas específicos encontrados en el análisis.\n\nEso es la diferencia entre un rediseño que se ve diferente y un rediseño que convierte mejor.',
 'Panda AdLab', 6, true, true)

on conflict (slug) do nothing;
