export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
        Relationships: []
      }
      profiles: {
        Row: {
          consultation_duration_minutes: number
          created_at: string
          crm: string | null
          especialidade: string | null
          id: string
          nome: string
          plan: string
          bio: string | null
          foto_url: string | null
          // Onboarding contábil
          onboarding_complete:      boolean
          situacao_juridica:        string | null
          faturamento_range:        string | null
          atividade_exercida:       string | null
          possui_clt:               boolean | null
          local_atuacao:            string | null
          num_locais:               string | null
          cidade_uf:                string | null
          notas_fiscais_range:      string | null
          possui_funcionarios:      boolean | null
          previsao_contratacao:     boolean | null
          possui_socios:            boolean | null
        }
        Insert: {
          consultation_duration_minutes?: number
          created_at?: string
          crm?: string | null
          especialidade?: string | null
          id: string
          nome: string
          plan?: string
          bio?: string | null
          foto_url?: string | null
          onboarding_complete?:     boolean
          situacao_juridica?:       string | null
          faturamento_range?:       string | null
          atividade_exercida?:      string | null
          possui_clt?:              boolean | null
          local_atuacao?:           string | null
          num_locais?:              string | null
          cidade_uf?:               string | null
          notas_fiscais_range?:     string | null
          possui_funcionarios?:     boolean | null
          previsao_contratacao?:    boolean | null
          possui_socios?:           boolean | null
        }
        Update: {
          consultation_duration_minutes?: number
          created_at?: string
          crm?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
          plan?: string
          bio?: string | null
          foto_url?: string | null
          onboarding_complete?:     boolean
          situacao_juridica?:       string | null
          faturamento_range?:       string | null
          atividade_exercida?:      string | null
          possui_clt?:              boolean | null
          local_atuacao?:           string | null
          num_locais?:              string | null
          cidade_uf?:               string | null
          notas_fiscais_range?:     string | null
          possui_funcionarios?:     boolean | null
          previsao_contratacao?:    boolean | null
          possui_socios?:           boolean | null
        }
        Relationships: []
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
        Relationships: []
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
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
