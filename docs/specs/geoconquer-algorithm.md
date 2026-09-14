# GeoConquer — Algoritmo de Discretización y Conquista

## 1. Objetivo

Convertir coordenadas GPS continuas (latitud/longitud) en índices discretos de celdas de 100m × 100m, acumular tiempo de permanencia por celda, y determinar quién conquista cada celda sin sobrecargar la cuota de la base de datos.

---

## 2. Proyección y Discretización de Celdas

### 2.1 Por qué no usar grados directamente

Un grado de latitud ≈ 111 km, pero un grado de longitud varía con la latitud:
```
1° longitud ≈ 111 km × cos(latitud)
```
En Madrid (lat ≈ 40.4°): 1° lon ≈ 84.9 km. Usar grados directamente daría celdas no cuadradas.

### 2.2 Sistema de cuadrícula Web Mercator (EPSG:3857)

Se proyecta a coordenadas métricas Web Mercator antes de discretizar:

```typescript
const EARTH_RADIUS = 6378137; // metros
const CELL_SIZE_M = 100;      // tamaño de celda en metros

function lngLatToCellIndex(lng: number, lat: number): { cellX: number; cellY: number } {
  // 1. Proyectar a Web Mercator (metros)
  const x = EARTH_RADIUS * (lng * Math.PI / 180);
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));

  // 2. Discretizar dividiendo por tamaño de celda (floor = esquina SW de la celda)
  const cellX = Math.floor(x / CELL_SIZE_M);
  const cellY = Math.floor(y / CELL_SIZE_M);

  return { cellX, cellY };
}
```

**Rango de valores:**
- `cellX` en Madrid: ≈ [-43800, -43700] (varía por zona)
- `cellY` en Madrid: ≈ [49500, 49600]
- Los valores son enteros con signo de 32 bits → caben en `INTEGER` de PostgreSQL.

### 2.3 Función inversa: celda → bounding box geográfico

```typescript
function cellIndexToBBox(cellX: number, cellY: number): {
  swLng: number; swLat: number;
  neLng: number; neLat: number;
} {
  const xMin = cellX * CELL_SIZE_M;
  const yMin = cellY * CELL_SIZE_M;
  const xMax = xMin + CELL_SIZE_M;
  const yMax = yMin + CELL_SIZE_M;

  return {
    swLng: (xMin / EARTH_RADIUS) * (180 / Math.PI),
    swLat: (2 * Math.atan(Math.exp(yMin / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI),
    neLng: (xMax / EARTH_RADIUS) * (180 / Math.PI),
    neLat: (2 * Math.atan(Math.exp(yMax / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI),
  };
}
```

---

## 3. Algoritmo de Acumulación de Tiempo (Client-side)

### 3.1 Principio: delta-time, no polling

En lugar de enviar una petición por segundo, el cliente calcula el tiempo transcurrido en la misma celda y solo envía un `UPSERT` cuando:
1. El usuario cambia de celda (enviar delta de tiempo acumulado en la celda anterior).
2. Han pasado ≥ 30 segundos en la misma celda (flush periódico de seguridad).

