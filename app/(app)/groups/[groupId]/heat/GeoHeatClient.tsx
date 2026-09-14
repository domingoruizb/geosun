'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { MapBase, MapBaseHandle } from '@/components/map/MapBase';
import { HeatmapLayer } from '@/components/map/HeatmapLayer';
import { createClient } from '@/lib/supabase/client';
import { Flame } from 'lucide-react';

interface HeatPoint {
  longitude: number;
  latitude: number;
}

interface LocationRow {
  geom: string;
}

interface RealtimeLocationRow {
  geom: string;
}

interface GeoHeatClientProps {
  groupId: string;
  initialPoints: HeatPoint[];
}

const MAX_POINTS_PER_FETCH = 500;

function parseGeomPoint(geom: string): HeatPoint | null {
  const match = geom?.toString().match(/POINT\(([^ ]+) ([^ )]+)\)/);
  if (!match) return null;
  return { longitude: parseFloat(match[1]), latitude: parseFloat(match[2]) };
}

export function GeoHeatClient({ groupId, initialPoints }: GeoHeatClientProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [points, setPoints] = useState<HeatPoint[]>(initialPoints);
  const [pointCount, setPointCount] = useState(initialPoints.length);
  const mapRef = useRef<MapBaseHandle>(null);
  const supabase = createClient();

  const loadPointsInView = useCallback(
    async (map: MapLibreMap) => {
      const bounds = map.getBounds();

      const { data } = (await supabase
        .from('location_logs')
        .select('geom')
        .eq('group_id', groupId)
        .order('recorded_at', { ascending: false })
        .limit(MAX_POINTS_PER_FETCH)) as { data: LocationRow[] | null };

      if (!data) return;

      const newPoints = data
        .map((row) => {
          const pt = parseGeomPoint(row.geom);
          if (!pt) return null;
          if (
            pt.longitude < bounds.getWest() ||
            pt.longitude > bounds.getEast() ||
            pt.latitude < bounds.getSouth() ||
            pt.latitude > bounds.getNorth()
          )
            return null;
          return pt;
        })
        .filter(Boolean) as HeatPoint[];

      setPoints(newPoints);
      setPointCount(newPoints.length);
    },
    [groupId, supabase],
  );

  const handleMapLoad = useCallback(
    (map: MapLibreMap) => {
      setMapInstance(map);
      setMapLoaded(true);
      map.on('moveend', () => loadPointsInView(map));
    },
    [loadPointsInView],
  );

  useEffect(() => {
    const channel = supabase
      .channel(`group:${groupId}:heat`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_logs',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const row = payload.new as RealtimeLocationRow;
          const pt = parseGeomPoint(row.geom);
          if (!pt) return;
          setPoints((prev) => [...prev.slice(-1999), pt]);
          setPointCount((n) => n + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, supabase]);

  return (
    <div className="relative h-full w-full">
      <MapBase ref={mapRef} onLoad={handleMapLoad} />

      {mapLoaded && mapInstance && <HeatmapLayer map={mapInstance} points={points} />}

      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl bg-slate-900/90 px-3 py-2 text-sm text-slate-300 shadow-lg ring-1 ring-slate-700 backdrop-blur-sm">
        <Flame className="h-4 w-4 text-orange-400" />
        <span>{pointCount.toLocaleString('es')} puntos</span>
      </div>
    </div>
  );
}
