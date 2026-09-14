'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createClient } from '@/lib/supabase/client';
import { MapBase, MapBaseHandle } from '@/components/map/MapBase';
import { UserMarker } from '@/components/map/UserMarker';
import { MemberMarker } from '@/components/map/MemberMarker';
import { useGeolocation, GeoPosition } from '@/lib/useGeolocation';
import { Crosshair, WifiOff, Locate } from 'lucide-react';

interface Member {
  userId: string;
  colorHue: number;
  username: string;
  avatarUrl: string | null;
}

interface MemberLocation {
  userId: string;
  latitude: number;
  longitude: number;
}

interface RealtimeLocationRow {
  user_id: string;
  geom: string;
}

interface GeoLiveClientProps {
  groupId: string;
  currentUserId: string;
  members: Member[];
}

export function GeoLiveClient({ groupId, currentUserId, members }: GeoLiveClientProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [myPosition, setMyPosition] = useState<GeoPosition | null>(null);
  const [memberLocations, setMemberLocations] = useState<Record<string, MemberLocation>>({});
  const [geoError, setGeoError] = useState(false);
  const mapRef = useRef<MapBaseHandle>(null);
  const supabase = createClient();

  const handlePosition = useCallback(
    async (pos: GeoPosition) => {
      setMyPosition(pos);
      setGeoError(false);

      await supabase.from('location_logs').insert({
        user_id: currentUserId,
        group_id: groupId,
        geom: `POINT(${pos.longitude} ${pos.latitude})`,
        accuracy: pos.accuracy,
        altitude: pos.altitude,
        speed: pos.speed,
      } as never);
    },
    [currentUserId, groupId, supabase],
  );

  const handleGeoError = useCallback(() => setGeoError(true), []);

  useGeolocation({ onPosition: handlePosition, onError: handleGeoError, throttleMs: 5000 });

  useEffect(() => {
    if (myPosition && mapRef.current) {
      mapRef.current.flyTo([myPosition.longitude, myPosition.latitude], 16);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPosition?.latitude, myPosition?.longitude]);

  useEffect(() => {
    const channel = supabase
      .channel(`group:${groupId}:locations`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'location_logs', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = payload.new as RealtimeLocationRow;
          if (row.user_id === currentUserId) return;

          const match = row.geom?.toString().match(/POINT\(([^ ]+) ([^ )]+)\)/);
          if (!match) return;

          setMemberLocations((prev) => ({
            ...prev,
            [row.user_id]: {
              userId: row.user_id,
              latitude: parseFloat(match[2]),
              longitude: parseFloat(match[1]),
            },
          }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, currentUserId, supabase]);

  const otherMembers = members.filter((m) => m.userId !== currentUserId);

  return (
    <div className="relative h-full w-full">
      <MapBase
        ref={mapRef}
        onLoad={(m) => {
          setMapInstance(m);
          setMapLoaded(true);
        }}
      >
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
          <button
            onClick={() => myPosition && mapRef.current?.flyTo([myPosition.longitude, myPosition.latitude], 17)}
            disabled={!myPosition}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/90 text-slate-300 shadow-lg ring-1 ring-slate-700 backdrop-blur-sm transition hover:text-white disabled:opacity-40"
            title="Centrar en mi posición"
          >
            <Locate className="h-4 w-4" />
          </button>
        </div>

        {geoError && (
          <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-red-900/90 px-3 py-2 text-sm text-red-200 shadow-lg ring-1 ring-red-700 backdrop-blur-sm">
            <WifiOff className="h-4 w-4" />
            GPS no disponible
          </div>
        )}

        {!myPosition && !geoError && (
          <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900/90 px-3 py-2 text-sm text-slate-300 shadow-lg ring-1 ring-slate-700 backdrop-blur-sm">
            <Crosshair className="h-4 w-4 animate-spin" />
            Obteniendo ubicación...
          </div>
        )}
      </MapBase>

      {mapLoaded && mapInstance && myPosition && (
        <UserMarker
          map={mapInstance}
          latitude={myPosition.latitude}
          longitude={myPosition.longitude}
          accuracy={myPosition.accuracy}
        />
      )}

      {mapLoaded &&
        mapInstance &&
        otherMembers.map((m) => {
          const loc = memberLocations[m.userId];
          if (!loc) return null;
          return (
            <MemberMarker
              key={m.userId}
              map={mapInstance}
              userId={m.userId}
              latitude={loc.latitude}
              longitude={loc.longitude}
              username={m.username}
              avatarUrl={m.avatarUrl}
              colorHue={m.colorHue}
            />
          );
        })}
    </div>
  );
}
