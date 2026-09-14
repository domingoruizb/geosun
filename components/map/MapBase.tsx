'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Map, NavigationControl, AttributionControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_CENTER: [number, number] = [-3.7038, 40.4168];
const INITIAL_ZOOM = 15;

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    'carto-dark': {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors, © CartoDB',
    },
  },
  layers: [{ id: 'carto-dark-layer', type: 'raster' as const, source: 'carto-dark' }],
};

export interface MapBaseHandle {
  map: Map | null;
  flyTo: (center: [number, number], zoom?: number) => void;
}

interface MapBaseProps {
  children?: React.ReactNode;
  className?: string;
  onLoad?: (map: Map) => void;
}

export const MapBase = forwardRef<MapBaseHandle, MapBaseProps>(function MapBase(
  { children, className = '', onLoad },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useImperativeHandle(ref, () => ({
    get map() {
      return mapRef.current;
    },
    flyTo(center, zoom = 16) {
      mapRef.current?.flyTo({ center, zoom, duration: 800 });
    },
  }));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      attributionControl: false,
    });

    map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;
      onLoad?.(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`relative h-full w-full ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      {children}
    </div>
  );
});
