'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { isTeleporting } from './geoconquer';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  timestamp: number;
}

interface UseGeolocationOptions {
  onPosition: (pos: GeoPosition) => void;
  onError?: (err: GeolocationPositionError) => void;
  throttleMs?: number;
}

export function useGeolocation({ onPosition, onError, throttleMs = 5000 }: UseGeolocationOptions) {
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);
  const lastCallRef = useRef<number>(0);
  const prevPosRef = useRef<GeoPosition | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setActive(false);
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setSupported(false);
      return;
    }

    setActive(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (raw) => {
        const now = Date.now();
        if (now - lastCallRef.current < throttleMs) return;

        const pos: GeoPosition = {
          latitude: raw.coords.latitude,
          longitude: raw.coords.longitude,
          accuracy: raw.coords.accuracy,
          altitude: raw.coords.altitude,
          speed: raw.coords.speed,
          timestamp: raw.timestamp,
        };

        const prev = prevPosRef.current;
        if (prev) {
          const dtMs = pos.timestamp - prev.timestamp;
          if (isTeleporting(prev.latitude, prev.longitude, pos.latitude, pos.longitude, dtMs)) {
            return;
          }
        }

        prevPosRef.current = pos;
        lastCallRef.current = now;
        onPosition(pos);
      },
      (err) => onError?.(err),
      { enableHighAccuracy: true, maximumAge: 0 },
    );
  }, [onPosition, onError, throttleMs]);

  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { supported, active, stop, start };
}
