'use client';

import { useEffect, useRef } from 'react';
import { Map, Marker } from 'maplibre-gl';

interface MemberMarkerProps {
  map: Map;
  userId: string;
  latitude: number;
  longitude: number;
  username: string;
  avatarUrl?: string | null;
  colorHue: number;
}

export function MemberMarker({ map, userId, latitude, longitude, username, avatarUrl, colorHue }: MemberMarkerProps) {
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    const color = `hsl(${colorHue} 70% 55%)`;
    const initial = username[0]?.toUpperCase() ?? '?';

    const el = document.createElement('div');
    el.className = 'member-marker';
    el.dataset.userId = userId;
    el.innerHTML = avatarUrl
      ? `<img src="${avatarUrl}" alt="${username}" class="member-avatar-img" />`
      : `<span class="member-avatar-letter" style="background:${color}">${initial}</span>`;

    const tooltip = document.createElement('div');
    tooltip.className = 'member-tooltip';
    tooltip.textContent = username;
    el.appendChild(tooltip);

    if (!markerRef.current) {
      markerRef.current = new Marker({ element: el, anchor: 'center' })
        .setLngLat([longitude, latitude])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([longitude, latitude]);
    }
  }, [map, userId, latitude, longitude, username, avatarUrl, colorHue]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, []);

  return null;
}
