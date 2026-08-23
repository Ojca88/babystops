# Documento 4 — Limitaciones legales y técnicas

**Aviso:** esto es un análisis técnico de las políticas públicas de cada
plataforma, no asesoría legal. Antes de operar en producción con datos
reales de usuarios (fotos, reseñas, cuentas), una revisión legal real es
recomendable — en particular para RGPD (España/UE).

## 1. Google Places API (New) — política de caché

Fuente: política de servicios web de Google Places (`developers.google.com`,
consultada 2026-08-23).

**Lo único que se puede guardar indefinidamente es el `place_id`.** Todo lo
demás (nombre, dirección, rating, horario, reseñas, fotos...) está sujeto a
restricciones de caché — no se puede "pre-cargar, cachear o almacenar"
contenido de Places API más allá de las excepciones documentadas por Google.

**Implicación directa para el modelo de datos (doc. 2):**

- `places.google_place_id` puede vivir para siempre — es el identificador
  estable para deduplicar y para volver a pedir datos frescos.
- `places.name`, `places.address`, `places.phone`, `places.website`,
  `places.google_maps_url` — técnicamente estos son "contenido de Places
  API" y **no deberían tratarse como almacenamiento permanente**. La
  mitigación práctica:
  - Marcar cada `place` con `source_last_refreshed_at` (campo a añadir en el
    MVP técnico, doc. 10) y refrescar estos campos desde Google
    periódicamente en vez de asumir que el valor guardado es válido para
    siempre.
  - Para lugares cuya única fuente es Google (sin OSM ni contribución de
    comunidad), tratar el registro como "caché de corta duración" que se
    revalida, no como dato propio.
  - Los lugares con evidencia de OSM y/o comunidad **sí** pueden considerarse
    datos propios de Baby Stops de forma indefinida para esos campos
    concretos (nombre, ubicación) — es exactamente la separación que pide el
    spec en la sección 36 (EXTERNAL DATA vs FIRST PARTY DATA).
- **Rating, número de reseñas y el texto de las reseñas no se guardan como
  "verdad" permanente** — se guarda únicamente la evidencia derivada (p.ej.
  `evidence.raw_value = "cambiador confirmado"` con `source_reference` =
  `google_place_id`), no el texto original de la reseña completo, y con
  fecha de detección para poder invalidar cuando caduque.
- **`highlight`: nunca guardar reviews completas en `evidence.raw_value`
  para mostrarlas tal cual en la UI.** El spec ya lo pide en la sección 9
  ("No mostrar necesariamente el texto completo de la reseña"); aquí además
  es un requisito de política, no solo de producto.

## 2. Atribución (Google)

- **Si se muestra un mapa de Google**: logo/atribución de Google Maps con
  estilo específico (tipografía, tamaño, contraste) — no aplica al MVP
  porque el mapa de la app usa OpenStreetMap (doc. 1), no Google Maps JS.
- **Si se muestran datos de Places sin mapa de Google** (p.ej. "rating: 4.5
  ⭐ Google" en una tarjeta de parada): atribución obligatoria — logo de
  Google Maps o, si no hay espacio, el texto "Google Maps".
- **Fotos y reseñas**: si se llegan a mostrar (no previsto en el MVP —
  doc. 10), requieren atribución del autor (nombre, avatar, enlace a perfil)
  y enlace directo al contenido original en Google Maps. Para localizaciones
  en Francia, fecha de la visita obligatoria (no aplica en el MVP, España).
- **No combinar de forma que confunda el origen**: si se muestra "Fuentes:
  Google, OpenStreetMap, Comunidad" en la tarjeta de evidencias (spec
  sección 11), cada fuente debe quedar identificable — es justo el diseño
  que ya propone el spec, no un añadido.

## 3. OpenStreetMap — ODbL

OSM se distribuye bajo **Open Database License (ODbL)**: reutilización
libre, incluyendo modificación y uso comercial, con dos obligaciones:

- **Atribución**: "© OpenStreetMap contributors" visible donde se muestren
  datos derivados de OSM (footer del mapa, o en la sección de fuentes de
  cada parada).
- **Share-alike sobre la base de datos derivada**: si se publica/redistribuye
  la *base de datos* (no la aplicación) que combina OSM con otras fuentes,
  esa base de datos derivada hereda ODbL. Esto **no** afecta a Baby Stops
  como producto (nadie está redistribuyendo el dump de datos), pero sí es
  relevante si en el futuro se planteara vender/licenciar el dataset a
  terceros — en ese caso, separar en la base de datos qué filas de
  `evidence` proceden de OSM permite aislar qué parte del dataset está sujeta
  a ODbL.

