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
      app_config: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      focus_mode_states: {
        Row: {
          active_mode: string | null
          created_at: string
          date: string
          id: string
          last_completed_mode: string | null
          modes: Json
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          active_mode?: string | null
          created_at?: string
          date: string
          id?: string
          last_completed_mode?: string | null
          modes?: Json
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          active_mode?: string | null
          created_at?: string
          date?: string
          id?: string
          last_completed_mode?: string | null
          modes?: Json
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          id: string
          last_checked_at: string | null
          name: string
          next_action: string | null
          owner: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_checked_at?: string | null
          name: string
          next_action?: string | null
          owner?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_checked_at?: string | null
          name?: string
          next_action?: string | null
          owner?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      vendas_canais: {
        Row: {
          atualizado_em: string
          canal: string
          created_at: string
          faturamento: number
          fonte: string | null
          id: string
          mes: string
          pedidos: number
          updated_at: string
        }
        Insert: {
          atualizado_em?: string
          canal: string
          created_at?: string
          faturamento?: number
          fonte?: string | null
          id?: string
          mes: string
          pedidos?: number
          updated_at?: string
        }
        Update: {
          atualizado_em?: string
          canal?: string
          created_at?: string
          faturamento?: number
          fonte?: string | null
          id?: string
          mes?: string
          pedidos?: number
          updated_at?: string
        }
        Relationships: []
      }
      vendas_notas_itens: {
        Row: {
          access_key: string | null
          channel: string
          created_at: string
          external_invoice_id: string
          id: string
          invoice_number: string | null
          issued_at: string
          line_index: number
          metadata: Json
          product_name: string
          quantity: number
          series: string | null
          sku: string | null
          source: string
          status: string
          synced_at: string
          total_value: number
          unit_value: number
          updated_at: string
        }
        Insert: {
          access_key?: string | null
          channel: string
          created_at?: string
          external_invoice_id: string
          id?: string
          invoice_number?: string | null
          issued_at: string
          line_index: number
          metadata?: Json
          product_name: string
          quantity?: number
          series?: string | null
          sku?: string | null
          source: string
          status: string
          synced_at?: string
          total_value?: number
          unit_value?: number
          updated_at?: string
        }
        Update: {
          access_key?: string | null
          channel?: string
          created_at?: string
          external_invoice_id?: string
          id?: string
          invoice_number?: string | null
          issued_at?: string
          line_index?: number
          metadata?: Json
          product_name?: string
          quantity?: number
          series?: string | null
          sku?: string | null
          source?: string
          status?: string
          synced_at?: string
          total_value?: number
          unit_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      vendas_produtos: {
        Row: {
          atualizado_em: string
          canal: string
          created_at: string
          faturamento: number
          fonte: string | null
          id: string
          mes: string
          nome: string
          qtd_vendida: number
          sku: string | null
          updated_at: string
        }
        Insert: {
          atualizado_em?: string
          canal: string
          created_at?: string
          faturamento?: number
          fonte?: string | null
          id?: string
          mes: string
          nome: string
          qtd_vendida?: number
          sku?: string | null
          updated_at?: string
        }
        Update: {
          atualizado_em?: string
          canal?: string
          created_at?: string
          faturamento?: number
          fonte?: string | null
          id?: string
          mes?: string
          nome?: string
          qtd_vendida?: number
          sku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vendas_sync_runs: {
        Row: {
          channels: number
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          invoices: number
          metadata: Json
          mode: string
          orders: number
          period_end: string
          period_start: string
          products: number
          source: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          channels?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          invoices?: number
          metadata?: Json
          mode: string
          orders?: number
          period_end: string
          period_start: string
          products?: number
          source: string
          started_at?: string
          status: string
          updated_at?: string
        }
        Update: {
          channels?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          invoices?: number
          metadata?: Json
          mode?: string
          orders?: number
          period_end?: string
          period_start?: string
          products?: number
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      vendas_sync_state: {
        Row: {
          attempts: number
          created_at: string
          last_error: string | null
          last_success_at: string | null
          next_month: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          last_error?: string | null
          last_success_at?: string | null
          next_month?: string | null
          source: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          last_error?: string | null
          last_success_at?: string | null
          next_month?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      weekly_snapshots: {
        Row: {
          ads_maximo: number | null
          caixa_livre_real: number | null
          cpa_medio: number | null
          created_at: string | null
          decisao_ads: string | null
          gasto_ads: number | null
          id: string
          modes_full_backup: Json | null
          pedidos_semana: number | null
          prioridade_semana: string | null
          registro_decisao: string | null
          resultado_mes: number | null
          roas_medio: number | null
          score_demanda: number | null
          score_financeiro: number | null
          score_organico: number | null
          score_sessoes: number | null
          sessoes_semana: number | null
          status_demanda: string | null
          status_financeiro: string | null
          status_organico: string | null
          ticket_medio: number | null
          total_defasados: number | null
          user_id: string
          week_start: string
        }
        Insert: {
          ads_maximo?: number | null
          caixa_livre_real?: number | null
          cpa_medio?: number | null
          created_at?: string | null
          decisao_ads?: string | null
          gasto_ads?: number | null
          id?: string
          modes_full_backup?: Json | null
          pedidos_semana?: number | null
          prioridade_semana?: string | null
          registro_decisao?: string | null
          resultado_mes?: number | null
          roas_medio?: number | null
          score_demanda?: number | null
          score_financeiro?: number | null
          score_organico?: number | null
          score_sessoes?: number | null
          sessoes_semana?: number | null
          status_demanda?: string | null
          status_financeiro?: string | null
          status_organico?: string | null
          ticket_medio?: number | null
          total_defasados?: number | null
          user_id: string
          week_start: string
        }
        Update: {
          ads_maximo?: number | null
          caixa_livre_real?: number | null
          cpa_medio?: number | null
          created_at?: string | null
          decisao_ads?: string | null
          gasto_ads?: number | null
          id?: string
          modes_full_backup?: Json | null
          pedidos_semana?: number | null
          prioridade_semana?: string | null
          registro_decisao?: string | null
          resultado_mes?: number | null
          roas_medio?: number | null
          score_demanda?: number | null
          score_financeiro?: number | null
          score_organico?: number | null
          score_sessoes?: number | null
          sessoes_semana?: number | null
          status_demanda?: string | null
          status_financeiro?: string | null
          status_organico?: string | null
          ticket_medio?: number | null
          total_defasados?: number | null
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "marketing" | "operacional" | "comercial"
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
      app_role: ["admin", "marketing", "operacional", "comercial"],
    },
  },
} as const
