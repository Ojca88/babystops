# Documento 3 — Fuentes de información y estrategia de extracción

Principio (spec sección 44): **STRUCTURED DATA FIRST → RULES → NLP/LLM ONLY
WHEN NEEDED.** Cada fuente se procesa en este orden porque cada una siguiente
es más cara y menos fiable que la anterior.

## 1. Descubrimiento de lugares (qué existe)

No se descubre por separado en cada fuente y luego se cruza a ciegas — se
descubre en Google Places (fuente con mejor cobertura y categorización) y se
**enriquece** con OSM/web/reviews sobre esos mismos lugares, deduplicando por
`google_place_id`/`osm_id`/proximidad (doc. 7, sección duplicados).

- **Google Places — Text Search / Nearby Search**, muestreando puntos a lo
  largo del corredor de la ruta (doc. 8) por cada categoría del spec
  (sección 4): `restaurant`, `cafe`, `gas_station`, `rest_area` (vía tipo
  `tourist_attraction`/`park` + heurística, Google no tiene un tipo nativo
  "área de servicio" homologado a España), `supermarket`, `pharmacy`,
  `lodging`, `shopping_mall`.
- **OSM — Overpass**, mismo corredor, tags: `amenity=fuel`,
  `highway=rest_area`, `amenity=restaurant|cafe|fast_food`,
  `leisure=playground`, `tourism=picnic_site`, `shop=supermarket|pharmacy`.
  OSM aporta categorías que Google Places representa mal en España
  (áreas de servicio de autopista, áreas recreativas).

## 2. Atributos estructurados (sin LLM)

### Google Places (Place Details)

Campos que Google ya expone estructurados y que se mapean por regla directa,
sin pasar por IA:

| Campo Google Places | Uso |
|---|---|
| `displayName`, `formattedAddress`, `location` | identidad del lugar |
| `nationalPhoneNumber`, `websiteUri`, `googleMapsUri` | contacto |
| `rating`, `userRatingCount` | señal de calidad general (no Baby) |
| `regularOpeningHours` | horario |
| `priceLevel` | filtro de coste |
| `accessibilityOptions.wheelchairAccessibleEntrance` | → `baby_features.stroller_access` = 'easy' si `true` (proxy razonable: entrada sin escalones sirve igual para silla de ruedas que para carrito) |
| `parkingOptions.freeParkingLot` / `.paidParkingLot` | → `parking`, `free_parking` |
| `outdoorSeating` | → `terrace`, `outdoor_space` |
| `restroom` (boolean, sin detalle) | señal débil de "hay baño"; **no** implica cambiador — no se usa para inferir `changing_table` |

Nada de esto pasa por el LLM: es un `switch`/mapeo directo en
`lib/sources/google-places.ts`, cada mapeo emite una fila de `evidence` con
`source = 'GOOGLE_PLACES'` y `confidence_weight` según doc. 6.

### OpenStreetMap (Overpass)

Tags con mapeo 1:1 a `baby_feature_type` (la razón por la que el spec insiste
en OSM, sección 7):

| Tag OSM | `feature_type` | `value` |
|---|---|---|
| `changing_table=yes/no/limited` | `changing_table` | directo |
| `highchair=yes/no` | `highchair` | directo |
| `kids_area=yes/no` | `indoor_play_area` o `outdoor_play_area` según `kids_area:location` | directo |
| `toilets:wheelchair=yes` | `accessible_restroom` | directo |
| `outdoor_seating=yes` | `terrace` | directo |
| `wheelchair=yes/limited/no` | `stroller_access` | `yes→easy`, `limited→possible`, `no→difficult` |
| `amenity=parking` (nodo/way cercano, <100 m) | `nearby_parking` | `yes` |
| `leisure=playground` (nodo cercano, <500 m) | `nearby_playground` | `yes` |
| `fee=no` + `amenity=parking` | `free_parking` | `yes` |

Igual que con Google: mapeo por regla, sin LLM, en `lib/sources/osm.ts`. Como
avisa el spec, **la ausencia de un tag no es evidencia de "no"** — si el nodo
OSM no tiene `changing_table`, no se genera evidencia (ni positiva ni
negativa) para esa característica en ese lugar. Es la diferencia entre
`UNKNOWN` y `NOT_AVAILABLE`.

## 3. Web oficial — reglas primero, LLM si hace falta

Cuando `websiteUri` existe:

1. **Fetch** de la home y, si existen, de páginas enlazadas con texto que
   sugiera relevancia (`/servicios`, `/familia`, `/menu`, `/accesibilidad`,
   detectado por regex simple sobre el texto de los enlaces).
