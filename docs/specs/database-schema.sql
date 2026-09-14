-- =============================================================================
-- GEOSUN — Esquema de Base de Datos
-- PostgreSQL 15 + PostGIS
-- =============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_cron";       -- Para limpieza periódica de logs

-- =============================================================================
-- TABLA: profiles
-- Extiende auth.users de Supabase con datos públicos del perfil
-- =============================================================================
CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username    TEXT NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 3 AND 30),
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- TABLA: groups
-- Grupos cerrados de amigos
-- =============================================================================
CREATE TABLE public.groups (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
    description     TEXT CHECK (char_length(description) <= 200),
    invite_code     TEXT NOT NULL UNIQUE,           -- 8 chars nanoid
    invite_expires_at TIMESTAMPTZ,                  -- NULL = nunca expira
    owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER groups_set_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_groups_invite_code ON public.groups (invite_code);
CREATE INDEX idx_groups_owner_id    ON public.groups (owner_id);

-- =============================================================================
-- TABLA: group_members
-- Relación usuario-grupo con rol y color identificativo
-- =============================================================================
CREATE TYPE public.group_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.group_members (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role        public.group_role NOT NULL DEFAULT 'member',
    -- Color HSL identificativo dentro del grupo (0-360 hue, sa=80%, l=55%)
    color_hue   SMALLINT NOT NULL CHECK (color_hue BETWEEN 0 AND 359),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_group_id ON public.group_members (group_id);
CREATE INDEX idx_group_members_user_id  ON public.group_members (user_id);

-- =============================================================================
-- TABLA: messages
-- Mensajes del GeoChat por grupo
-- =============================================================================
CREATE TYPE public.message_type AS ENUM ('text', 'system');

CREATE TABLE public.messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,  -- NULL en mensajes de sistema
    type        public.message_type NOT NULL DEFAULT 'text',
    content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para paginación de chat (más recientes primero por grupo)
CREATE INDEX idx_messages_group_created ON public.messages (group_id, created_at DESC);

-- =============================================================================
-- TABLA: location_logs
-- Historial de posiciones GPS de los miembros
-- PostGIS: geometría punto en WGS84 (SRID 4326)
-- =============================================================================
CREATE TABLE public.location_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    -- Punto geométrico: ST_MakePoint(longitude, latitude)
    geom        GEOMETRY(Point, 4326) NOT NULL,
    accuracy    REAL,       -- metros de precisión del GPS
    altitude    REAL,       -- metros sobre el nivel del mar (nullable)
    speed       REAL,       -- m/s (nullable)
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice espacial GIST para queries geográficas
CREATE INDEX idx_location_logs_geom        ON public.location_logs USING GIST (geom);
-- Índice compuesto para consultas por usuario+grupo+tiempo
CREATE INDEX idx_location_logs_user_group  ON public.location_logs (user_id, group_id, recorded_at DESC);
-- Índice para GeoHeat: todos los puntos de un grupo en un rango de tiempo
CREATE INDEX idx_location_logs_group_time  ON public.location_logs (group_id, recorded_at DESC);

-- TTL: eliminar logs con más de 30 días (ejecutado por pg_cron)
-- Configurar en Supabase Dashboard > Database > Cron Jobs:
-- SELECT cron.schedule('cleanup-old-location-logs', '0 3 * * *',
--   $$DELETE FROM public.location_logs WHERE recorded_at < now() - INTERVAL '30 days'$$);

-- =============================================================================
-- TABLA: cells
-- Definición de celdas GeoConquer (100m x 100m)
-- Las celdas se identifican por índices discretos (cell_x, cell_y)
-- derivados del algoritmo de discretización (ver geoconquer-algorithm.md)
-- =============================================================================
CREATE TABLE public.cells (
    id          BIGSERIAL PRIMARY KEY,
    -- Índices de celda en la cuadrícula global
    cell_x      INTEGER NOT NULL,
    cell_y      INTEGER NOT NULL,
    -- Geometría del polígono de la celda (para visualización en el mapa)
    geom        GEOMETRY(Polygon, 4326),
    UNIQUE (cell_x, cell_y)
);

CREATE INDEX idx_cells_xy   ON public.cells (cell_x, cell_y);
CREATE INDEX idx_cells_geom ON public.cells USING GIST (geom);

-- =============================================================================
-- TABLA: cell_occupancy
-- Tiempo acumulado de cada usuario en cada celda por grupo
-- Esta tabla determina quién "conquista" cada celda
-- =============================================================================
CREATE TABLE public.cell_occupancy (
    id              BIGSERIAL PRIMARY KEY,
    cell_x          INTEGER NOT NULL,
    cell_y          INTEGER NOT NULL,
    group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- Tiempo acumulado en segundos
    seconds_total   INTEGER NOT NULL DEFAULT 0 CHECK (seconds_total >= 0),
    -- Última vez que se actualizó el contador (para calcular delta)
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Desnormalización: indica si este usuario es el actual owner de la celda en el grupo
    is_owner        BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (cell_x, cell_y, group_id, user_id)
);

-- Índice principal para consultas de ownership por grupo
CREATE INDEX idx_cell_occupancy_group    ON public.cell_occupancy (group_id, cell_x, cell_y);
-- Índice para ranking: celdas dominadas por usuario en grupo
CREATE INDEX idx_cell_occupancy_user     ON public.cell_occupancy (group_id, user_id) WHERE is_owner = true;
-- Índice para actualización de posición activa
CREATE INDEX idx_cell_occupancy_user_group ON public.cell_occupancy (user_id, group_id);

-- Función que recalcula is_owner al hacer UPSERT en cell_occupancy
CREATE OR REPLACE FUNCTION public.recalculate_cell_owner()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_max_user_id UUID;
    v_max_seconds INTEGER;
BEGIN
    -- Encontrar el usuario con más segundos en esta celda dentro del grupo
    SELECT user_id, seconds_total
    INTO v_max_user_id, v_max_seconds
    FROM public.cell_occupancy
    WHERE cell_x = NEW.cell_x
      AND cell_y = NEW.cell_y
      AND group_id = NEW.group_id
    ORDER BY seconds_total DESC, last_seen_at ASC
    LIMIT 1;

    -- Actualizar is_owner para todos los usuarios de esa celda+grupo
    UPDATE public.cell_occupancy
    SET is_owner = (user_id = v_max_user_id)
    WHERE cell_x = NEW.cell_x
      AND cell_y = NEW.cell_y
      AND group_id = NEW.group_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER cell_occupancy_recalculate_owner
    AFTER INSERT OR UPDATE OF seconds_total ON public.cell_occupancy
    FOR EACH ROW EXECUTE FUNCTION public.recalculate_cell_owner();

-- Vista materializada para el ranking de GeoConquer (se refresca periódicamente)
-- En producción se puede refrescar con un trigger o cron cada 60s
CREATE MATERIALIZED VIEW public.conquer_ranking AS
SELECT
    co.group_id,
    co.user_id,
    p.username,
    p.avatar_url,
    gm.color_hue,
    COUNT(*) AS cells_owned
FROM public.cell_occupancy co
JOIN public.profiles p     ON p.id = co.user_id
JOIN public.group_members gm ON gm.user_id = co.user_id AND gm.group_id = co.group_id
WHERE co.is_owner = true
GROUP BY co.group_id, co.user_id, p.username, p.avatar_url, gm.color_hue
ORDER BY co.group_id, cells_owned DESC;

CREATE UNIQUE INDEX ON public.conquer_ranking (group_id, user_id);
CREATE INDEX ON public.conquer_ranking (group_id, cells_owned DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cells           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cell_occupancy  ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- Políticas: profiles
-- -------------------------
-- Cualquier usuario autenticado puede leer perfiles (para mostrar avatares, nombres)
CREATE POLICY "profiles_select_authenticated"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- Solo el propio usuario puede actualizar su perfil
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- -------------------------
-- Políticas: groups
-- -------------------------
-- Solo miembros del grupo pueden verlo
CREATE POLICY "groups_select_members"
    ON public.groups FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    );

-- Cualquier usuario autenticado puede crear un grupo
CREATE POLICY "groups_insert_authenticated"
    ON public.groups FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- Solo el owner puede modificar el grupo
CREATE POLICY "groups_update_owner"
    ON public.groups FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Solo el owner puede eliminar el grupo
CREATE POLICY "groups_delete_owner"
    ON public.groups FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- -------------------------
-- Políticas: group_members
-- -------------------------
-- Miembros pueden ver a los demás miembros de sus grupos
CREATE POLICY "group_members_select"
    ON public.group_members FOR SELECT
    TO authenticated
    USING (
        group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    );

-- Inserción controlada por función SECURITY DEFINER (validar invite_code)
-- Solo el sistema puede insertar directamente; los usuarios usan la función de invitación
CREATE POLICY "group_members_insert_self"
    ON public.group_members FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Owner/admin puede eliminar miembros; miembro puede salir del grupo
CREATE POLICY "group_members_delete"
    ON public.group_members FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR
        group_id IN (
            SELECT group_id FROM public.group_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- -------------------------
-- Políticas: messages
-- -------------------------
CREATE POLICY "messages_select_members"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "messages_insert_members"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    );

-- -------------------------
-- Políticas: location_logs
-- -------------------------
CREATE POLICY "location_logs_select_members"
    ON public.location_logs FOR SELECT
    TO authenticated
    USING (
        group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "location_logs_insert_own"
    ON public.location_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    );

-- -------------------------
-- Políticas: cells
-- -------------------------
-- Las celdas son datos de referencia, cualquier autenticado puede leerlas
CREATE POLICY "cells_select_authenticated"
    ON public.cells FOR SELECT
    TO authenticated
    USING (true);

-- -------------------------
-- Políticas: cell_occupancy
-- -------------------------
CREATE POLICY "cell_occupancy_select_members"
    ON public.cell_occupancy FOR SELECT
    TO authenticated
    USING (
        group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "cell_occupancy_upsert_own"
    ON public.cell_occupancy FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "cell_occupancy_update_own"
    ON public.cell_occupancy FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- FUNCIÓN DE INVITACIÓN (SECURITY DEFINER)
-- Valida un invite_code y añade al usuario autenticado al grupo
-- =============================================================================
CREATE OR REPLACE FUNCTION public.join_group_by_invite(p_invite_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_group     public.groups%ROWTYPE;
    v_existing  public.group_members%ROWTYPE;
    v_hue       SMALLINT;
    v_used_hues SMALLINT[];
BEGIN
    -- Buscar el grupo
    SELECT * INTO v_group
    FROM public.groups
    WHERE invite_code = p_invite_code
      AND (invite_expires_at IS NULL OR invite_expires_at > now());

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Código de invitación inválido o expirado');
    END IF;

    -- Verificar si ya es miembro
    SELECT * INTO v_existing
    FROM public.group_members
    WHERE group_id = v_group.id AND user_id = auth.uid();

    IF FOUND THEN
        RETURN json_build_object('error', 'Ya eres miembro de este grupo');
    END IF;

    -- Calcular color_hue disponible (distribución uniforme en 360°, saltar usados)
    SELECT ARRAY_AGG(color_hue) INTO v_used_hues
    FROM public.group_members
    WHERE group_id = v_group.id;

    -- Seleccionar hue no utilizado en incrementos de 30° (12 colores disponibles)
    v_hue := 0;
    WHILE v_hue < 360 LOOP
        IF v_used_hues IS NULL OR NOT (v_hue = ANY(v_used_hues)) THEN
            EXIT;
        END IF;
        v_hue := v_hue + 30;
    END LOOP;
    -- Si todos están usados, asignar uno aleatorio
    IF v_hue >= 360 THEN
        v_hue := (RANDOM() * 359)::SMALLINT;
    END IF;

    -- Insertar el miembro
    INSERT INTO public.group_members (group_id, user_id, role, color_hue)
    VALUES (v_group.id, auth.uid(), 'member', v_hue);

    RETURN json_build_object(
        'success', true,
        'group_id', v_group.id,
        'group_name', v_group.name
    );
END;
$$;

-- =============================================================================
-- REALTIME: Habilitar publicaciones para tiempo real
-- Ejecutar en Supabase Dashboard > Database > Replication
-- O via SQL:
-- =============================================================================

-- Publicar cambios en mensajes para GeoChat
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Publicar cambios en location_logs para GeoLive
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_logs;

-- Publicar cambios en cell_occupancy para GeoConquer
ALTER PUBLICATION supabase_realtime ADD TABLE public.cell_occupancy;

-- Publicar cambios en group_members para presencia online
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
