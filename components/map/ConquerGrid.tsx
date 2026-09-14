'use client';

import { useEffect, useRef } from 'react';
import { Map, GeoJSONSource } from 'maplibre-gl';
import { cellIndexToBBox } from '@/lib/geoconquer';

export interface CellData {
  cell_x: number;
  cell_y: number;
  owner_id: string;
  color_hue: number;
  seconds_total: number;
}

interface ConquerGridProps {
  map: Map;
  cells: CellData[];
}

const SOURCE_ID = 'conquer-cells-source';
const FILL_LAYER = 'conquer-cells-fill';
const LINE_LAYER = 'conquer-cells-line';

// Incluimos el color HSL precomputado en las propiedades del GeoJSON
// para evitar limitaciones del tipo MapLibre con expresiones 'hsl'
function cellsToGeoJSON(cells: CellData[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map((cell) => {
      const b = cellIndexToBBox(cell.cell_x, cell.cell_y);
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [b.swLng, b.swLat],
              [b.neLng, b.swLat],
              [b.neLng, b.neLat],
              [b.swLng, b.neLat],
              [b.swLng, b.swLat],
            ],
          ],
        },
        properties: {
          ownerId: cell.owner_id,
          fillColor: `hsl(${cell.color_hue}, 75%, 55%)`,
          lineColor: `hsl(${cell.color_hue}, 75%, 40%)`,
          secondsTotal: cell.seconds_total,
        },
      };
    }),
  };
}

export function ConquerGrid({ map, cells }: ConquerGridProps) {
  const layersAdded = useRef(false);

  useEffect(() => {
    if (!map.isStyleLoaded()) return;

    const geojson = cellsToGeoJSON(cells);

    if (!layersAdded.current) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });
      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': ['get', 'fillColor'] as unknown as string,
          'fill-opacity': 0.35,
        },
      });
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': ['get', 'lineColor'] as unknown as string,
          'line-width': 1,
          'line-opacity': 0.7,
        },
      });
      layersAdded.current = true;
    } else {
      (map.getSource(SOURCE_ID) as GeoJSONSource)?.setData(geojson);
    }
  }, [map, cells]);

  useEffect(() => {
    return () => {
      if (layersAdded.current) {
        if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER);
        if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        layersAdded.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