2. **Paso de reglas**: búsqueda de keywords fuertes y no ambiguas
   (`"trona"`, `"cambiador"`, `"menú infantil"`, `"parque infantil"`,
   `"zona infantil"`, `"acceso para carritos"`) → si aparecen, evidencia
   directa sin LLM, `confidence_weight` alto (fuente oficial).
3. **Paso LLM — solo si el paso de reglas no encontró nada** y la página
   tiene contenido textual sustancial (>500 caracteres tras limpiar HTML):
   se envía el texto a extracción estructurada (ver "Prompt de extracción"
   abajo) pidiendo *únicamente* señales explícitas, nunca inferencias sobre
   texto ausente.

Esto evita el caso más caro y menos necesario: mandar cada web entera al LLM
cuando el 90% de las webs de restaurantes no mencionan nada de esto y una
búsqueda de keywords ya lo habría descartado gratis.

## 4. Reseñas de Google — NLP dirigido, no keyword-matching ciego

El spec (sección 9) pide explícitamente **no limitarse a keywords** sino usar
IA para interpretar semánticamente. Pero antes de llamar al LLM se aplica un
filtro barato: solo se procesan reseñas que contienen al menos una palabra
de la lista de señales (bebé, bebés, niño, niños, familia, carrito,
cochecito, trona, cambiador, pañal, biberón, lactancia, parque, zona
infantil, pequeños, hijos). Las reseñas sin ninguna de esas palabras casi
nunca aportan señal Baby y no se envían al LLM — es un pre-filtro de coste,
no el mecanismo de extracción.

Las reseñas que pasan el filtro (máximo 5 por lugar, límite de la propia API
de Google — ver doc. 4) se agrupan y se envían **juntas** en una sola llamada
por lugar, no una llamada por reseña.

### Prompt de extracción (forma, no literal)

```
Sistema: Extraes señales objetivas sobre características para bebés a partir
de texto. Solo reportas lo que el texto afirma explícitamente. Si el texto
no menciona una característica, no la incluyas — la ausencia de mención NO
es evidencia de ausencia del servicio.

Entrada: hasta 5 reseñas de un mismo lugar (o el texto de su web oficial).

Salida (structured output, esquema fijo):
[{
  feature_type: enum(...lista cerrada de baby_feature_type...),
  value: "yes" | "no" | "limited",
  evidence_quote: string,  // la frase exacta que sustenta la extracción
  confidence: "explicit" | "implied"
}]
```

- Se usa `output_config.format` (structured outputs de la API de Claude), no
  parsing manual de JSON en texto libre — evita el fallo típico de "el LLM
  devolvió casi-JSON".
- `confidence: "implied"` (p.ej. "nos sentamos en la terraza con la niña" →
  implica terraza + aceptación de niños, pero no lo dice literalmente) baja
  el `confidence_weight` de esa evidencia respecto a `"explicit"` (doc. 6).
- El `evidence_quote` es lo que se guarda como `evidence.raw_value` — permite
  mostrar "¿Por qué decimos esto?" (spec sección 25) sin tener que volver a
  llamar a la API de reseñas de Google en tiempo de lectura, y sin
  re-publicar la reseña completa (ver doc. 4 sobre límites de
  reproducción de contenido de reseñas).

### Modelo recomendado

Tarea de clasificación/extracción estructurada sobre texto corto (varias
reseñas cortas o un extracto de web, no razonamiento largo). Es el caso de
uso "single call, low complexity, high volume" — **Claude Haiku 4.5** es la
elección coste-eficiente aquí (ver doc. 9 para la comparación de coste real
con Sonnet). Esto es una decisión de arquitectura para *este* pipeline de
extracción por lotes, no una recomendación general de modelo para el resto
de la aplicación.

## 5. Comunidad (fuente 5, doc. 7)

Es la única fuente que no pasa por "ingesta" — llega directamente como
`community_contribution` vía Server Action, y el motor de resolución la
consume igual que cualquier otra evidencia (mismo pipeline, `source =
'COMMUNITY'`).

## Cuándo NO se llama al LLM (resumen operativo)

No se llama al LLM cuando:
- Google Places u OSM ya dieron una señal estructurada para esa
  `feature_type` en ese lugar (no hace falta "confirmar" con IA algo que ya
  es un dato).
- La web oficial no tiene contenido textual sustancial, o el paso de reglas
  (keywords) ya encontró la señal.
- Las reseñas disponibles no contienen ninguna palabra de la lista de
  señales.

Esto es lo que mantiene el coste del doc. 9 en el orden de céntimos de
dólar para el POC, no de decenas de dólares.
