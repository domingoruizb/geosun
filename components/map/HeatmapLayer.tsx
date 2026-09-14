'use client';

import { useEffect, useRef } from 'react';
import { Map, GeoJSONSource } from 'maplibre-gl';

interface HeatPoint {
  longitude: number;
  latitude: number;
}

interface HeatmapLayerProps {
  map: Map;
  points: HeatPoint[];
}

const SOURCE_ID = 'heatmap-source';
const LAYER_ID = 'heatmap-layer';

export function HeatmapLayer({ map, points }: HeatmapLayerProps) {
  const layerAdded = useRef(false);

  useEffect(() => {
    if (!map.isStyleLoaded()) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: {},
      })),
    };

    if (!layerAdded.current) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });
      map.addLayer({
        id: LAYER_ID,
        type: 'heatmap',
        source: SOURCE_ID,
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 18, 2],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(33,102,172,0)',
            0.2,
            'rgb(103,169,207)',
            0.4,
            'rgb(209,229,240)',
            0.6,
            'rgb(253,219,199)',
            0.8,
            'rgb(239,138,98)',
            1,
            'rgb(178,24,43)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 18, 25],
          'heatmap-opacity': 0.75,
        },
      });
      layerAdded.current = true;
    } else {
      (map.getSource(SOURCE_ID) as GeoJSONSource)?.setData(geojson);
    }
  }, [map, points]);

  useEffect(() => {
    return () => {
      if (layerAdded.current) {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        layerAdded.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
