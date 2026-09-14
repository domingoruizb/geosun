// Tipos TypeScript generados manualmente del schema de Supabase
// En producción: usar `supabase gen types typescript` para generarlos automáticamente

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type GroupRole = 'owner' | 'admin' | 'member';
export type MessageType = 'text' | 'system';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      groups: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          invite_code: string;
          invite_expires_at: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          invite_code: string;
          invite_expires_at?: string | null;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          invite_code?: string;
          invite_expires_at?: string | null;
          updated_at?: string;
        };
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          role: GroupRole;
          color_hue: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          role?: GroupRole;
          color_hue: number;
          joined_at?: string;
        };
        Update: {
          role?: GroupRole;
          color_hue?: number;
        };
      };
      messages: {
        Row: {
          id: string;
          group_id: string;
          user_id: string | null;
          type: MessageType;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id?: string | null;
          type?: MessageType;
          content: string;
          created_at?: string;
        };
        Update: never;
      };
      location_logs: {
        Row: {
          id: number;
          user_id: string;
          group_id: string;
          geom: unknown; // PostGIS geometry
          accuracy: number | null;
          altitude: number | null;
          speed: number | null;
          recorded_at: string;
        };
        Insert: {
          user_id: string;
          group_id: string;
          geom: unknown;
          accuracy?: number | null;
          altitude?: number | null;
          speed?: number | null;
          recorded_at?: string;
        };
        Update: never;
      };
      cell_occupancy: {
        Row: {
          id: number;
          cell_x: number;
          cell_y: number;
          group_id: string;
          user_id: string;
          seconds_total: number;
          last_seen_at: string;
          is_owner: boolean;
        };
        Insert: {
          cell_x: number;
          cell_y: number;
          group_id: string;
          user_id: string;
          seconds_total?: number;
          last_seen_at?: string;
          is_owner?: boolean;
        };
        Update: {
          seconds_total?: number;
          last_seen_at?: string;
          is_owner?: boolean;
        };
      };
    };
    Functions: {
      join_group_by_invite: {
        Args: { p_invite_code: string };
        Returns: Json;
      };
      upsert_cell_occupancy: {
        Args: {
          p_cell_x: number;
          p_cell_y: number;
          p_group_id: string;
          p_delta_seconds: number;
        };
        Returns: void;
      };
      get_cells_in_bbox: {
        Args: {
          p_group_id: string;
          p_sw_lng: number;
          p_sw_lat: number;
          p_ne_lng: number;
          p_ne_lat: number;
        };
        Returns: Array<{
          cell_x: number;
          cell_y: number;
          owner_id: string;
          color_hue: number;
          seconds_total: number;
        }>;
      };
    };
  };
}
