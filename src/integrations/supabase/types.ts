export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          created_at: string
          emails: string[]
          extra_phones: string[]
          first_name: string
          id: string
          last_name: string
          marketing_consent: boolean
          marketing_consent_at: string | null
          name: string
          notes: string | null
          phone: string | null
          restaurant_id: string | null
        }
        Insert: {
          created_at?: string
          emails?: string[]
          extra_phones?: string[]
          first_name?: string
          id?: string
          last_name?: string
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string | null
        }
        Update: {
          created_at?: string
          emails?: string[]
          extra_phones?: string[]
          first_name?: string
          id?: string
          last_name?: string
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          arrived: boolean
          barella_seats: number
          buffer_min: number | null
          channel: string
          contact_email: string | null
          created_at: string
          created_by: string | null
          created_by_name: string
          customer_id: string | null
          date: string
          deleted_at: string | null
          duration_min: number | null
          extra_barelle: number
          extra_sponde: number
          id: string
          is_new: boolean
          name: string
          no_show: boolean
          notes: string
          online_request_id: string | null
          outside: boolean
          people: number
          phone: string | null
          privacy_consent_at: string | null
          privacy_policy_url: string | null
          restaurant_id: string | null
          shift: string
          table_ids: string[]
          tags: string[]
          time: string
          updated_at: string | null
          updated_by_name: string | null
        }
        Insert: {
          arrived?: boolean
          barella_seats?: number
          buffer_min?: number | null
          channel?: string
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          customer_id?: string | null
          date: string
          deleted_at?: string | null
          duration_min?: number | null
          extra_barelle?: number
          extra_sponde?: number
          id?: string
          is_new?: boolean
          name?: string
          no_show?: boolean
          notes?: string
          online_request_id?: string | null
          outside?: boolean
          people?: number
          phone?: string | null
          privacy_consent_at?: string | null
          privacy_policy_url?: string | null
          restaurant_id?: string | null
          shift: string
          table_ids?: string[]
          tags?: string[]
          time?: string
          updated_at?: string | null
          updated_by_name?: string | null
        }
        Update: {
          arrived?: boolean
          barella_seats?: number
          buffer_min?: number | null
          channel?: string
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string
          customer_id?: string | null
          date?: string
          deleted_at?: string | null
          duration_min?: number | null
          extra_barelle?: number
          extra_sponde?: number
          id?: string
          is_new?: boolean
          name?: string
          no_show?: boolean
          notes?: string
          online_request_id?: string | null
          outside?: boolean
          people?: number
          phone?: string | null
          privacy_consent_at?: string | null
          privacy_policy_url?: string | null
          restaurant_id?: string | null
          shift?: string
          table_ids?: string[]
          tags?: string[]
          time?: string
          updated_at?: string | null
          updated_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          name: string
          restaurant_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          name?: string
          restaurant_id: string
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          restaurant_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_invites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_members: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          notes: string
          operational_role: string
          phone: string
          restaurant_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string
          operational_role?: string
          phone?: string
          restaurant_id: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string
          operational_role?: string
          phone?: string
          restaurant_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          allow_extras: boolean
          created_at: string
          id: string
          name: string
          no_join: string[]
          restaurant_id: string | null
          room_id: string
          seats: number
          x: number
          y: number
        }
        Insert: {
          allow_extras?: boolean
          created_at?: string
          id?: string
          name: string
          no_join?: string[]
          restaurant_id?: string | null
          room_id: string
          seats?: number
          x?: number
          y?: number
        }
        Update: {
          allow_extras?: boolean
          created_at?: string
          id?: string
          name?: string
          no_join?: string[]
          restaurant_id?: string | null
          room_id?: string
          seats?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_tables_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          created_at: string
          id: string
          name: string
          online_config: Json
          online_enabled: boolean
          public_address: string
          public_logo_url: string
          settings: Json
          web_slug: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          online_config?: Json
          online_enabled?: boolean
          public_address?: string
          public_logo_url?: string
          settings?: Json
          web_slug?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          online_config?: Json
          online_enabled?: boolean
          public_address?: string
          public_logo_url?: string
          settings?: Json
          web_slug?: string | null
        }
        Relationships: []
      }
      rooms: {
        Row: {
          capacity: number | null
          closed_periods: Json
          closed_shifts: string[]
          created_at: string
          double_shifts: Json
          environment: string
          grid_cols: number
          grid_rows: number
          id: string
          is_outdoor: boolean
          locked: boolean
          name: string
          open_days: number[]
          restaurant_id: string | null
          sort_order: number
          walls: Json
        }
        Insert: {
          capacity?: number | null
          closed_periods?: Json
          closed_shifts?: string[]
          created_at?: string
          double_shifts?: Json
          environment?: string
          grid_cols?: number
          grid_rows?: number
          id?: string
          is_outdoor?: boolean
          locked?: boolean
          name: string
          open_days?: number[]
          restaurant_id?: string | null
          sort_order?: number
          walls?: Json
        }
        Update: {
          capacity?: number | null
          closed_periods?: Json
          closed_shifts?: string[]
          created_at?: string
          double_shifts?: Json
          environment?: string
          grid_cols?: number
          grid_rows?: number
          id?: string
          is_outdoor?: boolean
          locked?: boolean
          name?: string
          open_days?: number[]
          restaurant_id?: string | null
          sort_order?: number
          walls?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rooms_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_notes: {
        Row: {
          body: string
          date: string
          id: string
          restaurant_id: string
          shift: string
          updated_at: string
        }
        Insert: {
          body?: string
          date: string
          id?: string
          restaurant_id?: string
          shift: string
          updated_at?: string
        }
        Update: {
          body?: string
          date?: string
          id?: string
          restaurant_id?: string
          shift?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_notes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_restaurant: {
        Args: { _display_name: string; _name: string }
        Returns: string
      }
      create_restaurant_from_backup: {
        Args: { _backup_data: Json; _name: string }
        Returns: string
      }
      create_service_walkin: {
        Args: { _name?: string; _people: number; _table: string }
        Returns: string
      }
      delete_own_account: { Args: never; Returns: undefined }
      delete_restaurant_cascade: {
        Args: { _restaurant_id: string }
        Returns: undefined
      }
      delete_restaurant_user: {
        Args: {
          _delete_from_auth?: boolean
          _restaurant_id: string
          _user_id: string
        }
        Returns: undefined
      }
      export_restaurant_data: {
        Args: { _restaurant_id: string }
        Returns: Json
      }
      get_invite: {
        Args: { _token: string }
        Returns: {
          email: string
          name: string
          restaurant_name: string
          role: string
        }[]
      }
      get_online_booking_page: { Args: { _slug: string }; Returns: Json }
      is_master: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      my_restaurant_id: { Args: never; Returns: string }
      online_shift_remaining: {
        Args: { _date: string; _rid: string; _shift: string }
        Returns: number
      }
      restore_restaurant_data: {
        Args: { _backup_data: Json; _target_restaurant_id: string }
        Returns: boolean
      }
      restore_service_reservation: {
        Args: { _id: string; _without_tables?: boolean }
        Returns: boolean
      }
      set_operator_name: { Args: { _name: string }; Returns: undefined }
      submit_online_booking: {
        Args: { _data: Json; _slug: string }
        Returns: Json
      }
      update_operator_profile: {
        Args: {
          _name: string
          _notes: string
          _operational_role: string
          _phone: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
