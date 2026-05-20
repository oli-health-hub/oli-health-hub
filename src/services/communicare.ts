/**
 * Camada de integração com o Communicare.
 *
 * REGRA: nenhuma tela ou store deve chamar o Communicare diretamente.
 * Para trocar mock → API real, altere apenas este arquivo.
 */

// ─── Tipos do Communicare ────────────────────────────────────────────────────

export interface CommunicareProfessional {
  id: string;
  name: string;
  specialty: string;
  planType: 'BASE' | 'PRO' | 'VIP';
  registrationNumber: string; // CRM/CRP/CRO etc.
  /** Duração padrão de consulta definida pelo profissional no cadastro do Communicare (minutos) */
  consultationDurationMinutes: number;
}

export interface CommunicareRoom {
  id: number;
  name: string;
  specialties: string[];
  isAvailable: boolean;
  currentOccupant?: string;
}

export interface CommunicareReservation {
  id: string;
  roomId: number;
  roomName: string;
  professionalId: string;
  startTime: string; // ISO 8601
  endTime: string;
  status: 'confirmed' | 'cancelled' | 'completed';
}

export interface ConsultaStartParams {
  professionalId: string;
  patientName:    string;
  roomName:       string;
  reservationId:  string;
  startedAt:      Date;
}

export interface ConsultaRecord {
  id:             string;
  professionalId: string;
  patientName:    string;
  roomName:       string;
  reservationId:  string;
  startedAt:      string;  // ISO 8601
  status:         'in_progress' | 'completed';
}

export interface ReceptionArrival {
  reservationId: string;
  patientName:   string;
  /** ISO 8601 — momento em que a Claudia fez o check-in no totem/Communicare */
  arrivedAt:     string;
}

export interface CommunicarePatientSummary {
  id:            string;
  nome:          string;
  dataNascimento:string;
  idadeAnos:     number;
  diagnosticoPrincipal: string;
  medicamentosEmUso:    string[];
  alergias:             string[];
  ultimaConsulta:       string;
  observacoes:          string;
  historico: Array<{
    data:         string;
    tipo:         'consulta' | 'retorno' | 'exame';
    descricao:    string;
    profissional: string;
  }>;
}

// ─── Interface (contrato) ────────────────────────────────────────────────────

interface CommunicareService {
  getProfessional(id: string): Promise<CommunicareProfessional>;
  getRooms(date: Date): Promise<CommunicareRoom[]>;
  createReservation(params: {
    roomId: number;
    professionalId: string;
    startTime: Date;
    endTime: Date;
  }): Promise<CommunicareReservation>;
  cancelReservation(id: string): Promise<void>;
  getReservations(professionalId: string, date: Date): Promise<CommunicareReservation[]>;
  syncPatient(professionalId: string, patientId: string): Promise<void>;
  /**
   * Registra o início de uma consulta no Communicare.
   * Vincula o paciente à reserva ativa e abre o atendimento no sistema.
   */
  startConsultation(params: ConsultaStartParams): Promise<ConsultaRecord>;
  /**
   * Encerra uma consulta ativa no Communicare.
   * Chamado tanto pelo app quanto por webhook quando encerrado pelo lado do Communicare.
   */
  endConsultation(consultationId: string, endedAt: Date): Promise<void>;
  /**
   * Retorna o status atual de uma consulta.
   * Usado pelo polling do dashboard para detectar encerramento pelo Communicare.
   */
  getConsultationStatus(consultationId: string): Promise<ConsultaRecord['status']>;
  /**
   * Retorna os check-ins feitos na recepção para a data informada.
   * A Claudia registra a chegada do paciente no Communicare e o app é notificado via polling.
   * Fase 3: substituído por Supabase Realtime subscription.
   */
  getReceptionArrivals(date: Date): Promise<ReceptionArrival[]>;
  /** LGPD Art. 11 — consulta em tempo real, sem cache local */
  getPatientProntuario(patientName: string): Promise<CommunicarePatientSummary | null>;
}

// ─── Mock (ativo durante desenvolvimento) ────────────────────────────────────

class CommunicareMockService implements CommunicareService {
  private fakeDelay = () => new Promise<void>(r => setTimeout(r, 600));

  async getProfessional(id: string): Promise<CommunicareProfessional> {
    await this.fakeDelay();
    return {
      id,
      name: 'Dr. Guilherme Pasquetti',
      specialty: 'Clínica Geral',
      planType: 'PRO',
      registrationNumber: 'CRM-SP 123456',
      consultationDurationMinutes: 60, // Fase 3: lido do perfil real do Communicare
    };
  }

  async getRooms(_date: Date): Promise<CommunicareRoom[]> {
    await this.fakeDelay();
    return [
      { id: 1, name: 'Sala 1',      specialties: ['Ginecologia', 'Estética'],           isAvailable: true  },
      { id: 2, name: 'Sala 2',      specialties: ['Clínica Geral'],                     isAvailable: true  },
      { id: 3, name: 'Sala 3',      specialties: ['Clínica Geral'],                     isAvailable: false, currentOccupant: 'Dra. Ana Lima' },
      { id: 4, name: 'Sala 4',      specialties: ['Clínica Geral'],                     isAvailable: true  },
      { id: 5, name: 'Sala 5',      specialties: ['Clínica Geral'],                     isAvailable: true  },
      { id: 6, name: 'Sala 6',      specialties: ['Psicologia'],                        isAvailable: true  },
      { id: 7, name: 'Sala Digital',specialties: ['Telemedicina', 'Criação de Conteúdo'], isAvailable: true },
    ];
  }

