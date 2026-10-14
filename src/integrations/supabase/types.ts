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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
          member_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
          member_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          member_id?: string | null
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          created_at: string
          id: string
          member_id: string
          plan_name: string | null
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          plan_name?: string | null
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          plan_name?: string | null
          staff_id?: string
        }
        Relationships: []
      }
      gym_settings: {
        Row: {
          expiring_soon_days: number
          gym_name: string
          id: number
          payment_instructions: string
          renewal_rule: string
          support_contact: string
          timezone: string
          updated_at: string
        }
        Insert: {
          expiring_soon_days?: number
          gym_name?: string
          id?: number
          payment_instructions?: string
          renewal_rule?: string
          support_contact?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          expiring_soon_days?: number
          gym_name?: string
          id?: number
          payment_instructions?: string
          renewal_rule?: string
          support_contact?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      membership_periods: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string
          id: string
          member_id: string
          payment_request_id: string | null
          plan_id: string | null
          plan_name: string
          previous_expiry: string | null
          reason: string
          source: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          member_id: string
          payment_request_id?: string | null
          plan_id?: string | null
          plan_name: string
          previous_expiry?: string | null
          reason?: string
          source: string
          starts_at: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          member_id?: string
          payment_request_id?: string | null
          plan_id?: string | null
          plan_name?: string
          previous_expiry?: string | null
          reason?: string
          source?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_periods_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: true
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_periods_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          created_at: string
          description: string
          duration_unit: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          terms: string
        }
        Insert: {
          created_at?: string
          description?: string
          duration_unit: Database["public"]["Enums"]["duration_unit"]
          duration_value: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          sort_order?: number
          terms?: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_unit?: Database["public"]["Enums"]["duration_unit"]
          duration_value?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          terms?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          read_at: string | null
          ref: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          ref?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          ref?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          member_id: string
          note: string
          paid_on: string | null
          plan_id: string
          receipt_path: string | null
          reference: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          member_id: string
          note?: string
          paid_on?: string | null
          plan_id: string
          receipt_path?: string | null
          reference?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          member_id?: string
          note?: string
          paid_on?: string | null
          plan_id?: string
          receipt_path?: string | null
          reference?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_reason: string | null
          access_state: Database["public"]["Enums"]["access_state"]
          created_at: string
          email: string
          full_name: string
          id: string
          member_code: string
          phone: string
          photo_url: string | null
        }
        Insert: {
          access_reason?: string | null
          access_state?: Database["public"]["Enums"]["access_state"]
          created_at?: string
          email?: string
          full_name?: string
          id: string
          member_code?: string
          phone?: string
          photo_url?: string | null
        }
        Update: {
          access_reason?: string | null
          access_state?: Database["public"]["Enums"]["access_state"]
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          member_code?: string
          phone?: string
          photo_url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_logs: {
        Row: {
          created_at: string
          id: string
          member_id: string | null
          result: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id?: string | null
          result: string
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string | null
          result?: string
          staff_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_duration: {
        Args: {
          _start: string
          _tz: string
          _unit: Database["public"]["Enums"]["duration_unit"]
          _value: number
        }
        Returns: string
      }
      admin_grant_period: {
        Args: {
          _member: string
          _plan: string
          _reason: string
          _unit: Database["public"]["Enums"]["duration_unit"]
          _value: number
        }
        Returns: Json
      }
      admin_list_members: {
        Args: { _limit: number; _offset: number; _q: string; _status: string }
        Returns: {
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          member_code: string
          pending_requests: number
          phone: string
          plan_name: string
          status: string
          total_count: number
        }[]
      }
      admin_overview: { Args: never; Returns: Json }
      admin_reports: { Args: { _days: number }; Returns: Json }
      admin_set_access_state: {
        Args: {
          _member: string
          _reason: string
          _state: Database["public"]["Enums"]["access_state"]
        }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: undefined
      }
      admit_member: { Args: { _member: string }; Returns: Json }
      approve_payment: {
        Args: { _plan: string; _request: string }
        Returns: Json
      }
      compute_status: { Args: { _member: string }; Returns: Json }
      get_my_status: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          _action: string
          _details: Json
          _entity: string
          _entity_id: string
          _member: string
        }
        Returns: undefined
      }
      next_period_start: {
        Args: { _member: string; _rule: string }
        Returns: string
      }
      notify: {
        Args: {
          _body: string
          _kind: string
          _ref?: string
          _title: string
          _user: string
        }
        Returns: undefined
      }
      preview_period: {
        Args: {
          _member: string
          _unit: Database["public"]["Enums"]["duration_unit"]
          _value: number
        }
        Returns: Json
      }
      respond_clarification: {
        Args: { _note: string; _request: string }
        Returns: undefined
      }
      review_payment: {
        Args: { _decision: string; _note: string; _request: string }
        Returns: undefined
      }
      search_members: {
        Args: { _limit?: number; _q: string }
        Returns: {
          email: string
          full_name: string
          id: string
          member_code: string
          phone: string
          photo_url: string
        }[]
      }
      staff_member_status: { Args: { _member: string }; Returns: Json }
      sync_my_notices: { Args: never; Returns: undefined }
      update_my_profile: {
        Args: { _full_name: string; _phone: string }
        Returns: undefined
      }
      verify_member: { Args: { _member: string }; Returns: Json }
    }
    Enums: {
      access_state: "normal" | "suspended" | "cancelled"
      app_role: "admin" | "reception" | "member" | "super_admin"
      duration_unit: "days" | "months"
      payment_status: "pending" | "approved" | "rejected" | "clarification"
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
    Enums: {
      access_state: ["normal", "suspended", "cancelled"],
      app_role: ["admin", "reception", "member", "super_admin"],
      duration_unit: ["days", "months"],
      payment_status: ["pending", "approved", "rejected", "clarification"],
    },
  },
} as const
