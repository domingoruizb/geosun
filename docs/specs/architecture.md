# Geosun — Arquitectura del Sistema

## 1. Visión General

Geosun es una Progressive Web App (PWA) colaborativa de geolocalización social en tiempo real. Permite a grupos cerrados de amigos compartir su ubicación en vivo, conquistar territorio mediante tiempo de permanencia, visualizar patrones de movimiento agregados y comunicarse mediante un chat reactivo.

**Restricción clave:** coste de infraestructura 0 €, aprovechando los free tiers de Supabase y Vercel.

---

## 2. Stack Técnico

| Capa | Tecnología | Justificación |
|---|---|---|
| Framework UI | Next.js 14 (App Router, TypeScript) | SSR/SSG, PWA-ready, ecosistema robusto |
| Estilos | Tailwind CSS + Lucide Icons | Utilidades atómicas, bundle mínimo |
| Mapas | MapLibre GL JS | Open-source, compatible con OSM y CartoDB |
| Tiles de mapa | OpenStreetMap / CartoDB Voyager | Free tier, sin API key requerida |
| BaaS | Supabase (Auth + PostgreSQL + Realtime) | Free tier generoso, RLS nativo, WebSockets |
| Base de datos | PostgreSQL 15 + PostGIS | Índices espaciales GIST, queries geo |
| Testing unitario | Vitest + Testing Library | Compatible con Next.js, rápido |
| Testing E2E | Playwright | Multi-browser, CI-friendly |
| CI/CD | GitHub Actions + Vercel | Free tier, deploy automático |
| Hosting | Vercel | Free tier ilimitado para hobby |

---

## 3. Módulos Funcionales

```
┌─────────────────────────────────────────────────────────┐
│                      GEOSUN PWA                         │
├──────────────┬──────────────┬──────────────┬────────────┤
│   Grupos     │   GeoChat    │   GeoLive    │ GeoConquer │
│  & Perfiles  │  (Realtime)  │  (Mapa live) │  (Celdas)  │
│              │              │              │            │
│   GeoHeat    │              │              │            │
│  (Heatmap)   │              │              │            │
└──────────────┴──────────────┴──────────────┴────────────┘
```

### 3.1 Gestión de Grupos y Roles
- Creación de grupos con código de invitación único (nanoid, 8 chars).
- Roles: `owner` | `admin` | `member`.
- Código de invitación expira o puede ser revocado por el owner.
- Cada miembro tiene un color identificativo único dentro del grupo (paleta de 12 colores HSL).

### 3.2 GeoChat
- Chat grupal con mensajes en tiempo real vía Supabase Realtime (canal por `group_id`).
- Soporta mensajes de texto y mensajes de sistema (entrada/salida de miembros).
- Paginación de historial con scroll infinito hacia arriba.

### 3.3 GeoLive
- Streaming de geolocalización del usuario local con `navigator.geolocation.watchPosition`.
- Usuario local: círculo azul radiante con radio de precisión (semitransparente).
- Otros miembros: avatar circular superpuesto en sus coordenadas actuales.
- Actualización de posición enviada a Supabase `location_logs` y canal Realtime.
- Throttle de envío: máximo 1 update cada 5 segundos para preservar quota.

### 3.4 GeoHeat
- Capa de calor (heatmap) sobre MapLibre usando el historial acumulado de `location_logs`.
- Los datos se agregan por sesión de mapa (no se cargan todos en memoria).
- Renderizado client-side con `maplibre-gl` layer type `heatmap`.

### 3.5 GeoConquer
- Cuadrícula de celdas de 100m × 100m proyectada en el mapa.
- Discretización de coordenadas GPS a índice de celda (ver `geoconquer-algorithm.md`).
- Ownership: miembro del grupo con mayor tiempo acumulado en la celda.
- Tabla de ranking en tiempo real (top 10 por celdas dominadas).
- Las celdas se pintan con el color identificativo del dueño actual.

---

## 4. Flujo de Datos

### 4.1 Autenticación
```
Usuario → Supabase Auth (Magic Link / OAuth) → JWT almacenado en cookie httpOnly
→ Next.js Middleware verifica JWT en cada request protegido
```

### 4.2 Geolocalización en Tiempo Real (GeoLive)
```
Browser GPS API (watchPosition)
  ↓ [cada 5s, throttled]
Next.js API Route /api/location/update
  ↓
Supabase: INSERT into location_logs (user_id, group_id, geom, accuracy, timestamp)
  ↓ [trigger Postgres → Realtime broadcast]
Supabase Realtime channel "group:{group_id}:locations"
  ↓
Todos los clientes conectados → actualización del marker en MapLibre
```

