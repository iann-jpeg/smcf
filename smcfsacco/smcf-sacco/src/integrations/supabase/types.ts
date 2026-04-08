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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          ip_address: string | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      loan_approvals: {
        Row: {
          approval_level: string
          approver_id: string
          created_at: string
          decision: string
          id: string
          loan_id: string
          notes: string | null
        }
        Insert: {
          approval_level: string
          approver_id: string
          created_at?: string
          decision: string
          id?: string
          loan_id: string
          notes?: string | null
        }
        Update: {
          approval_level?: string
          approver_id?: string
          created_at?: string
          decision?: string
          id?: string
          loan_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_approvals_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_guarantors: {
        Row: {
          created_at: string
          guarantee_amount: number
          id: string
          loan_id: string
          member_id: string
        }
        Insert: {
          created_at?: string
          guarantee_amount?: number
          id?: string
          loan_id: string
          member_id: string
        }
        Update: {
          created_at?: string
          guarantee_amount?: number
          id?: string
          loan_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_guarantors_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_guarantors_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          applied_at: string
          applied_by: string | null
          approved_at: string | null
          approved_by: string | null
          balance: number
          created_at: string
          disbursed_date: string | null
          id: string
          interest_model: string
          interest_rate: number
          loan_number: string
          member_id: string
          monthly_installment: number
          principal: number
          rejection_reason: string | null
          risk_rating: string | null
          status: string
          term_months: number
          total_payable: number
          updated_at: string
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          balance?: number
          created_at?: string
          disbursed_date?: string | null
          id?: string
          interest_model?: string
          interest_rate: number
          loan_number: string
          member_id: string
          monthly_installment?: number
          principal: number
          rejection_reason?: string | null
          risk_rating?: string | null
          status?: string
          term_months: number
          total_payable?: number
          updated_at?: string
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          balance?: number
          created_at?: string
          disbursed_date?: string | null
          id?: string
          interest_model?: string
          interest_rate?: number
          loan_number?: string
          member_id?: string
          monthly_installment?: number
          principal?: number
          rejection_reason?: string | null
          risk_rating?: string | null
          status?: string
          term_months?: number
          total_payable?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          email: string | null
          id: string
          join_date: string
          kyc_verified: boolean
          kyc_verified_at: string | null
          kyc_verified_by: string | null
          loan_balance: number
          member_id: string
          name: string
          phone: string | null
          risk_score: number | null
          savings: number
          shares: number
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          join_date?: string
          kyc_verified?: boolean
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          loan_balance?: number
          member_id: string
          name: string
          phone?: string | null
          risk_score?: number | null
          savings?: number
          shares?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          join_date?: string
          kyc_verified?: boolean
          kyc_verified_at?: string | null
          kyc_verified_by?: string | null
          loan_balance?: number
          member_id?: string
          name?: string
          phone?: string | null
          risk_score?: number | null
          savings?: number
          shares?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      repayment_records: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          due_date: string
          id: string
          loan_id: string
          member_id: string
          paid_date: string | null
          status: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string
          due_date: string
          id?: string
          loan_id: string
          member_id: string
          paid_date?: string | null
          status?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date?: string
          id?: string
          loan_id?: string
          member_id?: string
          paid_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "repayment_records_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayment_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_history: {
        Row: {
          amount: number
          created_at: string
          id: string
          member_id: string
          month: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          member_id: string
          month: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          member_id?: string
          month?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_history: {
        Row: {
          created_at: string
          id: string
          mode: string
          notes: string | null
          result_a: Json
          result_b: Json | null
          scenario_a: Json
          scenario_b: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          result_a: Json
          result_b?: Json | null
          scenario_a: Json
          scenario_b?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          result_a?: Json
          result_b?: Json | null
          scenario_a?: Json
          scenario_b?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      simulation_presets: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          guarantor_count: number
          icon: string
          id: string
          name: string
          override_trust: number | null
          sort_order: number
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          guarantor_count?: number
          icon?: string
          id?: string
          name: string
          override_trust?: number | null
          sort_order?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          guarantor_count?: number
          icon?: string
          id?: string
          name?: string
          override_trust?: number | null
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          member_id: string
          processed_at: string
          status: string
          transaction_ref: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          member_id: string
          processed_at?: string
          status?: string
          transaction_ref: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          member_id?: string
          processed_at?: string
          status?: string
          transaction_ref?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
      has_any_staff_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "credit_officer"
        | "credit_committee"
        | "treasurer"
        | "auditor"
        | "member"
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
      app_role: [
        "admin",
        "credit_officer",
        "credit_committee",
        "treasurer",
        "auditor",
        "member",
      ],
    },
  },
} as const
