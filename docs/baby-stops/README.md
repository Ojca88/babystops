# Baby Stops — Documentos de análisis y viabilidad

Estos 10 documentos responden a la "Primera tarea para Claude" del spec del
producto: un análisis técnico y de viabilidad antes de construir la
aplicación completa. A partir de este análisis ya se ha implementado el
código del pipeline (ver "Estado de la implementación" más abajo); lo único
pendiente es la parte que requiere credenciales que solo el usuario puede
proveer (Google Cloud, Supabase service role).

1. [Arquitectura propuesta](01-arquitectura.md)
2. [Modelo de datos](02-modelo-de-datos.md)
3. [Fuentes de información y estrategia de extracción](03-fuentes-y-extraccion.md)
4. [Limitaciones legales y técnicas](04-limitaciones-legales.md)
5. [Algoritmo Baby Score](05-baby-score.md)
6. [Sistema de evidencias y confianza](06-evidencias-confianza.md)
7. [Contribuciones de comunidad](07-comunidad.md)
8. [Plan del experimento Alicante–Madrid](08-poc-alicante-madrid.md)
9. [Estimación de costes](09-estimacion-costes.md)
10. [MVP técnico](10-mvp-tecnico.md)

**Orden de lectura recomendado:** 1 → 2 → 3 → 4, luego 5 → 6 → 7 (el
"cerebro" del producto), y por último 8 → 9 → 10 (cómo lo probamos y
construimos).

**Decisiones que necesito de ti antes de ejecutar el POC (doc. 8):** ver la
sección "Bloqueos" al final de ese documento — sobre todo si ya tienes (o
quieres crear) un proyecto de Google Cloud con Places API (New) habilitada
y facturación activa.

## Estado de la implementación

El código ya está escrito y con tests (`npm test`) para toda la lógica que
no depende de credenciales externas: motor de resolución de evidencias
(doc. 6), Baby Score (doc. 5), deduplicación (doc. 7), mapeo de
Google Places/OSM a evidencia (doc. 3), filtro y extracción por IA,
geometría de rutas. La migración de base de datos (doc. 2) está escrita
pero **no aplicada** — requiere `supabase db push` o pegarla en el SQL
Editor del dashboard. El script de ingesta (`npm run ingest -- "Alicante"
"Madrid"`) está completo pero necesita `GOOGLE_MAPS_API_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` para ejecutarse de verdad — ver la lista
completa de pasos manuales al final de la conversación.
