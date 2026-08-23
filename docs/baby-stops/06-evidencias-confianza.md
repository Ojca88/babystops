# Documento 6 — Sistema de evidencias y confianza

Este documento define el **motor de resolución** mencionado en el doc. 1: la
función pura que convierte `evidence[]` (histórico, nunca se borra) en una
fila de `baby_features` (valor resuelto actual). Se ejecuta cada vez que
llega evidencia nueva para un `(place_id, feature_type)`.

## Pesos base por fuente (spec sección 12)

| Fuente | Peso base |
|---|---:|
| `OFFICIAL_WEBSITE` | 40 |
| `OSM` | 25 |
| `COMMUNITY` (por contribución individual) | 20 |
| `REVIEW_NLP` | 10 |
| `AI_INFERENCE` (extracción con `confidence: "implied"`, doc. 3) | 5 |
| `GOOGLE_PLACES` (campo estructurado, no reseña) | 35 — ver nota |

*Nota:* el spec no listaba a Google Places por separado en la sección 12
porque trataba "reseñas" como la vía de Google; aquí se distingue: un campo
**estructurado** de Google (p.ej. `parkingOptions.freeParkingLot`) es tan
fiable como una fuente oficial y se pesa como tal (35, ligeramente por
debajo de la web oficial del propio negocio, que tiene más incentivo a estar
actualizada). Una **reseña** de Google entra por `REVIEW_NLP` (peso 10), no
por este peso.

## De pesos a `confidence_score` — el algoritmo

No es una suma simple (el spec lo pide explícitamente, sección 12: "evitar
simplemente sumar puntos sin control"). Para un `(place_id, feature_type)`
dado, con evidencias `e_1..e_n` para el mismo `value` (agrupando primero por
valor — ver contradicciones abajo):

```
score_bruto = Σ (peso_fuente(e_i) × decaimiento(e_i) × factor_certeza(e_i))

decaimiento(e_i) = 1.0                           si antigüedad < 6 meses
                  = 0.7                           si antigüedad 6-12 meses
                  = 0.4                           si antigüedad > 12 meses

factor_certeza(e_i) = 1.0 si evidencia explícita (regla directa, tag OSM,
                            campo estructurado, o LLM con confidence:"explicit")
                     = 0.6 si LLM con confidence:"implied"

// Rendimientos decrecientes: la 2ª evidencia de la misma fuente no vale
// lo mismo que la 1ª (si 5 usuarios dicen lo mismo, no es 5x más fiable
// que si dice 1, converge)
score_ajustado = score_bruto con cada fuente aplicando raíz cuadrada al
                 conteo de evidencias repetidas de esa misma fuente:
                 contribución_fuente = peso_fuente × sqrt(n_evidencias_esa_fuente)
                 (en vez de peso_fuente × n_evidencias_esa_fuente)

confidence_score = min(100, score_ajustado)
```

La raíz cuadrada en vez de la suma lineal es lo que hace que "7 confirmaciones
de comunidad" (spec sección 11: resultado 96% de confianza) no requiera
inflar el peso base de comunidad a un número absurdo, y evita que un ataque
de spam de un solo usuario creando cuentas para votar domine el score
(mitigado también por moderación, doc. 7).

## De `confidence_score` a `status`

```
status = 'CONFIRMED'    si confidence_score >= 70
       = 'PROBABLE'     si 40 <= confidence_score < 70
       = 'UNCONFIRMED'  si 0 < confidence_score < 40
       = 'UNKNOWN'      si no hay evidencia para este (place, feature)
```

`NOT_AVAILABLE` es un caso especial: no es "confidence bajo", es evidencia
**positiva de ausencia** (p.ej. OSM `changing_table=no`, o una regla que
detecta explícitamente "no tenemos cambiador" en la web). Se calcula igual
que arriba pero sobre el `value = 'no'`, y si ese lado gana la comparación de
contradicción (siguiente sección), el `status` final es `NOT_AVAILABLE` en
vez de `UNCONFIRMED`.

## Contradicciones (spec sección 13)

Cuando existen evidencias para **valores distintos** del mismo
`(place_id, feature_type)` (p.ej. web dice `changing_table=yes`, 2 usuarios
recientes dicen `no`):

1. Se calcula `confidence_score` por separado para cada valor en conflicto.
2. Gana el valor con mayor `confidence_score`, pero:
   - Si la diferencia entre el valor ganador y el segundo es **< 15
     puntos**, el `status` resultante se marca `NEEDS_REVIEW` en vez de
     `CONFIRMED`/`PROBABLE`, y se genera una alerta (tabla
     `community_contributions` ya tiene el estado `CONFLICTING` para esto —
     se reutiliza para alertas internas, no solo para contribuciones).
   - Si la evidencia contraria es **más reciente y de una fuente igual o más
     fiable** que la ganadora original (p.ej. 2 usuarios de esta semana
     contradicen un tag OSM de hace 2 años), se prioriza la reciente aunque
     el score bruto sea menor — esto es exactamente el ejemplo del spec
     ("Cambiador = Sí" en OSM antiguo vs. "2 dicen que ya no existe" →
     resultado "Posiblemente no disponible").
3. La UI (doc. 7, "¿Por qué decimos esto?") siempre puede mostrar ambos
   lados cuando `status = 'NEEDS_REVIEW'` — es información, no un fallo a
   ocultar.

## Antigüedad y necesidad de reverificación (spec sección 39)

Cada `baby_feature` guarda `last_verified_at` (la fecha de la evidencia más
reciente usada en su cálculo, no la fecha de cálculo). La UI aplica:

```
antigüedad > 6 meses  → mostrar "⚠ Puede estar desactualizada"
antigüedad > 12 meses → mostrar "⚠ Requiere verificación" + el
                         decaimiento de la sección anterior ya lo habrá
                         bajado de status automáticamente en la mayoría
                         de los casos
```

Esto también alimenta una cola de priorización de refresco (doc. 10): los
`places` con features `CONFIRMED` pero `last_verified_at` > 12 meses son
candidatos preferentes para el próximo ciclo de re-ingesta, en vez de
re-consultar todo el dataset cada vez (control de coste, doc. 9).

## Evidencia general (sin `feature_type`)

Una reseña puede no mapear a ninguna característica concreta pero seguir
siendo evidencia útil de contexto (p.ej. "ambiente muy tranquilo, perfecto
para la siesta del bebé" → no es ninguna `baby_feature_type` de la lista,
pero es la característica adicional `quiet_atmosphere` de la sección 5.6).
Estas se guardan igual en `evidence` con `feature_type` apuntando a esas
características adicionales — no participan en el Baby Score (doc. 5) pero
sí se muestran en la ficha del lugar.

## Resumen para quien implemente esto (doc. 10)

La función es pura y testeable sin red:

```ts
function resolveFeature(
  evidenceRows: Evidence[], // ya filtradas por (place_id, feature_type)
  now: Date
): { value: string; status: FeatureStatus; confidenceScore: number; lastVerifiedAt: Date }
```

Cualquier cambio de pesos o umbrales (las constantes de este documento) debe
vivir en un único módulo de configuración, no repartido en el código — son
los primeros números que se van a querer ajustar tras el experimento del
doc. 8.
