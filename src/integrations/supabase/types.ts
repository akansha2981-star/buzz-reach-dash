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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      institute_emails: {
        Row: {
          email: string
          id: string
          institute_id: string
          label: string | null
        }
        Insert: {
          email: string
          id?: string
          institute_id: string
          label?: string | null
        }
        Update: {
          email?: string
          id?: string
          institute_id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institute_emails_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
      institute_phones: {
        Row: {
          id: string
          institute_id: string
          label: string | null
          phone: string
        }
        Insert: {
          id?: string
          institute_id: string
          label?: string | null
          phone: string
        }
        Update: {
          id?: string
          institute_id?: string
          label?: string | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "institute_phones_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
      institutes: {
        Row: {
          city: string | null
          contact_designation: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          current_stage_id: string | null
          id: string
          name: string
          next_meeting_at: string | null
          notes: string | null
          state: string | null
          type: Database["public"]["Enums"]["institute_type"]
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          contact_designation?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          current_stage_id?: string | null
          id?: string
          name: string
          next_meeting_at?: string | null
          notes?: string | null
          state?: string | null
          type: Database["public"]["Enums"]["institute_type"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          contact_designation?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          current_stage_id?: string | null
          id?: string
          name?: string
          next_meeting_at?: string | null
          notes?: string | null
          state?: string | null
          type?: Database["public"]["Enums"]["institute_type"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutes_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "outreach_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_activities: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          institute_id: string
          note: string | null
          stage_id: string | null
          stage_name_snapshot: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          institute_id: string
          note?: string | null
          stage_id?: string | null
          stage_name_snapshot?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          institute_id?: string
          note?: string | null
          stage_id?: string | null
          stage_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_activities_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_activities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "outreach_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      institute_type: "college" | "coaching"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      institute_type: ["college", "coaching"],
    },
  },
} as const
