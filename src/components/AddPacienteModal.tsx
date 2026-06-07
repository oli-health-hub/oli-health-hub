import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePatientStore } from '../store/patientStore';
import { notifyPatientCadastro, notifyOLINewPatient, notifyPatientLGPDConsent } from '../utils/whatsapp';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, radius } from '../theme/designSystem';
import type { ConvenioTipo } from '../models/types';
import { getHealthPlans } from '../services/healthPlans';
import type { CCHealthPlan } from '../services/communicareApi';

interface Props {
  onClose: () => void;
}

// ─── Máscaras automáticas ─────────────────────────────────────────────────────

function maskDate(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function maskCPF(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function isValidDate(value: string): boolean {
  if (value.length !== 10) return false;
  const [dd, mm, yyyy] = value.split('/').map(Number);
  if (!dd || !mm || !yyyy) return false;
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;
  if (yyyy < 1900 || yyyy > new Date().getFullYear()) return false;
  return true;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function AddPacienteModal({ onClose }: Props) {
  const addPatient  = usePatientStore(s => s.addPatient);
  const { profile } = useAuthStore();

  const [nome,         setNome]         = useState('');
  const [telefone,     setTelefone]     = useState('');
  const [cpf,          setCpf]          = useState('');
  const [dataNasc,     setDataNasc]     = useState('');
  const [dateError,    setDateError]    = useState('');
  const [convenioTipo, setConvenioTipo] = useState<ConvenioTipo>('particular');
  const [convenioNome, setConvenioNome] = useState('');
  const [email,        setEmail]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [healthPlans,  setHealthPlans]  = useState<CCHealthPlan[]>([]);
  const [planId,       setPlanId]       = useState<string | undefined>(undefined);

  // Carrega convênios do Communicare (cacheado). Vazio = mantém texto livre.
  useEffect(() => {
    let active = true;
    getHealthPlans().then(plans => { if (active) setHealthPlans(plans); });
    return () => { active = false; };
  }, []);

  const convenioValido = convenioTipo === 'particular' || convenioNome.trim().length > 0;
  const isValid = nome.trim() && telefone.trim() && cpf.replace(/\D/g, '').length === 11
    && convenioValido;

  const handleDateChange = (text: string) => {
    const masked = maskDate(text);
    setDataNasc(masked);
    if (masked.length === 10) {
      setDateError(isValidDate(masked) ? '' : 'Data inválida. Verifique o dia e mês.');
    } else {
      setDateError('');
    }
  };

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert('Campos obrigatórios', 'Preencha todos os campos antes de continuar.');
      return;
    }
    if (dataNasc && !isValidDate(dataNasc)) {
      Alert.alert('Data inválida', 'Verifique a data de nascimento.');
      return;
    }
    setLoading(true);
    try {
      // Salva sem consentimento — pendente até o paciente confirmar via link
      const { consentToken } = await addPatient({
        nome:                   nome.trim(),
        telefone:               telefone.trim(),
        cpf:                    cpf.replace(/\D/g, ''),
        dataNascimento:         dataNasc.trim(),
        convenioTipo,
        convenioNome:           convenioTipo === 'convenio' ? convenioNome.trim() : undefined,
        consentimentoTimestamp: new Date().toISOString(), // timestamp do cadastro
        email:                  email.trim() || undefined,
        healthPlanId:           convenioTipo === 'convenio' ? planId : undefined,
      }, profile?.id); // ← ID do profissional obrigatório para persistir no Supabase
      const doctorName = profile?.nome ?? 'seu médico';
      // Envia link de consentimento LGPD ao paciente (token único)
      try { await notifyPatientLGPDConsent(nome, telefone, doctorName, consentToken); } catch { /* sem WhatsApp */ }
      // Notifica a recepção do OLI
      try { await notifyOLINewPatient(nome, telefone); } catch { /* sem WhatsApp */ }
      onClose();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o paciente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.safe} edges={['top']}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Novo Paciente</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Cancelar cadastro">
          <Text style={styles.cancel}>Cancelar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Dados Pessoais ── */}
        <SectionLabel text="DADOS PESSOAIS" />

        <Field label="Nome Completo *">
          <TextInput
            style={styles.input}
            placeholder="Ex: Maria da Silva"
            placeholderTextColor={colors.gray}
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
            accessibilityLabel="Nome completo do paciente"
          />
        </Field>

        <Field label="Telefone (WhatsApp) *">
          <TextInput
            style={styles.input}
            placeholder="(11) 99999-9999"
            placeholderTextColor={colors.gray}
            value={telefone}
            onChangeText={v => setTelefone(maskPhone(v))}
            keyboardType="phone-pad"
            accessibilityLabel="Telefone do paciente"
          />
        </Field>

        <Field label="CPF *">
          <TextInput
            style={styles.input}
            placeholder="000.000.000-00"
            placeholderTextColor={colors.gray}
            value={cpf}
            onChangeText={v => setCpf(maskCPF(v))}
            keyboardType="numeric"
            accessibilityLabel="CPF do paciente"
          />
        </Field>

        <Field
          label="Data de Nascimento"
          hint={dateError}
          hintIsError
        >
          <TextInput
            style={[styles.input, dateError ? styles.inputError : null]}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={colors.gray}
            value={dataNasc}
            onChangeText={handleDateChange}
            keyboardType="numeric"
            maxLength={10}
            accessibilityLabel="Data de nascimento do paciente"
          />
        </Field>

        {/* Email opcional — mesmo campo do Communicare para evitar duplicidade */}
        <Field label="Email (opcional)">
          <TextInput
            style={styles.input}
            placeholder="paciente@email.com"
            placeholderTextColor={colors.gray}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            accessibilityLabel="Email do paciente"
          />
        </Field>

        {/* ── Convênio ── */}
        <SectionLabel text="CONVÊNIO / FORMA DE PAGAMENTO" />

        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segmentBtn, convenioTipo === 'particular' && styles.segmentBtnActive]}
            onPress={() => { setConvenioTipo('particular'); setConvenioNome(''); }}
            accessibilityLabel="Particular"
            accessibilityState={{ selected: convenioTipo === 'particular' }}
          >
            <Ionicons
              name="wallet-outline"
              size={16}
              color={convenioTipo === 'particular' ? colors.white : colors.oliDarkGray}
            />
            <Text style={[styles.segmentText, convenioTipo === 'particular' && styles.segmentTextActive]}>
              Particular
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, convenioTipo === 'convenio' && styles.segmentBtnActive]}
            onPress={() => setConvenioTipo('convenio')}
            accessibilityLabel="Convênio"
            accessibilityState={{ selected: convenioTipo === 'convenio' }}
          >
            <Ionicons
              name="card-outline"
              size={16}
              color={convenioTipo === 'convenio' ? colors.white : colors.oliDarkGray}
            />
            <Text style={[styles.segmentText, convenioTipo === 'convenio' && styles.segmentTextActive]}>
              Convênio
            </Text>
          </TouchableOpacity>
        </View>

        {convenioTipo === 'convenio' && (
          healthPlans.length > 0 ? (
            <Field label="Convênio *">
              <View style={styles.planList}>
                {healthPlans
                  .filter(p => p.name.toLowerCase() !== 'particular')
                  .map(p => {
                    const selected = planId === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.planChip, selected && styles.planChipActive]}
                        onPress={() => { setPlanId(p.id); setConvenioNome(p.name); }}
                        accessibilityLabel={`Convênio ${p.name}`}
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.planChipText, selected && styles.planChipTextActive]}>
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </Field>
          ) : (
            <Field label="Nome do Convênio *">
              <TextInput
                style={styles.input}
                placeholder="Ex: Unimed, Bradesco Saúde, Amil..."
                placeholderTextColor={colors.gray}
                value={convenioNome}
                onChangeText={setConvenioNome}
                autoCapitalize="words"
                accessibilityLabel="Nome do convênio do paciente"
              />
            </Field>
          )
        )}

        {/* ── Communicare ── */}
        <View style={styles.syncNote}>
          <Ionicons name="cloud-outline" size={14} color={colors.oliGreen} />
          <Text style={styles.syncNoteText}>
            Estes dados serão sincronizados automaticamente com o Communicare após o cadastro.
          </Text>
        </View>

        {/* ── LGPD: consentimento coletado pelo paciente ── */}
        <View style={styles.lgpdNote}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.oliGreen} style={{ marginTop: 1 }} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.lgpdTitle}>Consentimento LGPD</Text>
            <Text style={styles.lgpdBody}>
              Ao salvar, o paciente receberá automaticamente um WhatsApp solicitando autorização expressa para uso dos dados,
              conforme a Lei 13.709/2018. O cadastro ficará marcado como{' '}
              <Text style={styles.lgpdPending}>Aguardando Autorização</Text>
              {' '}até a confirmação.
            </Text>
          </View>
        </View>

        {/* Espaço extra para não ficar colado na borda ao rolar */}
        <View style={{ height: 8 }} />
      </ScrollView>

      {/* ── Botão fora do ScrollView — sempre visível acima do teclado ── */}
      <View style={styles.saveArea}>
        <TouchableOpacity
          style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!isValid || loading}
          accessibilityLabel="Salvar paciente e solicitar autorização LGPD"
        >
          <Text style={styles.saveText}>{loading ? 'Salvando...' : 'Salvar e Solicitar Autorização'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function Field({
  label, hint, hintIsError, children,
}: { label: string; hint?: string; hintIsError?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? (
        <Text style={[styles.fieldHint, hintIsError && styles.fieldHintError]}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.white },
  flex:   { flex: 1 },
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    padding:           spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title:  { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },
  cancel: { fontSize: 16, color: colors.oliGreen },
  scroll: { padding: spacing.md, flex: 1 },
  saveArea: {
    padding:          spacing.md,
    paddingTop:       spacing.sm,
    borderTopWidth:   0.5,
    borderTopColor:   colors.border,
    backgroundColor:  colors.white,
  },

  sectionLabel: {
    fontSize:     11,
    fontWeight:   '700',
    color:        colors.gray,
    letterSpacing: 0.5,
    marginTop:    spacing.lg,
    marginBottom: spacing.sm,
  },

  fieldWrap:      { marginBottom: spacing.sm },
  fieldLabel:     { fontSize: 13, fontWeight: '600', color: colors.oliDarkGray, marginBottom: 6 },
  fieldHint:      { fontSize: 12, color: colors.gray, marginTop: 4 },
  fieldHintError: { color: colors.oliRed },

  input: {
    borderWidth:     1,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    padding:         spacing.md,
    fontSize:        16,
    color:           colors.oliDarkGray,
    backgroundColor: colors.white,
  },
  inputError: { borderColor: colors.oliRed },

  segmentRow: {
    flexDirection:  'row',
    gap:            spacing.sm,
    marginBottom:   spacing.sm,
  },
  segmentBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    paddingVertical: 12,
    borderRadius:    radius.md,
    borderWidth:     1.5,
    borderColor:     colors.border,
    backgroundColor: colors.white,
  },
  segmentBtnActive: {
    backgroundColor: colors.oliGreen,
    borderColor:     colors.oliGreen,
  },
  segmentText:       { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  segmentTextActive: { color: colors.white },

  planList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  planChip: {
    borderWidth:       1,
    borderColor:       `${colors.oliDarkGray}33`,
    borderRadius:      radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  planChipActive:     { backgroundColor: colors.oliGreen, borderColor: colors.oliGreen },
  planChipText:       { fontSize: 13, fontWeight: '600', color: colors.oliDarkGray },
  planChipTextActive: { color: colors.white },

  syncNote: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            6,
    backgroundColor:`${colors.oliGreen}0F`,
    borderRadius:   radius.sm,
    padding:        10,
    marginTop:      spacing.sm,
    marginBottom:   spacing.md,
  },
  syncNoteText: { flex: 1, fontSize: 12, color: colors.oliGreen, lineHeight: 18 },

  lgpdNote: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.sm,
    backgroundColor: `${colors.oliGreen}10`,
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginTop:       spacing.sm,
    marginBottom:    spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.oliGreen,
  },
  lgpdTitle:   { fontSize: 13, fontWeight: '700', color: colors.oliDarkGray },
  lgpdBody:    { fontSize: 12, color: colors.gray, lineHeight: 18 },
  lgpdPending: { color: colors.oliGold, fontWeight: '700' },

  saveButton: {
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    padding:         spacing.md,
    alignItems:      'center',
  },
  saveButtonDisabled: { backgroundColor: `${colors.gray}80` },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
