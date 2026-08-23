# Documento 5 — Algoritmo Baby Score

## Componentes base (spec sección 14)

| Componente | Puntos máx. |
|---|---|
| Alimentación | 20 |
| Higiene | 20 |
| Carrito / accesibilidad | 20 |
| Entretenimiento | 20 |
| Coche / aparcamiento | 10 |
| Evidencia / fiabilidad | 10 |
| **Total** | **100** |

## De `baby_features` a puntos por componente

Cada componente se descompone en un conjunto fijo de `feature_type` con un
peso relativo dentro del componente. El punto clave: **el peso de cada
feature se multiplica por su `confidence_score`** (0-100, doc. 6), no se
suma como si estuviera confirmado al 100%. Esto evita que una característica
`PROBABLE` puntúe igual que una `CONFIRMED`.

```
puntos_feature = peso_maximo_feature × (confidence_score / 100)
```

Si `status = 'NOT_AVAILABLE'`, la feature aporta **0** puntos (no penaliza
por debajo de 0 — no confundir "no disponible" con "mal lugar"). Si
`status = 'UNKNOWN'`, también aporta 0 — la ausencia de información nunca
suma ni resta, solo dejar de aportar (principio spec sección 38).

### Alimentación (20 pts)

| Feature | Peso |
|---|---|
| `highchair` | 6 |
| `kids_menu` | 4 |
| `baby_food_options` | 4 |
| `warm_food` | 3 |
| `warm_bottle` | 3 |

### Higiene (20 pts)

| Feature | Peso |
|---|---|
| `changing_table` | 10 |
| `family_restroom` | 6 |
| `accessible_restroom` | 4 |

### Carrito / accesibilidad (20 pts)

| Feature | Peso |
|---|---|
| `stroller_access` (`easy`=1.0, `possible`=0.6, `difficult`=0.1 — multiplicador adicional sobre el peso) | 8 |
| `stroller_space` | 6 |
| `elevator` (solo aplica si `stairs_required=yes`; si no hay escaleras, se excluye del denominador — ver "Normalización" abajo) | 6 |

### Entretenimiento (20 pts)

| Feature | Peso |
|---|---|
| `indoor_play_area` u `outdoor_play_area` (el máximo de los dos) | 8 |
| `nearby_playground` | 6 |
| `space_to_move` | 6 |

### Coche / aparcamiento (10 pts)

| Feature | Peso |
|---|---|
| `parking` o `nearby_parking` (máximo de los dos) | 5 |
| `parking_ease` (`easy`=1.0, `medium`=0.5, `difficult`=0.1) | 3 |
| `free_parking` | 2 |

### Evidencia / fiabilidad (10 pts) — el componente "meta"

No mide una característica Baby, mide **cuánto confiar en el resto del
score**. Fórmula:

```
evidencia_pts = 10 × min(1, num_features_con_evidencia / num_features_totales_aplicables)
              × factor_diversidad_fuentes
```

- `factor_diversidad_fuentes` = 0.7 si toda la evidencia viene de una sola
  fuente, 1.0 si hay ≥2 fuentes independientes (p.ej. OSM + comunidad, o
  Google + web oficial) para el conjunto de features con evidencia. Premia
  exactamente el caso de la sección 13 del spec ("confirmada por
  establecimiento y usuarios" debe pesar más que "solo Google dice que sí").

### Normalización cuando una feature no aplica

Algunas features no tienen sentido en todos los lugares (`elevator` solo si
hay escaleras; `terrace` no puntúa en ningún componente base — es un extra,
sección 5.6 del spec, no entra en el Baby Score, se muestra aparte como
"características adicionales"). Cuando una feature del componente no aplica,
su peso se **redistribuye proporcionalmente** entre las features restantes
del mismo componente, para que el componente siga sumando su máximo teórico
cuando todo lo aplicable está confirmado.

## Ejemplo completo (el del spec, sección 14)

> Baby Score: 87/100 — Alimentación 18/20, Higiene 18/20, Carrito 17/20,
> Entretenimiento 14/20, Coche 10/10, Evidencia 10/10

Esto es consistente con la fórmula si, por ejemplo, en Alimentación
`highchair` está `CONFIRMED` (confidence 95) y `kids_menu` `PROBABLE`
(confidence 70), el resto `NOT_AVAILABLE`: `6×0.95 + 4×0.70 ≈ 5.7 + 2.8 =
8.5` sobre un máximo redistribuido a esas dos features (10 pts) → escalado a
la ponderación completa del componente da un número en el rango de 18/20
según cómo se hayan detectado el resto de sub-features. El detalle se
recalcula en la implementación (doc. 10) con tests que fijan estos casos.

## Mostrar el desglose (no caja negra — spec sección 14)

La tarjeta de detalle (spec sección 24) muestra los 6 componentes con su
puntuación y, al expandir, qué features concretas los componen y su
`status`/`confidence` — literalmente la salida de la función de scoring, sin
resumir. Esto es gratis con este diseño: el desglose por componente **es**
la estructura de entrada de la función, no algo que haya que reconstruir a
posteriori.

## Ajuste por edad del bebé (spec sección 15)

En vez de un score único, el Baby Score se calcula con un **vector de pesos
por componente** que cambia según la franja de edad seleccionada por el
usuario. Los pesos base de la tabla de arriba son el perfil "general" (sin
edad seleccionada). Perfiles:

| Componente | 0-6m | 6-12m | 1-2a | 2-4a |
|---|---:|---:|---:|---:|
| Alimentación | 15 | 25 | 20 | 15 |
| Higiene | 30 | 20 | 15 | 10 |
| Carrito/accesibilidad | 25 | 15 | 10 | 5 |
| Entretenimiento | 5 | 10 | 25 | 35 |
| Coche/aparcamiento | 15 | 15 | 15 | 15 |
| Evidencia/fiabilidad | 10 | 15 | 15 | 20 |

(Siempre suman 100; los valores están alineados con las prioridades que el
propio spec enumera por franja en la sección 15 — p.ej. 0-6 meses prioriza
cambiador/lactancia/carrito sobre entretenimiento, de ahí el peso de Higiene
30 y Entretenimiento 5.) Estos números son un punto de partida razonable, no
una verdad medida — se recomienda tratarlos como configuración (tabla o
JSON versionado), no como constantes en código, para poder afinarlos tras el
experimento del doc. 8 sin desplegar.

## Qué NO hace el Baby Score

- No sustituye al rating general de Google — se muestran **ambos** por
  separado (spec sección 23: "⭐ 4,5 Google" y "👶 Baby Score 91" como líneas
  distintas), nunca mezclados en un solo número.
- No penaliza por falta de información (ya cubierto arriba) — un lugar
  nuevo con poca evidencia tiene un Baby Score bajo por el componente
  "Evidencia/fiabilidad", no por asumir que sus características son malas.
