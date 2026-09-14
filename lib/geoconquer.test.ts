import { describe, it, expect } from 'vitest';
import { lngLatToCellIndex, cellIndexToBBox, haversineDistance, isTeleporting } from './geoconquer';

describe('lngLatToCellIndex', () => {
  it('devuelve índices enteros', () => {
    const { cellX, cellY } = lngLatToCellIndex(-3.7038, 40.4168); // Madrid
    expect(Number.isInteger(cellX)).toBe(true);
    expect(Number.isInteger(cellY)).toBe(true);
  });

  it('celdas adyacentes tienen índice contiguo', () => {
    const a = lngLatToCellIndex(0, 0);
    // Desplazar ~100m hacia el este
    const b = lngLatToCellIndex(0.0009, 0); // ~100m a 0° lat
    expect(b.cellX).toBeGreaterThanOrEqual(a.cellX);
  });

  it('el mismo punto siempre produce el mismo índice', () => {
    const p1 = lngLatToCellIndex(-3.7038, 40.4168);
    const p2 = lngLatToCellIndex(-3.7038, 40.4168);
    expect(p1).toEqual(p2);
  });
});

describe('cellIndexToBBox', () => {
  it('la bbox cubre exactamente CELL_SIZE_M metros', () => {
    const { swLat, swLng, neLat, neLng } = cellIndexToBBox(0, 0);
    // La celda (0,0) en Web Mercator debe ser ~100m × 100m cerca del ecuador
    const widthM = haversineDistance(swLat, swLng, swLat, neLng);
    const heightM = haversineDistance(swLat, swLng, neLat, swLng);
    expect(widthM).toBeCloseTo(100, 0);
    expect(heightM).toBeCloseTo(100, 0);
  });

  it('roundtrip: cellIndex → bbox → cellIndex reproduce el mismo índice', () => {
    const original = lngLatToCellIndex(-3.7038, 40.4168);
    const bbox = cellIndexToBBox(original.cellX, original.cellY);
    // El centro de la celda debe volver al mismo índice
    const centerLng = (bbox.swLng + bbox.neLng) / 2;
    const centerLat = (bbox.swLat + bbox.neLat) / 2;
    const recovered = lngLatToCellIndex(centerLng, centerLat);
    expect(recovered).toEqual(original);
  });
});

describe('haversineDistance', () => {
  it('distancia de Madrid a Madrid es 0', () => {
    expect(haversineDistance(40.4168, -3.7038, 40.4168, -3.7038)).toBe(0);
  });

  it('1 grado de latitud ≈ 111 km', () => {
    const d = haversineDistance(0, 0, 1, 0);
    expect(d).toBeCloseTo(111_195, -3);
  });
});

describe('isTeleporting', () => {
  it('movimiento normal no es teleportación', () => {
    // 50m en 5 segundos = 10 m/s (normal al caminar/correr)
    expect(isTeleporting(40.0, 0.0, 40.00045, 0.0, 5000)).toBe(false);
  });

  it('detecta teleportación a 1km en 1 segundo', () => {
    expect(isTeleporting(40.0, 0.0, 40.009, 0.0, 1000)).toBe(true);
  });
});