  async createReservation(params: {
    roomId: number;
    professionalId: string;
    startTime: Date;
    endTime: Date;
  }): Promise<CommunicareReservation> {
    await this.fakeDelay();
    return {
      id:             Math.random().toString(36).slice(2),
      roomId:         params.roomId,
      roomName:       `Sala ${params.roomId}`,
      professionalId: params.professionalId,
      startTime:      params.startTime.toISOString(),
      endTime:        params.endTime.toISOString(),
      status:         'confirmed',
    };
  }

  async cancelReservation(_id: string): Promise<void> {
    await this.fakeDelay();
  }

  async getReservations(professionalId: string, _date: Date): Promise<CommunicareReservation[]> {
    await this.fakeDelay();
    const now = new Date();
    return [
      {
        id:             '1',
        roomId:         1,
        roomName:       'Sala 1',
        professionalId,
        startTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        endTime:   new Date(now.getTime() +  5 * 60 * 1000).toISOString(),
        status:    'confirmed',
      },
    ];
  }

  async syncPatient(_professionalId: string, _patientId: string): Promise<void> {
    await this.fakeDelay();
  }

  async startConsultation(params: ConsultaStartParams): Promise<ConsultaRecord> {
    await this.fakeDelay();
    // Fase 3: POST /api/consultations/start
    return {
      id:             Math.random().toString(36).slice(2),
      professionalId: params.professionalId,
      patientName:    params.patientName,
      roomName:       params.roomName,
      reservationId:  params.reservationId,
      startedAt:      params.startedAt.toISOString(),
      status:         'in_progress',
    };
  }

  async endConsultation(_consultationId: string, _endedAt: Date): Promise<void> {
    await this.fakeDelay();
    // Fase 3: PATCH /api/consultations/:id  { status: 'completed', ended_at }
    // O Communicare encerra a consulta e dispara webhook para o app (Supabase Realtime)
  }

  async getReceptionArrivals(_date: Date): Promise<ReceptionArrival[]> {
    await new Promise(r => setTimeout(r, 300));
    // Fase 3: GET /api/reception/arrivals?date=YYYY-MM-DD
    // Simula check-in da Claudia: João Santos chegou 5 min atrás para a consulta das 14h
    const arrivedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    return [
      { reservationId: '2', patientName: 'João Santos', arrivedAt },
    ];
  }

  async getConsultationStatus(_consultationId: string): Promise<ConsultaRecord['status']> {
    await new Promise(r => setTimeout(r, 200));
    // Fase 3: GET /api/consultations/:id → retorna status atual
    // Mock sempre retorna 'in_progress' para não encerrar automaticamente no dev
    return 'in_progress';
  }

  async getPatientProntuario(patientName: string): Promise<CommunicarePatientSummary | null> {
    await this.fakeDelay();
    // Mock — substituído por chamada real ao Communicare na Fase 3
    // LGPD: este dado nunca é salvo localmente; exibido apenas em memória durante a sessão
    return {
      id:              'mock-001',
      nome:            patientName,
      dataNascimento:  '1985-03-22',
      idadeAnos:       41,
      diagnosticoPrincipal: 'Hipertensão arterial sistêmica (CID I10)',
      medicamentosEmUso: [
        'Losartana 50mg — 1x ao dia',
        'Hidroclorotiazida 25mg — 1x ao dia',
      ],
      alergias: ['Dipirona', 'Penicilina'],
      ultimaConsulta: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      observacoes: 'Paciente relata boa adesão ao tratamento. PA controlada na última visita (130/85 mmHg). Solicitar exames de rotina na próxima consulta.',
      historico: [
        {
          data:         new Date(Date.now() - 30  * 24 * 60 * 60 * 1000).toISOString(),
          tipo:         'consulta',
          descricao:    'Consulta de rotina. PA: 130/85. Mantida medicação.',
          profissional: 'Dr. Guilherme Pasquetti',
        },
        {
          data:         new Date(Date.now() - 90  * 24 * 60 * 60 * 1000).toISOString(),
          tipo:         'retorno',
          descricao:    'Retorno pós-ajuste de dose. Melhora clínica.',
          profissional: 'Dr. Guilherme Pasquetti',
        },
        {
          data:         new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
          tipo:         'consulta',
          descricao:    'Primeira consulta. Diagnóstico HAS. Iniciada Losartana.',
          profissional: 'Dr. Guilherme Pasquetti',
        },
      ],
    };
  }
}

// ─── Instância exportada ─────────────────────────────────────────────────────
// Para usar a API real, substitua CommunicareMockService por CommunicareApiService
// sem alterar nenhum outro arquivo.

export const communicareService: CommunicareService = new CommunicareMockService();