### 4.3 GeoConquer — Escritura
```
Browser GPS API
  ↓ [cada 5s]
Calcula cell_id en client (algoritmo discretización)
  ↓ [solo si cell_id cambió]
Supabase: UPSERT into cell_occupancy (user_id, group_id, cell_id, seconds_in_cell)
  ↓ [Postgres trigger recalcula owner]
Supabase Realtime → actualización del ranking y celdas en mapa
```

### 4.4 GeoChat
```
Usuario escribe mensaje
  ↓
Supabase: INSERT into messages (group_id, user_id, content)
  ↓ [Supabase Realtime Postgres Changes]
Canal "group:{group_id}:messages" → todos los clientes reciben el mensaje
```

---

## 5. Diagrama de Componentes (Next.js App Router)

```
app/
├── (auth)/
│   ├── login/page.tsx           # Magic Link / OAuth login
│   └── callback/route.ts        # Supabase OAuth callback
├── (app)/
│   ├── layout.tsx               # Shell: sidebar nav + auth guard
│   ├── dashboard/page.tsx       # Lista de grupos del usuario
│   ├── groups/
│   │   ├── new/page.tsx         # Crear nuevo grupo
│   │   └── [groupId]/
│   │       ├── layout.tsx       # Tabs: Chat | Live | Heat | Conquer
│   │       ├── chat/page.tsx    # GeoChat
│   │       ├── live/page.tsx    # GeoLive (mapa)
│   │       ├── heat/page.tsx    # GeoHeat (mapa heatmap)
│   │       └── conquer/page.tsx # GeoConquer (mapa celdas + ranking)
│   └── profile/page.tsx         # Perfil de usuario
├── api/
│   ├── location/update/route.ts # POST: upsert location
│   └── groups/invite/route.ts   # POST: validar/generar invite code
└── layout.tsx                   # Root layout (PWA meta, manifest)
```

### Componentes Compartidos
```
components/
├── map/
│   ├── MapBase.tsx              # Wrapper MapLibre GL con tema OSM
│   ├── UserMarker.tsx           # Círculo azul radiante (usuario local)
│   ├── MemberMarker.tsx         # Avatar circular de miembro
│   ├── HeatmapLayer.tsx         # Capa heatmap MapLibre
│   └── ConquerGrid.tsx          # Capa de celdas GeoConquer
├── chat/
│   ├── ChatWindow.tsx           # Contenedor scroll infinito
│   ├── MessageBubble.tsx        # Burbuja de mensaje
│   └── MessageInput.tsx         # Input con envío por Enter
├── groups/
│   ├── GroupCard.tsx            # Tarjeta en dashboard
│   ├── InviteModal.tsx          # Modal con código QR
│   └── MemberList.tsx           # Lista de miembros con estado online
├── ranking/
│   └── ConquerLeaderboard.tsx   # Tabla de clasificación
└── ui/                          # Primitivas: Button, Avatar, Badge, etc.
```

---

## 6. Estrategia de Seguridad (Row Level Security)

Toda escritura y lectura pasa por las políticas RLS de PostgreSQL. El JWT del usuario autenticado determina qué filas puede ver o modificar. Ninguna tabla es accesible sin autenticación excepto la validación de códigos de invitación.

Ver políticas detalladas en `database-schema.sql`.

---

## 7. PWA: Service Worker y Manifiesto

- `next-pwa` (con Workbox) para service worker automático.
- Estrategia de caché: `NetworkFirst` para API routes, `CacheFirst` para assets estáticos y tiles de mapa.
- Manifesto en `public/manifest.json` con iconos, `display: standalone`, `theme_color`.
- Geolocalización solo funciona en contextos seguros (HTTPS — cubierto por Vercel).

---

## 8. Consideraciones de Rendimiento y Cuota (Free Tier)

| Recurso Supabase | Límite Free | Estrategia Geosun |
|---|---|---|
| DB rows | 500 MB | TTL: `location_logs` > 30 días se eliminan (cron job) |
| Realtime messages | 2M/mes | Throttle 5s en geolocalización, agrupación de mensajes |
| Auth MAU | 50,000 | Grupos cerrados, crecimiento orgánico |
| Storage | 1 GB | Solo avatares redimensionados (max 100KB) |
| Edge Functions | 500K/mes | Solo 2 funciones críticas |

---

## 9. Variables de Entorno

Ver `.env.example` en la raíz del proyecto para la lista completa de variables necesarias.
