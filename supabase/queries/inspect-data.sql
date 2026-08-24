-- ============================================================================
-- Baby Stops — consultas de inspección de datos
--
-- Pensadas para pegar en el SQL Editor de Supabase:
--   https://supabase.com/dashboard/project/qnxdfbgusrbugsaaexkr/sql/new
-- Cada bloque es independiente — copia el que te interese, no hace falta
-- ejecutar el archivo entero de una vez.
--
-- Nota sobre el Baby Score: no es una columna de la base de datos, se
-- calcula en la app a partir de baby_features (src/lib/scoring/baby-score.ts).
-- Estas consultas te dan la materia prima (features + confianza + fuentes)
-- para verla directamente, no el score ya calculado.
-- ============================================================================

-- 1. Resumen general: cuántas filas hay en cada tabla
select 'places' as tabla, count(*) from public.places
union all select 'routes', count(*) from public.routes
union all select 'place_routes', count(*) from public.place_routes
union all select 'baby_features', count(*) from public.baby_features
union all select 'evidence', count(*) from public.evidence
union all select 'community_contributions', count(*) from public.community_contributions
order by tabla;

-- 2. Lugares descubiertos, con qué fuentes tienen disponibles
select
  name,
  category,
  status,
  google_place_id is not null as tiene_google,
  osm_id is not null as tiene_osm,
  website is not null as tiene_web,
  created_at
from public.places
order by created_at desc;

-- 3. Evidencia recogida, agrupada por fuente (Google, OSM, web oficial,
--    reseñas, comunidad, inferencia IA)
select
  source,
  count(*) as num_evidencias,
  count(distinct place_id) as lugares_distintos,
  count(distinct feature_type) as features_distintas
from public.evidence
group by source
order by num_evidencias desc;

-- 4. Matriz característica × fuente — qué fuente aporta qué dato
select
  feature_type,
  source,
  count(*) as num_evidencias
from public.evidence
group by feature_type, source
order by feature_type, source;

-- 5. Características ya resueltas: distribución de estados
select
  status,
  count(*) as num_features,
  round(avg(confidence_score), 1) as confianza_media
from public.baby_features
group by status
order by num_features desc;

-- 6. Ficha completa de UN lugar — valor resuelto por característica.
--    Sustituye 'NOMBRE_DEL_LUGAR' por el nombre (o parte de él) del lugar
--    que quieras inspeccionar.
select
  bf.feature_type,
  bf.value as valor_resuelto,
  bf.status,
  bf.confidence_score,
  bf.last_verified_at
from public.baby_features bf
join public.places p on p.id = bf.place_id
where p.name ilike '%NOMBRE_DEL_LUGAR%'
order by bf.feature_type;

-- 6b. Mismo lugar, pero viendo la evidencia cruda que sustenta cada valor
--     ("¿por qué decimos esto?" — spec sección 25)
select
  e.feature_type,
  e.source,
  e.value,
  e.certainty,
  e.confidence_weight,
  e.raw_value,
  e.detected_at
from public.evidence e
join public.places p on p.id = e.place_id
where p.name ilike '%NOMBRE_DEL_LUGAR%'
order by e.feature_type, e.detected_at desc;

-- 7. Todos los lugares con sus características en una sola fila (JSON),
--    usando la vista place_summary creada en la migración 0002
select
  name,
  category,
  status,
  features
from public.place_summary
order by created_at desc
limit 50;

-- 8. Métricas de cobertura (docs/baby-stops/09-estimacion-costes.md,
--    dashboard interno de la sección 42 del spec)
select
  count(*) as lugares_totales,
  count(*) filter (where google_place_id is not null) as con_google,
  count(*) filter (where osm_id is not null) as con_osm,
  count(*) filter (where website is not null) as con_web
from public.places;

select
  round(
    100.0 * count(*) filter (where status in ('CONFIRMED', 'PROBABLE')) / nullif(count(*), 0),
    1
  ) as pct_confirmado_o_probable,
  round(
    100.0 * count(*) filter (where status = 'UNKNOWN') / nullif(count(*), 0),
    1
  ) as pct_desconocido,
  round(
    100.0 * count(*) filter (where status = 'NEEDS_REVIEW') / nullif(count(*), 0),
    1
  ) as pct_contradictorio
from public.baby_features;

-- 9. Contradicciones detectadas entre fuentes (docs/baby-stops/06-evidencias-confianza.md)
select
  p.name,
  bf.feature_type,
  bf.value,
  bf.confidence_score
from public.baby_features bf
join public.places p on p.id = bf.place_id
where bf.status = 'NEEDS_REVIEW'
order by p.name, bf.feature_type;

-- 10. Rutas calculadas
select
  origin,
  destination,
  round(distance_meters / 1000.0, 1) as distancia_km,
  round(duration_seconds / 60.0) as duracion_min,
  created_at
from public.routes
order by created_at desc;

-- 10b. Desvío de cada lugar respecto a su ruta
select
  p.name,
  round(pr.distance_to_route_meters) as distancia_a_ruta_m,
  round(pr.detour_seconds / 60.0, 1) as desvio_min,
  round(pr.position_from_origin_seconds / 60.0) as minuto_desde_origen
from public.place_routes pr
join public.places p on p.id = pr.place_id
order by pr.position_from_origin_seconds;

-- 11. Contribuciones de comunidad pendientes de moderar
select
  cc.contribution_type,
  cc.feature_type,
  cc.value,
  cc.comment,
  cc.status,
  p.name as lugar,
  cc.created_at
from public.community_contributions cc
left join public.places p on p.id = cc.place_id
where cc.status = 'PENDING'
order by cc.created_at desc;