**Overpass API — uso justo (no legal, operativo):** la instancia pública
`overpass-api.de` pide no superar ~10.000 consultas/día ni ~1 GB de descarga
diario, incluir un `User-Agent` identificable, y esperar 30s tras un 429
antes de reintentar. Para el volumen del MVP (doc. 8/9) esto no es un
problema; si el producto escala a toda España (spec sección 52), conviene
pasar a un extracto local (Geofabrik) o una instancia propia en vez de
depender de la API pública.

## 4. Web scraping de sitios oficiales

No hay una ley única — el riesgo real es contractual/técnico, no de "scraping
ilegal per se":

- **Respetar `robots.txt`** de cada dominio antes de hacer fetch.
- **No saltarse medidas anti-bot** (captchas, WAF) — si un sitio las tiene,
  se marca esa fuente como `UNAVAILABLE` para ese lugar y no se insiste.
- **Guardar solo el extracto relevante** (el fragmento de texto que sustenta
  la evidencia), no un dump completo de la web — mismo principio de
  minimización que con las reseñas de Google.
- Esto es contenido del propio negocio sobre sí mismo (su web pública),
  riesgo bajo comparado con reseñas de terceros, pero conviene ofrecer un
  mecanismo de exclusión (`robots.txt` con user-agent específico de Baby
  Stops, o un email de contacto) antes de escalar a miles de dominios.

## 5. RGPD — datos de usuarios de la comunidad

Aplica en cuanto haya cuentas, fotos y contribuciones de usuarios reales
(ya en el MVP, spec secciones 26-30):

- **Base de datos ya usa Supabase Auth** con Google OAuth — el tratamiento de
  credenciales lo gestiona Google/Supabase, pero `profiles.child_age_months`
  es un dato que conviene tratar con cuidado (dato sobre un menor, aunque
  sea indirecto vía el perfil del progenitor) — minimizar a lo estrictamente
  necesario para personalizar recomendaciones (spec sección 15), nunca pedir
  el nombre o datos identificativos del menor.
- **Fotos de comunidad** pueden contener personas identificables (otros
  clientes del local, el propio hijo del usuario) — la moderación (spec
  sección 32) debe incluir un criterio explícito de "no publicar fotos con
  menores reconocibles salvo que sean del propio usuario", y ofrecer
  eliminación a petición de terceros.
- **Derecho de supresión**: al borrar una cuenta, sus `community_contributions`
  y `photos` no pueden simplemente desaparecer (romperían el histórico de
  evidencia agregada), pero sí deben anonimizarse (`user_id` → null o a un
  usuario "eliminado" placeholder) en vez de borrar la fila — es el mismo
  patrón que ya usa `stops.created_by` (`on delete set null`).

## 6. No presentar inferencia como hecho (requisito de producto con base legal)

El spec lo pide como principio de UX (sección 38), pero también reduce
riesgo: afirmar "este restaurante tiene trona" cuando la única evidencia es
una inferencia de IA sobre una reseña ambigua es una afirmación fáctica sobre
un tercero (el negocio) que podría ser falsa. El diseño de estados
(`CONFIRMED` / `PROBABLE` / `UNCONFIRMED` / `UNKNOWN`, doc. 6) existe
precisamente para que la UI nunca tenga que elegir entre "sí" y "no" cuando
la evidencia real es "probablemente sí".

## Resumen — qué implica cada límite en el código

| Límite | Dónde se aplica |
|---|---|
| Solo `place_id` cacheable indefinidamente de Google | `places.google_place_id` es estable; el resto de campos de Google llevan revalidación periódica (doc. 10) |
| Máx. 5 reviews por Place Details | El pipeline de reviews (doc. 3) nunca asume que puede "descargar el histórico" — es una limitación de diseño, no un bug a arreglar |
| No guardar reviews completas | `evidence.raw_value` guarda el extracto/cita, no la reseña íntegra |
| Atribución Google/OSM | Sección "Fuentes" en la tarjeta de parada (spec sección 23) ya cumple esto por diseño |
| ODbL share-alike | Solo relevante si se redistribuye la base de datos a terceros — documentar, no bloquea el MVP |
| RGPD sobre fotos/menores | Política de moderación explícita (doc. 7) antes de abrir subida de fotos en producción |
