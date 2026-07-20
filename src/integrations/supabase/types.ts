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
      accounts_expenses: {
        Row: {
          amount: number
          attachment_url: string | null
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          payment_method: string | null
          spent_on: string
          title: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          attachment_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          spent_on?: string
          title: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          spent_on?: string
          title?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      accounts_invoices: {
        Row: {
          amount: number
          attachment_url: string | null
          category: string | null
          client: string
          client_email: string | null
          client_location: string | null
          client_phone: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          invoice_number: string | null
          issue_date: string
          items: Json
          notes: string | null
          payment_mode: string | null
          status: string
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          amount?: number
          attachment_url?: string | null
          category?: string | null
          client: string
          client_email?: string | null
          client_location?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string
          items?: Json
          notes?: string | null
          payment_mode?: string | null
          status?: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category?: string | null
          client?: string
          client_email?: string | null
          client_location?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string
          items?: Json
          notes?: string | null
          payment_mode?: string | null
          status?: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      accounts_recurring_expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          frequency: string
          id: string
          is_active: boolean
          next_due: string
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          frequency?: string
          id?: string
          is_active?: boolean
          next_due?: string
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          frequency?: string
          id?: string
          is_active?: boolean
          next_due?: string
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
            foreignKeyName: "ceo_desk_notes_request_fk"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ceo_desk_requests"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "ceo_desk_requests_institute_fk"
            columns: ["institute_id"]
            isOneToOne: false
            referencedRelation: "institutes"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_announcement_reads: {
        Row: {
          announcement_id: string
          employee_id: string
          id: string
          read_at: string
        }
        Insert: {
          announcement_id: string
          employee_id: string
          id?: string
          read_at?: string
        }
        Update: {
          announcement_id?: string
          employee_id?: string
          id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "hr_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_attendance: {
        Row: {
          clock_in_at: string | null
          clock_out_at: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["hr_attendance_status"]
          total_break_minutes: number
          total_work_minutes: number
          updated_at: string
          work_date: string
        }
        Insert: {
          clock_in_at?: string | null
          clock_out_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["hr_attendance_status"]
          total_break_minutes?: number
          total_work_minutes?: number
          updated_at?: string
          work_date: string
        }
        Update: {
          clock_in_at?: string | null
          clock_out_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["hr_attendance_status"]
          total_break_minutes?: number
          total_work_minutes?: number
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_breaks: {
        Row: {
          attendance_id: string
          created_at: string
          end_at: string | null
          id: string
          start_at: string
        }
        Insert: {
          attendance_id: string
          created_at?: string
          end_at?: string | null
          id?: string
          start_at?: string
        }
        Update: {
          attendance_id?: string
          created_at?: string
          end_at?: string | null
          id?: string
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_breaks_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "hr_attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_departments: {
        Row: {
          created_at: string
          description: string | null
          head_user_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          head_user_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          head_user_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_documents: {
        Row: {
          category: string
          created_at: string
          employee_id: string
          file_path: string
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          employee_id: string
          file_path: string
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          employee_id?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employees: {
        Row: {
          aadhaar_number: string | null
          address: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          created_at: string
          date_of_birth: string | null
          department_id: string | null
          designation: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_code: string | null
          employment_type: string
          full_name: string
          gender: string | null
          hr_role: Database["public"]["Enums"]["hr_role"]
          id: string
          joining_date: string | null
          notes: string | null
          pan_number: string | null
          phone: string | null
          reporting_manager_id: string | null
          status: Database["public"]["Enums"]["hr_employment_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          address?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string | null
          employment_type?: string
          full_name: string
          gender?: string | null
          hr_role?: Database["public"]["Enums"]["hr_role"]
          id?: string
          joining_date?: string | null
          notes?: string | null
          pan_number?: string | null
          phone?: string | null
          reporting_manager_id?: string | null
          status?: Database["public"]["Enums"]["hr_employment_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          address?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string | null
          employment_type?: string
          full_name?: string
          gender?: string | null
          hr_role?: Database["public"]["Enums"]["hr_role"]
          id?: string
          joining_date?: string | null
          notes?: string | null
          pan_number?: string | null
          phone?: string | null
          reporting_manager_id?: string | null
          status?: Database["public"]["Enums"]["hr_employment_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employees_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_holidays: {
        Row: {
          holiday_date: string
          id: string
          name: string
          optional: boolean
          region: string | null
        }
        Insert: {
          holiday_date: string
          id?: string
          name: string
          optional?: boolean
          region?: string | null
        }
        Update: {
          holiday_date?: string
          id?: string
          name?: string
          optional?: boolean
          region?: string | null
        }
        Relationships: []
      }
      hr_leave_balances: {
        Row: {
          allocated: number
          employee_id: string
          id: string
          leave_type_id: string
          used: number
          year: number
        }
        Insert: {
          allocated?: number
          employee_id: string
          id?: string
          leave_type_id: string
          used?: number
          year: number
        }
        Update: {
          allocated?: number
          employee_id?: string
          id?: string
          leave_type_id?: string
          used?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_requests: {
        Row: {
          created_at: string
          days: number
          document_path: string | null
          employee_id: string
          from_date: string
          hr_comment: string | null
          hr_decision_at: string | null
          hr_id: string | null
          id: string
          leave_type_id: string
          manager_comment: string | null
          manager_decision_at: string | null
          manager_id: string | null
          reason: string | null
          status: Database["public"]["Enums"]["hr_leave_status"]
          to_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days: number
          document_path?: string | null
          employee_id: string
          from_date: string
          hr_comment?: string | null
          hr_decision_at?: string | null
          hr_id?: string | null
          id?: string
          leave_type_id: string
          manager_comment?: string | null
          manager_decision_at?: string | null
          manager_id?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["hr_leave_status"]
          to_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days?: number
          document_path?: string | null
          employee_id?: string
          from_date?: string
          hr_comment?: string | null
          hr_decision_at?: string | null
          hr_id?: string | null
          id?: string
          leave_type_id?: string
          manager_comment?: string | null
          manager_decision_at?: string | null
          manager_id?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["hr_leave_status"]
          to_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_requests_hr_id_fkey"
            columns: ["hr_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "hr_leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_requests_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_types: {
        Row: {
          active: boolean
          code: string
          color: string
          default_quota: number
          id: string
          is_paid: boolean
          name: string
          requires_doc: boolean
        }
        Insert: {
          active?: boolean
          code: string
          color?: string
          default_quota?: number
          id?: string
          is_paid?: boolean
          name: string
          requires_doc?: boolean
        }
        Update: {
          active?: boolean
          code?: string
          color?: string
          default_quota?: number
          id?: string
          is_paid?: boolean
          name?: string
          requires_doc?: boolean
        }
        Relationships: []
      }
      hr_tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["hr_task_priority"]
          status: Database["public"]["Enums"]["hr_task_status"]
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["hr_task_priority"]
          status?: Database["public"]["Enums"]["hr_task_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["hr_task_priority"]
          status?: Database["public"]["Enums"]["hr_task_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_work_logs: {
        Row: {
          accomplishments: string | null
          blockers: string | null
          created_at: string
          employee_id: string
          hours: number
          id: string
          mood: string | null
          summary: string
          updated_at: string
          work_date: string
        }
        Insert: {
          accomplishments?: string | null
          blockers?: string | null
          created_at?: string
          employee_id: string
          hours?: number
          id?: string
          mood?: string | null
          summary: string
          updated_at?: string
          work_date: string
        }
        Update: {
          accomplishments?: string | null
          blockers?: string | null
          created_at?: string
          employee_id?: string
          hours?: number
          id?: string
          mood?: string | null
          summary?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: []
      }
      institute_documents: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          file_path: string
          id: string
          institute_id: string | null
          label: string
          mime_type: string | null
          name: string | null
          size_bytes: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          file_path: string
          id?: string
          institute_id?: string | null
          label: string
          mime_type?: string | null
          name?: string | null
          size_bytes?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          file_path?: string
          id?: string
          institute_id?: string | null
          label?: string
          mime_type?: string | null
          name?: string | null
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
          category: string
          created_at: string
          created_by: string | null
          id: string
          institute_id: string | null
          label: string
          name: string | null
          url: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          institute_id?: string | null
          label: string
          name?: string | null
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          institute_id?: string | null
          label?: string
          name?: string | null
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
          priority: number | null
          sort_order: number
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
          priority?: number | null
          sort_order?: number
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
          priority?: number | null
          sort_order?: number
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
      me_badges: {
        Row: {
          code: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      me_categories: {
        Row: {
          color: string
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      me_confidential_apis: {
        Row: {
          api_key: string
          category: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          category?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      me_confidential_documents: {
        Row: {
          category: string | null
          created_at: string
          id: string
          link: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          link: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          link?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      me_confidential_passwords: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          password: string
          updated_at: string
          url: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          password: string
          updated_at?: string
          url?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          password?: string
          updated_at?: string
          url?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      me_focus_sessions: {
        Row: {
          completed: boolean
          duration_minutes: number
          ended_at: string | null
          id: string
          started_at: string
          task_id: string | null
          type: Database["public"]["Enums"]["me_focus_type"]
          user_id: string
        }
        Insert: {
          completed?: boolean
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          started_at?: string
          task_id?: string | null
          type?: Database["public"]["Enums"]["me_focus_type"]
          user_id: string
        }
        Update: {
          completed?: boolean
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          started_at?: string
          task_id?: string | null
          type?: Database["public"]["Enums"]["me_focus_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "me_focus_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "me_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      me_goals: {
        Row: {
          created_at: string
          id: string
          progress: number
          status: string
          target_date: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          progress?: number
          status?: string
          target_date?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          progress?: number
          status?: string
          target_date?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      me_habit_fields: {
        Row: {
          created_at: string
          habit_id: string
          id: string
          key: string
          label: string
          sort_order: number
          target_period: string | null
          target_value: number | null
          type: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          habit_id: string
          id?: string
          key: string
          label: string
          sort_order?: number
          target_period?: string | null
          target_value?: number | null
          type: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          habit_id?: string
          id?: string
          key?: string
          label?: string
          sort_order?: number
          target_period?: string | null
          target_value?: number | null
          type?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "me_habit_fields_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "me_habits"
            referencedColumns: ["id"]
          },
        ]
      }
      me_habit_logs: {
        Row: {
          done: boolean
          habit_id: string
          id: string
          log_date: string
          notes: string | null
          updated_at: string
          user_id: string
          values: Json
        }
        Insert: {
          done?: boolean
          habit_id: string
          id?: string
          log_date: string
          notes?: string | null
          updated_at?: string
          user_id: string
          values?: Json
        }
        Update: {
          done?: boolean
          habit_id?: string
          id?: string
          log_date?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "me_habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "me_habits"
            referencedColumns: ["id"]
          },
        ]
      }
      me_habits: {
        Row: {
          active: boolean
          archived: boolean
          category: string | null
          color: string
          created_at: string
          custom_days: number[] | null
          frequency: string
          icon: string | null
          id: string
          notes: string | null
          notifications_enabled: boolean
          reminder_times: string[] | null
          start_date: string | null
          target_per_week: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          archived?: boolean
          category?: string | null
          color?: string
          created_at?: string
          custom_days?: number[] | null
          frequency?: string
          icon?: string | null
          id?: string
          notes?: string | null
          notifications_enabled?: boolean
          reminder_times?: string[] | null
          start_date?: string | null
          target_per_week?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          archived?: boolean
          category?: string | null
          color?: string
          created_at?: string
          custom_days?: number[] | null
          frequency?: string
          icon?: string | null
          id?: string
          notes?: string | null
          notifications_enabled?: boolean
          reminder_times?: string[] | null
          start_date?: string | null
          target_per_week?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      me_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          scheduled_for: string | null
          task_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          scheduled_for?: string | null
          task_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          scheduled_for?: string | null
          task_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "me_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "me_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      me_subtasks: {
        Row: {
          created_at: string
          done: boolean
          id: string
          position: number
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          task_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "me_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "me_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      me_task_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "me_task_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "me_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      me_tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          due_time: string | null
          estimated_minutes: number | null
          id: string
          position: number
          priority: Database["public"]["Enums"]["me_task_priority"]
          recurrence_parent_id: string | null
          recurrence_rule: Json | null
          reminder_at: string | null
          status: Database["public"]["Enums"]["me_task_status"]
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          estimated_minutes?: number | null
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["me_task_priority"]
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          reminder_at?: string | null
          status?: Database["public"]["Enums"]["me_task_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          estimated_minutes?: number | null
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["me_task_priority"]
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
          reminder_at?: string | null
          status?: Database["public"]["Enums"]["me_task_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          attendees: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          google_account_key: string | null
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
          google_account_key?: string | null
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
          google_account_key?: string | null
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
          recurrence_parent_id: string | null
          recurrence_rule: Json | null
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
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
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
          recurrence_parent_id?: string | null
          recurrence_rule?: Json | null
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
          can_accounts: boolean
          can_ceo_desk: boolean
          can_coaching: boolean
          can_colleges: boolean
          can_dashboard: boolean
          can_documents: boolean
          can_logs: boolean
          can_meetings: boolean
          can_my_workspace: boolean
          can_stages: boolean
          can_tasks: boolean
          can_timeline: boolean
          can_users: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          can_accounts?: boolean
          can_ceo_desk?: boolean
          can_coaching?: boolean
          can_colleges?: boolean
          can_dashboard?: boolean
          can_documents?: boolean
          can_logs?: boolean
          can_meetings?: boolean
          can_my_workspace?: boolean
          can_stages?: boolean
          can_tasks?: boolean
          can_timeline?: boolean
          can_users?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          can_accounts?: boolean
          can_ceo_desk?: boolean
          can_coaching?: boolean
          can_colleges?: boolean
          can_dashboard?: boolean
          can_documents?: boolean
          can_logs?: boolean
          can_meetings?: boolean
          can_my_workspace?: boolean
          can_stages?: boolean
          can_tasks?: boolean
          can_timeline?: boolean
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
      current_employee_id: { Args: never; Returns: string }
      has_accounts_access: { Args: { _uid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_hr_admin: { Args: never; Returns: boolean }
      is_manager_of: { Args: { _employee_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      hr_attendance_status:
        | "present"
        | "absent"
        | "half_day"
        | "late"
        | "wfh"
        | "holiday"
        | "leave"
      hr_employment_status: "active" | "suspended" | "inactive"
      hr_leave_status:
        | "pending"
        | "manager_approved"
        | "approved"
        | "rejected"
        | "cancelled"
      hr_role:
        | "super_admin"
        | "hr_admin"
        | "manager"
        | "team_leader"
        | "employee"
        | "intern"
      hr_task_priority: "low" | "medium" | "high" | "urgent"
      hr_task_status: "todo" | "in_progress" | "review" | "done" | "cancelled"
      institute_type: "college" | "coaching"
      me_focus_type: "pomodoro" | "short_break" | "long_break" | "focus"
      me_task_priority: "low" | "medium" | "high" | "urgent"
      me_task_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "delayed"
        | "overdue"
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
      hr_attendance_status: [
        "present",
        "absent",
        "half_day",
        "late",
        "wfh",
        "holiday",
        "leave",
      ],
      hr_employment_status: ["active", "suspended", "inactive"],
      hr_leave_status: [
        "pending",
        "manager_approved",
        "approved",
        "rejected",
        "cancelled",
      ],
      hr_role: [
        "super_admin",
        "hr_admin",
        "manager",
        "team_leader",
        "employee",
        "intern",
      ],
      hr_task_priority: ["low", "medium", "high", "urgent"],
      hr_task_status: ["todo", "in_progress", "review", "done", "cancelled"],
      institute_type: ["college", "coaching"],
      me_focus_type: ["pomodoro", "short_break", "long_break", "focus"],
      me_task_priority: ["low", "medium", "high", "urgent"],
      me_task_status: [
        "pending",
        "in_progress",
        "completed",
        "delayed",
        "overdue",
      ],
    },
  },
} as const
