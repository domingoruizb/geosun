// Algoritmo de discretización GeoConquer
// Ver docs/specs/geoconquer-algorithm.md para la especificación completa

const EARTH_RADIUS = 6378137; // metros (WGS84)
const CELL_SIZE_M = 100;

export interface CellIndex {
  cellX: number;
  cellY: number;
}

export interface BBox {
  swLng: number;
  swLat: number;
  neLng: number;
  neLat: number;
}

/**
 * Proyecta coordenadas GPS (WGS84) a índice de celda en cuadrícula Web Mercator de 100m.
 */
export function lngLatToCellIndex(lng: number, lat: number): CellIndex {
  const x = EARTH_RADIUS * (lng * Math.PI) / 180;
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return {
    cellX: Math.floor(x / CELL_SIZE_M),
    cellY: Math.floor(y / CELL_SIZE_M),
  };
}

/**
 * Convierte un índice de celda al bounding box geográfico (WGS84) de esa celda.
 */
export function cellIndexToBBox(cellX: number, cellY: number): BBox {
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

/**
 * Distancia entre dos puntos GPS en metros (fórmula Haversine).
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = EARTH_RADIUS;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Detecta si el desplazamiento entre dos lecturas es físicamente imposible (teleportación).
 * Umbral: 50 m/s (~180 km/h).
 */
export function isTeleporting(
  prevLat: number, prevLon: number,
  currLat: number, currLon: number,
  dtMs: number,
): boolean {
  if (dtMs <= 0) return false;
  const distM = haversineDistance(prevLat, prevLon, currLat, currLon);
  return distM / (dtMs / 1000) > 50;
}
