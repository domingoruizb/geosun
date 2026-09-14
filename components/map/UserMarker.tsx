'use client';

import { useEffect, useRef } from 'react';
import { Map, Marker, GeoJSONSource } from 'maplibre-gl';

interface UserMarkerProps {
  map: Map;
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function UserMarker({ map, latitude, longitude, accuracy }: UserMarkerProps) {
  const markerRef = useRef<Marker | null>(null);
  const accuracyAdded = useRef(false);

  useEffect(() => {
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = `<div class="user-dot-ring"></div><div class="user-dot"></div>`;
      markerRef.current = new Marker({ element: el, anchor: 'center' })
        .setLngLat([longitude, latitude])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([longitude, latitude]);
    }
  }, [map, latitude, longitude]);

  useEffect(() => {
    if (!map.isStyleLoaded()) return;

    const sourceId = 'user-accuracy-source';
    const layerId = 'user-accuracy-layer';
    const geojson: GeoJSON.Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [longitude, latitude] },
      properties: {},
    };

    if (!accuracyAdded.current) {
      map.addSource(sourceId, { type: 'geojson', data: geojson });
      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          // circle-radius en píxeles aproximado para la precisión GPS
          'circle-radius': [
            'interpolate', ['exponential', 2], ['zoom'],
            0, 0,
            20, accuracy / 0.1,
          ] as unknown as number,
          'circle-color': '#3b82f6',
          'circle-opacity': 0.12,
          'circle-stroke-color': '#3b82f6',
          'circle-stroke-width': 1,
          'circle-stroke-opacity': 0.3,
        },
      });
      accuracyAdded.current = true;
    } else {
      (map.getSource(sourceId) as GeoJSONSource)?.setData(geojson);
    }
  }, [map, latitude, longitude, accuracy]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      if (accuracyAdded.current) {
        if (map.getLayer('user-accuracy-layer')) map.removeLayer('user-accuracy-layer');
        if (map.getSource('user-accuracy-source')) map.removeSource('user-accuracy-source');
        accuracyAdded.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