```typescript
interface CellSession {
  cellX: number;
  cellY: number;
  enteredAt: number;       // timestamp ms
  lastFlushedAt: number;   // timestamp ms
}

const FLUSH_INTERVAL_MS = 30_000;  // flush cada 30s si sigue en la misma celda
const MIN_ACCURACY_M = 50;         // ignorar lecturas con precisión peor de 50m

let currentSession: CellSession | null = null;

function onPositionUpdate(position: GeolocationPosition) {
  const { latitude, longitude, accuracy } = position.coords;

  // Descartar lecturas poco precisas
  if (accuracy > MIN_ACCURACY_M) return;

  const now = Date.now();
  const { cellX, cellY } = lngLatToCellIndex(longitude, latitude);

  if (!currentSession) {
    // Primera lectura
    currentSession = { cellX, cellY, enteredAt: now, lastFlushedAt: now };
    return;
  }

  const sameCell = cellX === currentSession.cellX && cellY === currentSession.cellY;

  if (!sameCell) {
    // El usuario cambió de celda: registrar tiempo en la celda anterior
    const deltaSeconds = Math.floor((now - currentSession.lastFlushedAt) / 1000);
    if (deltaSeconds > 0) {
      flushCellTime(currentSession.cellX, currentSession.cellY, deltaSeconds);
    }
    // Iniciar nueva sesión en la celda nueva
    currentSession = { cellX, cellY, enteredAt: now, lastFlushedAt: now };

  } else if (now - currentSession.lastFlushedAt >= FLUSH_INTERVAL_MS) {
    // Flush periódico en la misma celda
    const deltaSeconds = Math.floor((now - currentSession.lastFlushedAt) / 1000);
    flushCellTime(cellX, cellY, deltaSeconds);
    currentSession.lastFlushedAt = now;
  }
}
```

### 3.2 Función de flush: UPSERT atómico en Supabase

```typescript
async function flushCellTime(cellX: number, cellY: number, deltaSeconds: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || deltaSeconds <= 0) return;

  // UPSERT: si ya existe la fila, suma el delta; si no, la crea
  await supabase.rpc('upsert_cell_occupancy', {
    p_cell_x: cellX,
    p_cell_y: cellY,
    p_group_id: currentGroupId,
    p_delta_seconds: deltaSeconds,
  });
}
```

Función SQL correspondiente:

```sql
CREATE OR REPLACE FUNCTION public.upsert_cell_occupancy(
    p_cell_x        INTEGER,
    p_cell_y        INTEGER,
    p_group_id      UUID,
    p_delta_seconds INTEGER
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.cell_occupancy (cell_x, cell_y, group_id, user_id, seconds_total, last_seen_at)
    VALUES (p_cell_x, p_cell_y, p_group_id, auth.uid(), p_delta_seconds, now())
    ON CONFLICT (cell_x, cell_y, group_id, user_id)
    DO UPDATE SET
        seconds_total = cell_occupancy.seconds_total + EXCLUDED.seconds_total,
        last_seen_at  = now();
END;
$$;
```

---

## 4. Reglas de Conquista

### 4.1 Definición de "owner"

- La celda `(cell_x, cell_y)` pertenece dentro del grupo al usuario con **mayor `seconds_total`**.
- En caso de empate exacto, gana quien lo alcanzó **primero** (`last_seen_at` más antiguo).
- El recálculo lo realiza automáticamente el trigger `cell_occupancy_recalculate_owner` definido en `database-schema.sql`.

### 4.2 Conquista mínima

No existe tiempo mínimo para "conquistar": la primera persona en pisar una celda la conquista con 0+ segundos. Esto incentiva la exploración.

### 4.3 Anti-trampa básico

| Técnica | Implementación |
|---|---|
| Precisión GPS insuficiente | Ignorar lecturas con `accuracy > 50m` (client-side) |
| Velocidad imposible | Si el usuario se mueve > 50 m/s entre dos lecturas, descartar (teleportation check) |
| Timestamp manipulado | El servidor usa `now()` al insertar, ignorando el timestamp del cliente |
| Flood de requests | Rate limit en la API Route de Next.js: max 1 req/5s por user_id via Upstash (o simple in-memory en dev) |

```typescript
// Teleportation check
function isTeleporting(prev: GeolocationCoordinates, curr: GeolocationCoordinates, dtMs: number): boolean {
  const distM = haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
  const speedMs = distM / (dtMs / 1000);
  return speedMs > 50; // más de 50 m/s ≈ 180 km/h
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

---

## 5. Renderizado de la Cuadrícula en MapLibre

### 5.1 Estrategia: GeoJSON dinámico en el viewport

No se cargan todas las celdas de la DB: solo las visibles en el viewport actual del mapa + buffer de 2 celdas.

```typescript
// Al mover el mapa, calcular bounding box visible y pedir celdas
map.on('moveend', async () => {
  const bounds = map.getBounds();
  const cells = await fetchCellsInBounds(bounds.getSouthWest(), bounds.getNorthEast());
  updateConquerLayer(cells);
});

