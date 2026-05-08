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
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      ceo_desk_notes: {
        Row: {
          author_email: string | null
          author_id: string | null
          created_at: string
          id: string
          note: string
          request_id: string
        }
        Insert: {
          author_email?: string | null
          author_id?: string | null
          created_at?: string
          id?: string
          note: string
          request_id: string
        }
        Update: {
          author_email?: string | null
          author_id?: string | null
          created_at?: string
          id?: string
          note?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_desk_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ceo_desk_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_desk_requests: {
        Row: {
          ceo_notes: string | null
          created_at: string
          deadline_at: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          institute_id: string | null
          message: string | null
          priority: string
          request_type: string
          requester_email: string | null
          requester_id: string | null
          source_id: string | null
          source_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          ceo_notes?: string | null
          created_at?: string
          deadline_at?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          institute_id?: string | null
          message?: string | null
          priority?: string
          request_type?: string
          requester_email?: string | null
          requester_id?: string | null
          source_id?: string | null
          source_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          ceo_notes?: string | null
          created_at?: string
          deadline_at?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          institute_id?: string | null
          message?: string | null
          priority?: string
          request_type?: string
          requester_email?: string | null
          requester_id?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      institute_documents: {
        Row: {
          created_at: string
          created_by: string | null
          file_path: string
          id: string
          institute_id: string
          label: string
          mime_type: string | null
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_path: string
          id?: string
          institute_id: string
          label: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_path?: string
          id?: string
          institute_id?: string
          label?: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Relationships: []
      }
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
      institute_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          institute_id: string
          label: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          institute_id: string
          label: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          institute_id?: string
          label?: string
          url?: string
        }
        Relationships: []
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
      meetings: {
        Row: {
          attendees: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          google_calendar_id: string | null
          google_event_id: string | null
          google_html_link: string | null
          id: string
          institute_id: string | null
          meeting_at: string
          meeting_link: string | null
          notes: string | null
          platform: string | null
          reminder_minutes: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          attendees?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          google_html_link?: string | null
          id?: string
          institute_id?: string | null
          meeting_at: string
          meeting_link?: string | null
          notes?: string | null
          platform?: string | null
          reminder_minutes?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          attendees?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          google_html_link?: string | null
          id?: string
          institute_id?: string | null
          meeting_at?: string
          meeting_link?: string | null
          notes?: string | null
          platform?: string | null
          reminder_minutes?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
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
          designation: string | null
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          institute_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          institute_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          institute_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_institute_id_fkey"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_coaching: boolean
          can_colleges: boolean
          can_dashboard: boolean
          can_logs: boolean
          can_meetings: boolean
          can_stages: boolean
          can_users: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          can_coaching?: boolean
          can_colleges?: boolean
          can_dashboard?: boolean
          can_logs?: boolean
          can_meetings?: boolean
          can_stages?: boolean
          can_users?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          can_coaching?: boolean
          can_colleges?: boolean
          can_dashboard?: boolean
          can_logs?: boolean
          can_meetings?: boolean
          can_stages?: boolean
          can_users?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
      institute_type: ["college", "coaching"],
    },
  },
} as const
