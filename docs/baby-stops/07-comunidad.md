# Documento 7 — Diseño de contribuciones de comunidad

## Flujo de contribución

Todas las contribuciones (spec secciones 26-30) entran por el mismo camino:
una fila en `community_contributions` vía Server Action, autenticado
(`user_id = auth.uid()`, RLS del doc. 2). Cuatro formas de entrada, mismo
destino:

```
Usuario                    Server Action                 Tabla
────────────────────────────────────────────────────────────────────
"Añadir un sitio"     →  createPlaceContribution   →  contribution_type = 'NEW_PLACE'
                                                        place_id = null (aún no existe)
"Confirmar/corregir     →  updateFeatureContribution →  contribution_type = 'FEATURE_UPDATE'
 una característica"                                     o 'CORRECTION', feature_type + value
"Subir una foto"       →  uploadPhotoContribution   →  photos (moderation_status = PENDING)
                                                        + contribution_type = 'PHOTO'
"Comentario libre"     →  commentContribution       →  contribution_type = 'COMMENT'
```

`NEW_PLACE` es especial: crea también la fila en `places` con
`status = 'needs_review'` en el mismo momento (no se puede aportar una
característica de un lugar que no existe), pero la fila de `places` no se
muestra como resultado de búsqueda normal hasta que la contribución pasa de
`PENDING` a `APPROVED`.

## "Quiero añadir este sitio" sin saber el nombre exacto (spec sección 26)

El formulario no exige nombre exacto: usa la ubicación actual (geolocalización
del navegador) + Google Places **Nearby Search inverso** (buscar qué lugar de
Google coincide con esas coordenadas) como sugerencia autocompletable —
si el usuario confirma la sugerencia, se guarda el `google_place_id` y se
enriquece automáticamente vía el pipeline del doc. 3; si no hay coincidencia
o el usuario la descarta, se crea como lugar solo-comunidad (`source =
'COMMUNITY'`, sin `google_place_id` ni `osm_id`).

## Moderación (spec sección 32)

Estados de `community_contributions.status`:

```
PENDING → (IA + reglas) → APPROVED | REJECTED | CONFLICTING | NEEDS_REVIEW
```

**Reglas automáticas (sin LLM) que se aplican primero:**
- Rate limit por usuario (máx. N contribuciones/hora) → spam.
- Coordenadas fuera de rango razonable de España peninsular (con margen para
  Baleares/Canarias) en `NEW_PLACE` → `NEEDS_REVIEW`.
- Duplicado exacto (mismo usuario, mismo lugar, mismo feature, últimas 24h)
  → se descarta silenciosamente (no cuenta como nueva evidencia).

**Clasificación con LLM (solo para `COMMENT` y el campo `comment` libre de
cualquier tipo)**, extracción estructurada con las categorías: `spam`,
`contenido_irrelevante`, `lenguaje_ofensivo`, `ok`. Igual que en el doc. 3,
solo se llama al LLM cuando hay texto libre — un `FEATURE_UPDATE` sin
comentario (solo "Sí/No/No sé") no pasa por IA en absoluto, va directo al
motor de resolución (doc. 6) como evidencia `PENDING → APPROVED` automático
si no dispara ninguna regla.

**Importante (spec, cierre de la sección 32): la IA nunca borra información
válida sin posibilidad de revisión.** El resultado de la clasificación LLM
solo puede mover una contribución a `NEEDS_REVIEW` (revisión humana), nunca
directamente a `REJECTED` — `REJECTED` automático solo ocurre por las reglas
duras (spam por rate limit, coordenadas imposibles), no por juicio del LLM
sobre el contenido.

## Detección de duplicados (spec sección 33)

Al crear un `NEW_PLACE`, antes de insertar se comprueba, en este orden:

1. `google_place_id` o `osm_id` exacto (si el usuario confirmó una
   sugerencia de Places/OSM) → es el mismo lugar, no se crea uno nuevo, se
   añade la contribución al lugar existente.
2. Sin esos IDs: distancia haversine < 50 m **y** similitud de nombre
   (Levenshtein normalizado > 0.6, o coincidencia de token principal
   ignorando sufijos tipo "Centro", "Alicante") → se marca
   `status = 'NEEDS_REVIEW'` con el lugar candidato adjunto, para que un
   moderador decida fusionar o crear.
3. Ninguna coincidencia → se crea como lugar nuevo.

Esto cubre el ejemplo del spec ("Restaurante X" / "Restaurante X Alicante" /
"Restaurante X Centro" como tres lugares distintos) sin necesitar fuzzy
matching costoso a escala completa — el filtro de distancia reduce el
universo de comparación a un puñado de candidatos antes de comparar nombres.

## Reputación (spec sección 29 — deliberadamente simple)

```
reputation_points: contador simple en profiles.

+1   por FEATURE_UPDATE/CORRECTION aprobada
+2   por NEW_PLACE aprobado
+1   por PHOTO aprobada
+3   si una FEATURE_UPDATE tuya es la que resuelve un NEEDS_REVIEW
     (tu evidencia fue la que destrancó una contradicción)

Niveles (derivados, no almacenados — se calculan al leer):
  0-9    → Colaborador
  10-29  → Explorador
  30-99  → Experto Baby Stops
  100+   → Top Contributor
```

Sin multiplicadores, sin caducidad de puntos, sin ranking entre usuarios en
el MVP — el spec pide explícitamente no convertirlo en un sistema complejo
todavía (sección 29).

## Validación comunitaria (spec sección 30)

No es una entidad nueva — es una lectura del propio doc. 6: cuando una
segunda `community_contribution` con el mismo `(place_id, feature_type,
value)` llega, el `confidence_score` sube (más evidencias de la misma fuente,
con rendimientos decrecientes vía raíz cuadrada) y el `status` puede pasar de
`PROBABLE` a `CONFIRMED`. El contador "Confirmado por 8 familias" que pide el
spec es simplemente `count(*) from community_contributions where place_id=..
and feature_type=.. and value=.. and status='APPROVED'`.

## Información temporal / incidencias (spec sección 31)

Se modela como un `contribution_type` con un campo adicional en vez de una
tabla nueva: `FEATURE_UPDATE` con `value` conteniendo el estado temporal
(p.ej. `"temporarily_closed"`) y `comment` con la fecha/detalle. El motor de
resolución (doc. 6) trata esto con **decaimiento acelerado**: una incidencia
temporal reportada hace más de 30 días sin nueva confirmación deja de
aplicarse automáticamente (vuelve al valor base), a diferencia del
decaimiento normal de 6-12 meses — porque una incidencia temporal que nadie
vuelve a mencionar probablemente ya se resolvió.
