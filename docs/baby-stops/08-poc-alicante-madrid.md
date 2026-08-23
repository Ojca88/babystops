# Documento 8 — Plan del experimento Alicante–Madrid

El spec define dos fases distintas (secciones 40-41 y 56-58) que conviene no
confundir:

| | Fase 0 — POC | Fase 1 — Experimento |
|---|---|---|
| Tamaño | 20-30 lugares | 100-200 lugares |
| Objetivo | Descubrir limitaciones reales antes de invertir en la app | Medir cobertura/coste/calidad con volumen representativo |
| Salida | Una tabla comparativa (spec sección 56) | Un dashboard interno con métricas (doc. siguiente / sección 42 del spec) |
| Cuándo | Primero, antes de escribir nada del pipeline completo | Después de validar la Fase 0 |

## Fase 0 — POC (20-30 lugares)

### Paso 1 — Definir el corredor

1. Geocodificar "Alicante"/"Madrid" con el proxy de Nominatim que ya existe
   (`src/app/api/geocode/route.ts`) y calcular la ruta con el proxy de OSRM
   que ya existe (`src/app/api/directions/route.ts`) — ninguno de los dos
   requiere API key de Google, y ambos ya se usan hoy para la búsqueda de
   viaje. Alicante→Madrid y Madrid→Alicante son en la práctica la misma
   carretera invertida; se procesa como un único corredor con dos sentidos
   de recorrido para el cálculo de tiempo-desde-origen.
2. OSRM ya devuelve la geometría como una lista de puntos `(lat, lng)`, sin
   necesidad de decodificar ninguna polyline.
3. Muestrear esos puntos cada ~20 km → ~20 puntos de muestreo a lo largo de
   los ~420 km de ruta.

### Paso 2 — Descubrir candidatos (manual/semi-manual para el POC)

Para el POC **no** se automatiza todavía el pipeline completo — el objetivo
es descubrir limitaciones, no medir rendimiento del pipeline (eso es la Fase
1). Se seleccionan a mano 20-30 lugares variados a lo largo del corredor,
cubriendo intencionadamente las 5 categorías del spec (sección 4):
restaurantes/áreas de servicio, parques/áreas de descanso, farmacias/super,
un par de alojamientos, un par de gasolineras — para que el POC hable de
cobertura real por categoría, no solo de restaurantes (que es lo más fácil
de encontrar).

### Paso 3 — Por cada lugar, ejecutar el pipeline del doc. 3 y 6

1. Google Places: Text Search por nombre+zona → Place Details.
2. OSM: Overpass query puntual (radio 100 m sobre las coordenadas de Google).
3. Web oficial si `websiteUri` existe.
4. Reseñas (máx. 5) → filtro de keywords → LLM si procede.
5. Motor de resolución (doc. 6) → `baby_features` + Baby Score (doc. 5).

### Paso 4 — Tabla de salida (spec sección 56, literal)

| Lugar | Trona | Cambiador | Carrito | Juegos | Parking | Baby Score | Fuentes |
|---|---|---|---|---|---|---:|---|

Esta tabla **es** el entregable de la Fase 0 — se genera con un script que
recorre los 20-30 lugares y vuelca `baby_features` + `place_summary` (la
vista del doc. 2) a este formato. No hace falta UI todavía.

### Criterio de éxito de la Fase 0 (spec sección 57)

Medir explícitamente, sin ocultar lo que no se consigue (spec, cierre de la
sección 57):

- % de lugares con al menos 1 característica `CONFIRMED` o `PROBABLE`.
- % de lugares con evidencia de ≥2 fuentes independientes.
- Cuántas contradicciones aparecieron (aunque sea con solo 20-30 lugares).
- Coste real medido (no estimado) — comparar contra el doc. 9.
- Tiempo real de procesamiento por lugar.

Si el % de lugares con información útil es muy bajo (p.ej. <30%), es una
señal de que hay que revisar la estrategia de extracción (doc. 3) antes de
escalar a la Fase 1, no de que el producto no sea viable — 20-30 lugares es
una muestra pequeña y sesgada por diseño (paso 2 elige variedad, no
representatividad estadística).

## Fase 1 — Experimento (100-200 lugares)

Una vez validada la Fase 0, se automatiza completamente:

1. **Descubrimiento automático**: Text Search de Google + Overpass de OSM en
   cada uno de los ~20 puntos de muestreo del corredor, por cada categoría
   del spec (sección 4) — no selección manual.
2. **Deduplicación** (doc. 7) sobre el conjunto descubierto.
3. **Ingesta completa** (doc. 3) sobre el conjunto deduplicado.
4. **Cálculo de `place_routes`**: para cada lugar, distancia perpendicular a
   la polyline + tiempo de desvío estimado (tiempo desde el punto de la ruta
   más cercano hasta el lugar y de vuelta a la ruta, usando velocidad media
   de vía en vez de una segunda llamada a Routes API por lugar — control de
   coste, doc. 9).
5. **Dashboard interno** con las métricas de la sección 42 del spec
   (lugares descubiertos, válidos, duplicados, % con web, % con OSM, % con
   reviews, % con info Baby, % por característica, % confirmado vs.
   inferido vs. desconocido).

### Criterio de éxito de la Fase 1

Los 10 puntos de la sección 41 del spec, literalmente — este documento no
los reformula porque ya están bien planteados como preguntas de medición, no
de implementación. La Fase 1 responde a esas 10 preguntas con números reales
del corredor Alicante-Madrid.

## Bloqueos — qué necesito de ti antes de poder ejecutar esto

Esto es investigación/análisis (documentos 1-7 y el diseño de este
documento) que no requiere credenciales. **Ejecutar la Fase 0 sí las
requiere:**

1. **Google Cloud**: un proyecto con **Places API (New)** habilitada y
   facturación activa (aunque el uso del POC caiga dentro de la capa
   gratuita mensual — ver doc. 9 — Google exige billing account activa para
   emitir la API key). Ya no hace falta Routes API — el routing usa el OSRM
   gratuito que el repo ya tiene integrado. ¿Ya tienes un proyecto de
   Google Cloud, o lo creamos?
2. **Clave de API de Google** correspondiente, guardada como variable de
   entorno server-only (`GOOGLE_MAPS_API_KEY`, nunca `NEXT_PUBLIC_*` — estas
   llamadas se hacen desde el backend de ingesta, no desde el navegador).
3. **Overpass**: no requiere credenciales, solo un `User-Agent`
   identificable (política de uso justo, doc. 4) — no bloquea.
4. **LLM**: esta misma sesión de Claude Code puede ejecutar la extracción
   directamente sin credenciales adicionales tuyas durante el desarrollo del
   POC; para que el pipeline corra en producción de forma autónoma
   (cron/refresco periódico sin intervención manual) hará falta una clave de
   API de Anthropic o acceso vía Vercel AI Gateway — no es necesario para
   ejecutar la Fase 0 ahora mismo.

Sin el punto 1-2, puedo dejar todo el código del pipeline escrito y
testeado con fixtures (datos de ejemplo), pero no puedo ejecutar una
ingesta real contra Google Places.
