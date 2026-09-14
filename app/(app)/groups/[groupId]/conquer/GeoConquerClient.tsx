'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createClient } from '@/lib/supabase/client';
import { MapBase, MapBaseHandle } from '@/components/map/MapBase';
import { ConquerGrid, CellData } from '@/components/map/ConquerGrid';
import { UserMarker } from '@/components/map/UserMarker';
import { ConquerLeaderboard } from '@/components/ranking/ConquerLeaderboard';
import { useGeolocation, GeoPosition } from '@/lib/useGeolocation';
import { lngLatToCellIndex } from '@/lib/geoconquer';
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react';

interface RankingEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  colorHue: number;
  cellsOwned: number;
}

interface RankingRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  color_hue: number;
  cells_owned: number;
}

interface GeoConquerClientProps {
  groupId: string;
  currentUserId: string;
  initialRanking: RankingEntry[];
  members: { userId: string; colorHue: number; username: string; avatarUrl: string | null }[];
}

const FLUSH_INTERVAL_MS = 30_000;

type SupabaseClient = ReturnType<typeof createClient>;

async function rpcCall<T>(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: unknown }> {
  return (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: T | null; error: unknown }>)(fn, args);
}

export function GeoConquerClient({ groupId, currentUserId, initialRanking }: GeoConquerClientProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [myPosition, setMyPosition] = useState<GeoPosition | null>(null);
  const [cells, setCells] = useState<CellData[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>(initialRanking);
  const [showRanking, setShowRanking] = useState(false);
  const mapRef = useRef<MapBaseHandle>(null);
  const supabase = createClient();

  const cellSessionRef = useRef<{
    cellX: number;
    cellY: number;
    enteredAt: number;
    lastFlushedAt: number;
  } | null>(null);

  const flushCellTime = useCallback(
    async (cellX: number, cellY: number, deltaSeconds: number) => {
      if (deltaSeconds <= 0) return;
      await rpcCall(supabase, 'upsert_cell_occupancy', {
        p_cell_x: cellX,
        p_cell_y: cellY,
        p_group_id: groupId,
        p_delta_seconds: deltaSeconds,
      });
    },
    [groupId, supabase],
  );

  const handlePosition = useCallback(
    async (pos: GeoPosition) => {
      setMyPosition(pos);
      const now = Date.now();
      const { cellX, cellY } = lngLatToCellIndex(pos.longitude, pos.latitude);
      const session = cellSessionRef.current;

      if (!session) {
        cellSessionRef.current = { cellX, cellY, enteredAt: now, lastFlushedAt: now };
        return;
      }

      const sameCell = cellX === session.cellX && cellY === session.cellY;
      if (!sameCell) {
        const delta = Math.floor((now - session.lastFlushedAt) / 1000);
        await flushCellTime(session.cellX, session.cellY, delta);
        cellSessionRef.current = { cellX, cellY, enteredAt: now, lastFlushedAt: now };
      } else if (now - session.lastFlushedAt >= FLUSH_INTERVAL_MS) {
        const delta = Math.floor((now - session.lastFlushedAt) / 1000);
        await flushCellTime(cellX, cellY, delta);
        cellSessionRef.current = { ...session, lastFlushedAt: now };
      }
    },
    [flushCellTime],
  );

  useGeolocation({ onPosition: handlePosition, throttleMs: 5000 });

  useEffect(() => {
    if (myPosition && mapRef.current) {
      mapRef.current.flyTo([myPosition.longitude, myPosition.latitude], 17);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPosition?.latitude, myPosition?.longitude]);

  const loadCellsInView = useCallback(
    async (map: MapLibreMap) => {
      const bounds = map.getBounds();
      const { data } = await rpcCall<CellData[]>(supabase, 'get_cells_in_bbox', {
        p_group_id: groupId,
        p_sw_lng: bounds.getWest(),
        p_sw_lat: bounds.getSouth(),
        p_ne_lng: bounds.getEast(),
        p_ne_lat: bounds.getNorth(),
      });
      if (data) setCells(data);
    },
    [groupId, supabase],
  );

  const handleMapLoad = useCallback(
    (map: MapLibreMap) => {
      setMapInstance(map);
      setMapLoaded(true);
      map.on('moveend', () => loadCellsInView(map));
      loadCellsInView(map);
    },
    [loadCellsInView],
  );

  useEffect(() => {
    const channel = supabase
      .channel(`group:${groupId}:conquer`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cell_occupancy', filter: `group_id=eq.${groupId}` },
        async () => {
          const { data } = (await supabase
            .from('conquer_ranking')
            .select('user_id, username, avatar_url, color_hue, cells_owned')
            .eq('group_id', groupId)
            .order('cells_owned', { ascending: false })
            .limit(10)) as unknown as { data: RankingRow[] | null };

          if (data) {
            setRanking(
              data.map((r) => ({
                userId: r.user_id,
                username: r.username,
                avatarUrl: r.avatar_url,
                colorHue: r.color_hue,
                cellsOwned: r.cells_owned,
              })),
            );
          }
          if (mapInstance) loadCellsInView(mapInstance);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, mapInstance, loadCellsInView, supabase]);

  useEffect(() => {
    return () => {
      const session = cellSessionRef.current;
      if (session) {
        const delta = Math.floor((Date.now() - session.lastFlushedAt) / 1000);
        flushCellTime(session.cellX, session.cellY, delta);
      }
    };
  }, [flushCellTime]);

  const myRank = ranking.findIndex((r) => r.userId === currentUserId);
  const myCells = ranking.find((r) => r.userId === currentUserId)?.cellsOwned ?? 0;

  return (
    <div className="relative h-full w-full">
      <MapBase ref={mapRef} onLoad={handleMapLoad} />

      {mapLoaded && mapInstance && myPosition && (
        <UserMarker
          map={mapInstance}
          latitude={myPosition.latitude}
          longitude={myPosition.longitude}
          accuracy={myPosition.accuracy}
        />
      )}

      {mapLoaded && mapInstance && <ConquerGrid map={mapInstance} cells={cells} />}

      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="flex items-center justify-between bg-slate-900/95 px-4 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            <span className="text-sm text-slate-300">
              {myCells > 0
                ? `${myCells} celda${myCells > 1 ? 's' : ''} · Puesto ${myRank + 1}`
                : 'Empieza a conquistar celdas'}
            </span>
          </div>
          <button
            onClick={() => setShowRanking((v) => !v)}
            className="flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
          >
            Ranking
            {showRanking ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
        </div>

        {showRanking && (
          <div className="max-h-64 overflow-y-auto border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm">
            <ConquerLeaderboard ranking={ranking} currentUserId={currentUserId} />
          </div>
        )}
      </div>
    </div>
  );
}
