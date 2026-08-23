# Documento 9 — Estimación de costes

Precios consultados el 2026-08-23 directamente en la documentación oficial
de Google Maps Platform y en la tabla de precios de modelos Claude vigente
en esta sesión. Son precios de lista (tier base, 0-100k peticiones/mes);
Google aplica descuentos por volumen a partir de 100k que no son relevantes
para el POC.

## Precios base usados

**Google Maps Platform:**

| SKU | Precio / 1.000 | Free tier mensual |
|---|---:|---:|
| Places Text Search / Nearby Search (Pro) | $32,00 | 5.000 |
| Place Details — Enterprise + Atmosphere (rating, reviews, horario, web) | $25,00 | 1.000 |

**Routing y geocoding:** $0 — usan el OSRM/Nominatim que el repo ya tiene
integrado (doc. 1), sin necesidad de Google Routes API.

**Overpass API (OSM):** gratis, sujeto a uso justo (doc. 4).

**Claude (extracción de características desde texto libre):**

| Modelo | Input / 1M tok | Output / 1M tok |
|---|---:|---:|
| Claude Haiku 4.5 | $1,00 | $5,00 |
| Claude Sonnet 5 | $3,00 ($2,00 hasta 2026-08-31) | $15,00 ($10,00 hasta 2026-08-31) |

## Fase 0 — POC (20-30 lugares)

Asumiendo 30 lugares, Place Details + descubrimiento puntual (no muestreo de
corredor completo, paso 2 del doc. 8 es manual):

| Partida | Cantidad | Coste |
|---|---:|---:|
| Text Search (1 por lugar, para obtener `place_id`) | 30 | dentro del free tier → **$0** |
| Place Details Enterprise+Atmosphere | 30 | dentro del free tier (1.000) → **$0** |
| Routing (OSRM) + geocoding (Nominatim) | 2 rutas + 2 geocodes | **$0** (sin API de Google) |
| Overpass | ~30 consultas puntuales | **$0** |
| LLM — extracción reseñas+web (Haiku 4.5), ~30 lugares × (~800 tok in, ~150 tok out) | 24.000 tok in / 4.500 tok out | **< $0,05** |

**Total Fase 0: prácticamente $0** — todo cae dentro de las capas gratuitas
mensuales de Google, y el LLM es del orden de céntimos. El coste real de
la Fase 0 es tiempo de desarrollo, no facturación de APIs.

## Fase 1 — Experimento (100-200 lugares)

Asumiendo 200 lugares y descubrimiento por muestreo de corredor (~20 puntos
× 5 categorías = ~100 Text Search para descubrir, luego 200 Place Details):

| Partida | Cantidad | Coste |
|---|---:|---:|
| Text Search (descubrimiento) | 100 | dentro del free tier → **$0** |
| Place Details Enterprise+Atmosphere | 200 | 1.000 gratis → **$0** |
| Routing (OSRM) + geocoding (Nominatim) | 2 rutas + 2 geocodes | **$0** |
| Overpass | ~20 consultas por bbox | **$0** |
| LLM (Haiku 4.5), 200 lugares × (~800 in, ~150 out) | 160.000 tok in / 30.000 tok out | **≈ $0,31** |

**Total Fase 1: sigue siendo prácticamente gratis** en Google (todo dentro
de capas gratuitas mensuales) y del orden de **30-50 céntimos** en LLM. La
razón: el free tier mensual de Google (1.000-10.000 según SKU) ya cubre
holgadamente un corredor entero.

*Con Sonnet 5 en vez de Haiku 4.5* (por si se prefiere mayor calidad de
extracción sobre texto ambiguo): input 160k tok × $2,00/1M + output 30k tok
× $10,00/1M ≈ **$0,62** — sigue siendo irrelevante a este volumen. La
elección de modelo en el doc. 3 (Haiku) importa a partir de la Fase 2
(escala nacional), no aquí.

## Fase 2 — Proyección a escala (orientativa, spec sección 52)

Solo para dimensionar la decisión "¿cuándo empieza a doler el coste de
Google?" — **no es un compromiso de precisión**, son órdenes de magnitud con
supuestos explícitos:

**Supuesto:** ampliar a las rutas troncales de la sección 52 (Madrid-Valencia,
Barcelona, Sevilla, Málaga, Murcia, Zaragoza, Santander) más "toda España" ≈
del orden de 50.000-100.000 lugares en total (estimación gruesa, no medida).

| Partida | Cantidad estimada | Coste (sin free tier, ya consumido) |
|---|---:|---:|
| Text Search (descubrimiento, corredores solapados deduplicados) | ~5.000 | ~$160 |
| Place Details Enterprise+Atmosphere | 100.000 | ~$2.475 (tras descontar 1.000 gratis) |
| LLM (Haiku 4.5) | 80M tok in / 15M tok out | ~$80 + $75 = **$155** |

**Total orden de magnitud para una carga inicial nacional: ~$2.800-$3.000
de una sola vez**, dominado por Place Details de Google, no por el LLM. Esto
es lo que justifica en el doc. 1 la decisión de **no re-consultar todo el
dataset en cada refresco** — el sistema de antigüedad del doc. 6
(`last_verified_at`) existe específicamente para que los refrescos
periódicos sean parciales (solo lugares con features `CONFIRMED` pero
desactualizadas), no una re-ingesta completa recurrente a este coste.

## Estrategias de minimización de coste (spec sección 43)

Ya incorporadas en el diseño de los docs. 3, 6 y 8, no son trabajo adicional:

1. **No llamar al LLM si ya hay señal estructurada** (doc. 3) — la
   optimización de mayor impacto, porque Place Details/OSM son gratis
   (dentro del free tier) y el LLM es la partida más cara por unidad
   cuando no hace falta.
2. **Filtro de keywords antes de mandar reseñas al LLM** (doc. 3) — evita
   procesar el conjunto de reseñas que casi nunca aportan señal Baby.
3. **Refresco priorizado por antigüedad, no completo** (doc. 6) — evita
   repetir el coste de Fase 2 cada mes.
4. **Deduplicación antes de Place Details** (doc. 7) — no pedir detalles dos
   veces del mismo lugar descubierto por Google y por búsqueda manual.
5. **Modelo económico (Haiku) para extracción de texto corto** (doc. 3) —
   reservar un modelo más caro solo si la Fase 1 demuestra que la calidad de
   extracción de Haiku es insuficiente.

## Coste de la app en sí (Vercel/Supabase) — fuera del alcance del spec pero relevante

No incluido arriba porque no depende de "cuántos lugares" sino de tráfico de
usuarios: Vercel y Supabase ya están provisionados en este proyecto en sus
planes actuales; el volumen de datos de la Fase 0/1 (cientos de filas) es
insignificante frente a los límites de esos planes. Se revisita si el
producto pasa de "cientos" a "cientos de miles" de lugares o usuarios
activos.