async function fetchCellsInBounds(sw: LngLat, ne: LngLat) {
  const { data } = await supabase.rpc('get_cells_in_bbox', {
    p_group_id: currentGroupId,
    p_sw_lng: sw.lng, p_sw_lat: sw.lat,
    p_ne_lng: ne.lng, p_ne_lat: ne.lat,
  });
  return data;
}
```

Función SQL para obtener celdas con su dueño en un bounding box:

```sql
CREATE OR REPLACE FUNCTION public.get_cells_in_bbox(
    p_group_id UUID,
    p_sw_lng DOUBLE PRECISION, p_sw_lat DOUBLE PRECISION,
    p_ne_lng DOUBLE PRECISION, p_ne_lat DOUBLE PRECISION
)
RETURNS TABLE (
    cell_x       INTEGER,
    cell_y       INTEGER,
    owner_id     UUID,
    color_hue    SMALLINT,
    seconds_total INTEGER
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT
        co.cell_x,
        co.cell_y,
        co.user_id AS owner_id,
        gm.color_hue,
        co.seconds_total
    FROM public.cell_occupancy co
    JOIN public.group_members gm ON gm.user_id = co.user_id AND gm.group_id = co.group_id
    WHERE co.group_id = p_group_id
      AND co.is_owner = true
      AND co.cell_x BETWEEN
            FLOOR((p_sw_lng * 6378137 * PI() / 180) / 100) AND
            CEIL( (p_ne_lng * 6378137 * PI() / 180) / 100)
      AND co.cell_y BETWEEN
            FLOOR((LN(TAN(PI()/4 + p_sw_lat * PI()/360)) * 6378137) / 100) AND
            CEIL( (LN(TAN(PI()/4 + p_ne_lat * PI()/360)) * 6378137) / 100);
$$;
```

### 5.2 GeoJSON generado en cliente

```typescript
function cellsToGeoJSON(cells: CellData[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map(cell => {
      const bbox = cellIndexToBBox(cell.cell_x, cell.cell_y);
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [bbox.swLng, bbox.swLat],
            [bbox.neLng, bbox.swLat],
            [bbox.neLng, bbox.neLat],
            [bbox.swLng, bbox.neLat],
            [bbox.swLng, bbox.swLat],
          ]],
        },
        properties: {
          ownerId: cell.owner_id,
          colorHue: cell.color_hue,
          secondsTotal: cell.seconds_total,
        },
      };
    }),
  };
}
```

Capa MapLibre:

```javascript
map.addLayer({
  id: 'conquer-cells',
  type: 'fill',
  source: 'conquer-data',
  paint: {
    'fill-color': ['hsl', ['get', 'colorHue'], 80, 55],
    'fill-opacity': 0.4,
  },
});

map.addLayer({
  id: 'conquer-cells-border',
  type: 'line',
  source: 'conquer-data',
  paint: {
    'line-color': ['hsl', ['get', 'colorHue'], 80, 40],
    'line-width': 1,
  },
});
```

---

## 6. Estimación de Carga en DB (Free Tier Supabase)

| Evento | Frecuencia estimada | Operaciones/día (10 usuarios activos 2h) |
|---|---|---|
| `location_logs` INSERT | 1/5s por usuario | 10 × 2h × 720 = **14,400** |
| `cell_occupancy` UPSERT | 1/30s o por cambio de celda | 10 × 2h × 240 = **2,400** |
| `messages` INSERT | ~5/min por grupo | 600 |
| `conquer_ranking` REFRESH | cada 60s (cron) | 120 |
| **Total** | | **~17,520 ops/día** |

Supabase Free tier permite 500 MB de base de datos y sin límite explícito de operaciones por día en el plan gratuito. Con la política TTL de 30 días en `location_logs`, el crecimiento de datos se mantiene acotado.
