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
  // Lazy initializer: detecta soporte en el momento de montar el componente,
  // sin necesidad de llamar setState dentro de ningún efecto.
  const [supported] = useState<boolean>(
    () => typeof navigator !== 'undefined' && 'geolocation' in navigator,
  );
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

  // El efecto declara todas sus dependencias dinámicas explícitamente.
  // watchPosition se re-registra si cambian onPosition/onError/throttleMs,
  // lo cual es correcto: los callers usan useCallback para estabilizarlos.
  // Ningún setState se llama de forma síncrona en el cuerpo del efecto;
  // setActive solo se invoca dentro de los callbacks asíncronos de la API.
  useEffect(() => {
    if (!supported) return;

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

        // setState dentro de un callback asíncrono: no viola la regla
        setActive(true);
        onPosition(pos);
      },
      (err) => {
        setActive(false);
        onError?.(err);
      },
      { enableHighAccuracy: true, maximumAge: 0 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [supported, onPosition, onError, throttleMs]);

  return { supported, active, stop };
}
