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
          created_at: string
          id: string
          metadata: Json | null
          professional_id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          professional_id: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          professional_id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_attempts: {
        Row: {
          created_at: string
          id: string
          identifier: string
          ip_address: unknown
          succeeded: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          ip_address?: unknown
          succeeded?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          ip_address?: unknown
          succeeded?: boolean
        }
        Relationships: []
      }
      hour_balance: {
        Row: {
          asaas_charge_id: string | null
          created_at: string
          expira_em: string
          id: string
          minutos_total: number
          minutos_usados: number
          package_id: string | null
          professional_id: string
        }
        Insert: {
          asaas_charge_id?: string | null
          created_at?: string
          expira_em: string
          id?: string
          minutos_total: number
          minutos_usados?: number
          package_id?: string | null
          professional_id: string
        }
        Update: {
          asaas_charge_id?: string | null
          created_at?: string
          expira_em?: string
          id?: string
          minutos_total?: number
          minutos_usados?: number
          package_id?: string | null
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hour_balance_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "hour_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_balance_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hour_packages: {
        Row: {
          ativo: boolean
          created_at: string
          horas: number
          id: string
          nome: string
          validade_dias: number
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          horas: number
          id?: string
          nome: string
          validade_dias?: number
          valor: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          horas?: number
          id?: string
          nome?: string
          validade_dias?: number
          valor?: number
        }
        Relationships: []
      }
      modules: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          slug: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          slug?: string | null
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          slug?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      nps_responses: {
        Row: {
          comment: string | null
          context: string
          created_at: string | null
          id: string
          professional_id: string
          score: number
        }
        Insert: {
          comment?: string | null
          context?: string
          created_at?: string | null
          id?: string
          professional_id: string
          score: number
        }
        Update: {
          comment?: string | null
          context?: string
          created_at?: string | null
          id?: string
          professional_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          communicare_id: string | null
          consentimento_timestamp: string
          convenio_nome: string | null
          convenio_tipo: string
          cpf_hash: string | null
          created_at: string
          data_nascimento: string | null
          id: string
          is_sincronizado: boolean
          nome: string
          professional_id: string
          telefone: string
          updated_at: string
        }
        Insert: {
          communicare_id?: string | null
          consentimento_timestamp: string
          convenio_nome?: string | null
          convenio_tipo?: string
          cpf_hash?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          is_sincronizado?: boolean
          nome: string
          professional_id: string
          telefone: string
          updated_at?: string
        }
        Update: {
          communicare_id?: string | null
          consentimento_timestamp?: string
          convenio_nome?: string | null
          convenio_tipo?: string
          cpf_hash?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          is_sincronizado?: boolean
          nome?: string
          professional_id?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          ativo: boolean
          created_at: string
          features: Json
          id: string
          name: string
          preco_anual: number
          preco_mensal: number
          taxa_min: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          features?: Json
          id?: string
          name: string
          preco_anual: number
          preco_mensal: number
          taxa_min: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          features?: Json
          id?: string
          name?: string
          preco_anual?: number
          preco_mensal?: number
          taxa_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          atividade_exercida: string | null
          bio: string | null
          cidade_uf: string | null
          como_conheceu: string | null
          consultation_duration_minutes: number
          convenios: string[] | null
          created_at: string
          crm: string | null
          especialidade: string | null
          faturamento_range: string | null
          foto_url: string | null
          id: string
          local_atuacao: string | null
          nome: string
          notas_fiscais_range: string | null
          num_locais: string | null
          onboarding_complete: boolean
          plan: string
          plan_id: string | null
          possui_clt: boolean | null
          possui_funcionarios: boolean | null
          possui_socios: boolean | null
          pre_paid_ok: boolean
          previsao_contratacao: boolean | null
          referido_por: string | null
          situacao_juridica: string | null
          tipos_atendimento: string[] | null
          user_type: string
        }
        Insert: {
          atividade_exercida?: string | null
          bio?: string | null
          cidade_uf?: string | null
          como_conheceu?: string | null
          consultation_duration_minutes?: number
          convenios?: string[] | null
          created_at?: string
          crm?: string | null
          especialidade?: string | null
          faturamento_range?: string | null
          foto_url?: string | null
          id: string
          local_atuacao?: string | null
          nome: string
          notas_fiscais_range?: string | null
          num_locais?: string | null
          onboarding_complete?: boolean
          plan?: string
          plan_id?: string | null
          possui_clt?: boolean | null
          possui_funcionarios?: boolean | null
          possui_socios?: boolean | null
          pre_paid_ok?: boolean
          previsao_contratacao?: boolean | null
          referido_por?: string | null
          situacao_juridica?: string | null
          tipos_atendimento?: string[] | null
          user_type?: string
        }
        Update: {
          atividade_exercida?: string | null
          bio?: string | null
          cidade_uf?: string | null
          como_conheceu?: string | null
          consultation_duration_minutes?: number
          convenios?: string[] | null
          created_at?: string
          crm?: string | null
          especialidade?: string | null
          faturamento_range?: string | null
          foto_url?: string | null
          id?: string
          local_atuacao?: string | null
          nome?: string
          notas_fiscais_range?: string | null
          num_locais?: string | null
          onboarding_complete?: boolean
          plan?: string
          plan_id?: string | null
          possui_clt?: boolean | null
          possui_funcionarios?: boolean | null
          possui_socios?: boolean | null
          pre_paid_ok?: boolean
          previsao_contratacao?: boolean | null
          referido_por?: string | null
          situacao_juridica?: string | null
          tipos_atendimento?: string[] | null
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referido_por_fkey"
            columns: ["referido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          beneficio_aplicado: boolean
          codigo: string
          created_at: string
          id: string
          indicado_id: string | null
          indicador_id: string
          status: string
        }
        Insert: {
          beneficio_aplicado?: boolean
          codigo: string
          created_at?: string
          id?: string
          indicado_id?: string | null
          indicador_id: string
          status?: string
        }
        Update: {
          beneficio_aplicado?: boolean
          codigo?: string
          created_at?: string
          id?: string
          indicado_id?: string | null
          indicador_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_indicado_id_fkey"
            columns: ["indicado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          arrived_at: string | null
          consultation_ended_at: string | null
          consultation_started_at: string | null
          created_at: string
          end_time: string
          id: string
          professional_id: string
          room_name: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          consultation_ended_at?: string | null
          consultation_started_at?: string | null
          created_at?: string
          end_time: string
          id?: string
          professional_id: string
          room_name: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          consultation_ended_at?: string | null
          consultation_started_at?: string | null
          created_at?: string
          end_time?: string
          id?: string
          professional_id?: string
          room_name?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          id: number
          is_available: boolean
          items: string[]
          name: string
          note: string | null
          occupied_by: string | null
          specialties: string[]
          updated_at: string
        }
        Insert: {
          id?: number
          is_available?: boolean
          items?: string[]
          name: string
          note?: string | null
          occupied_by?: string | null
          specialties?: string[]
          updated_at?: string
        }
        Update: {
          id?: number
          is_available?: boolean
          items?: string[]
          name?: string
          note?: string | null
          occupied_by?: string | null
          specialties?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          asaas_id_enc: string | null
          asaas_id_plain: string | null
          cancelled_at: string | null
          ciclo: string
          created_at: string
          ends_at: string | null
          id: string
          plan_id: string
          professional_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          asaas_id_enc?: string | null
          asaas_id_plain?: string | null
          cancelled_at?: string | null
          ciclo: string
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_id: string
          professional_id: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          asaas_id_enc?: string | null
          asaas_id_plain?: string | null
          cancelled_at?: string | null
          ciclo?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_id?: string
          professional_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_charges: {
        Row: {
          created_at: string
          encerrado_em: string
          hour_balance_id: string | null
          id: string
          iniciado_em: string
          minutos: number
          professional_id: string
          reservation_id: string | null
          subscription_id: string | null
          taxa_min: number
          tipo_cobranca: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          encerrado_em: string
          hour_balance_id?: string | null
          id?: string
          iniciado_em: string
          minutos: number
          professional_id: string
          reservation_id?: string | null
          subscription_id?: string | null
          taxa_min: number
          tipo_cobranca: string
          valor_total: number
        }
        Update: {
          created_at?: string
          encerrado_em?: string
          hour_balance_id?: string | null
          id?: string
          iniciado_em?: string
          minutos?: number
          professional_id?: string
          reservation_id?: string | null
          subscription_id?: string | null
          taxa_min?: number
          tipo_cobranca?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_charges_hour_balance_id_fkey"
            columns: ["hour_balance_id"]
            isOneToOne: false
            referencedRelation: "hour_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_charges_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_charges_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_charges_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_modules: {
        Row: {
          activated_at: string | null
          asaas_id_enc: string | null
          asaas_id_plain: string | null
          ativo_ate: string | null
          config: Json
          contract_url: string | null
          created_at: string
          id: string
          module_id: string
          professional_id: string
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          asaas_id_enc?: string | null
          asaas_id_plain?: string | null
          ativo_ate?: string | null
          config?: Json
          contract_url?: string | null
          created_at?: string
          id?: string
          module_id: string
          professional_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          asaas_id_enc?: string | null
          asaas_id_plain?: string | null
          ativo_ate?: string | null
          config?: Json
          contract_url?: string | null
          created_at?: string
          id?: string
          module_id?: string
          professional_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_modules_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      subscriptions_readable: {
        Row: {
          asaas_id: string | null
          cancelled_at: string | null
          ciclo: string | null
          created_at: string | null
          ends_at: string | null
          id: string | null
          plan_id: string | null
          professional_id: string | null
          starts_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          asaas_id?: never
          cancelled_at?: string | null
          ciclo?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string | null
          plan_id?: string | null
          professional_id?: string | null
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          asaas_id?: never
          cancelled_at?: string | null
          ciclo?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string | null
          plan_id?: string | null
          professional_id?: string | null
          starts_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_auth_rate_limit: { Args: { p_identifier: string }; Returns: Json }
      clear_auth_attempts: {
        Args: { p_identifier: string }
        Returns: undefined
      }
      delete_account_data: { Args: { p_user_id: string }; Returns: Json }
      export_my_data: { Args: never; Returns: Json }
      is_oli_admin: { Args: never; Returns: boolean }
      oli_decrypt: { Args: { cipher: string }; Returns: string }
      oli_encrypt: { Args: { plain: string }; Returns: string }
      record_auth_attempt: {
        Args: { p_identifier: string; p_ip?: string; p_succeeded: boolean }
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
    Enums: {},
  },
} as const
