import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Patient } from '../models/types';
import { colors, spacing, radius, shadows } from '../theme/designSystem';
import { formatDate } from '../utils/formatters';
import { openPatientChat } from '../utils/whatsapp';
import { EncaixeModal } from './EncaixeModal';
import { sendNPS } from '../services/npsService';
import { useAuthStore } from '../store/authStore';

interface Props {
  paciente:              Patient;
  onClose:               () => void;
  /** Sala ativa — passada quando o profissional está em sessão */
  currentRoom?:          string;
  /** Callback chamado quando o profissional confirma o início do atendimento */
  onIniciarAtendimento?: () => void;
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function PacienteDetail({ paciente, onClose, currentRoom, onIniciarAtendimento }: Props) {
  const [showEncaixe, setShowEncaixe] = useState(false);
  const [sendingNPS,  setSendingNPS]  = useState(false);
  const [npsSent,     setNpsSent]     = useState(false);
  const { profile } = useAuthStore();

  const handleSendNPS = async () => {
    if (!profile?.id) return;
    setSendingNPS(true);
    try {
      await sendNPS(paciente, profile.id);
      setNpsSent(true);
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar a pesquisa NPS. Tente novamente.');
    } finally {
      setSendingNPS(false);
    }
  };

  const handleWhatsApp = async () => {
    await openPatientChat(paciente.nome, paciente.telefone);
  };

  const handleIniciar = () => {
    Alert.alert(
      'Iniciar Atendimento',
      `Iniciar atendimento de ${paciente.nome} na ${currentRoom}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Iniciar',
          onPress: () => {
            onIniciarAtendimento?.();
            onClose();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Paciente</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar detalhes do paciente">
          <Text style={styles.closeText}>Fechar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Banner de sala ativa ── */}
        {currentRoom && (
          <TouchableOpacity
            style={styles.sessionBanner}
            onPress={handleIniciar}
            accessibilityLabel={`Iniciar atendimento de ${paciente.nome} na ${currentRoom}`}
          >
            <View style={styles.sessionBannerLeft}>
              <Ionicons name="medkit" size={20} color={colors.white} />
              <View>
                <Text style={styles.sessionBannerTitle}>Iniciar Atendimento</Text>
                <Text style={styles.sessionBannerSub}>{currentRoom} · em uso agora</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        )}

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{paciente.nome.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.nome}>{paciente.nome}</Text>

          <View style={styles.syncBadge}>
            <View style={[styles.syncDot, { backgroundColor: paciente.isSincronizado ? colors.oliGreen : colors.oliGold }]} />
            <Text style={[styles.syncText, { color: paciente.isSincronizado ? colors.oliGreen : colors.oliGold }]}>
              {paciente.isSincronizado ? 'Sincronizado com Communicare' : 'Aguardando sincronização'}
            </Text>
          </View>
        </View>

        {/* Dados pessoais */}
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.sectionTitle}>DADOS PESSOAIS</Text>
          <DetailRow label="Telefone"     value={paciente.telefone} />
          <DetailRow label="CPF"          value={`***.***.${paciente.cpf.slice(-3)}-**`} />
          <DetailRow label="Nascimento"   value={paciente.dataNascimento || 'Não informado'} />
          <DetailRow
            label="Convênio"
            value={
              paciente.convenioTipo === 'convenio' && paciente.convenioNome
                ? paciente.convenioNome
                : 'Particular'
            }
          />
          <DetailRow label="Cadastro"      value={formatDate(paciente.dataCadastro)} />
          <DetailRow label="Consentimento" value={paciente.consentimentoTimestamp ? formatDate(paciente.consentimentoTimestamp) : 'Aguardando'} />
        </View>

        {/* Métricas CRM */}
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.sectionTitle}>MÉTRICAS CRM</Text>
          <DetailRow label="Consultas realizadas"    value="—" />
          <DetailRow label="Retornos"                value="—" />
          <DetailRow label="Aderência ao tratamento" value="—" />
          <DetailRow label="NPS estimado"            value="—" />
          <DetailRow label="Status"                  value="Ativo" />
        </View>

        {/* Ações */}
        <View style={styles.actionsRow}>
          {currentRoom && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={handleIniciar}
              accessibilityLabel={`Iniciar atendimento de ${paciente.nome}`}
            >
              <Ionicons name="medkit-outline" size={18} color={colors.white} />
              <Text style={styles.actionBtnPrimaryText}>Iniciar Atendimento</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnWhatsApp]}
            onPress={handleWhatsApp}
            accessibilityLabel={`Enviar WhatsApp para ${paciente.nome}`}
          >
            <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
            <Text style={styles.actionBtnPrimaryText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {/* Encaixe */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnEncaixe]}
          onPress={() => setShowEncaixe(true)}
          accessibilityLabel={`Sugerir encaixe para ${paciente.nome}`}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.oliGold} />
          <Text style={styles.actionBtnEncaixeText}>Sugerir Encaixe</Text>
        </TouchableOpacity>

        {/* Pesquisa NPS */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnNPS, npsSent && styles.actionBtnNPSSent]}
          onPress={handleSendNPS}
          disabled={sendingNPS || npsSent}
          accessibilityLabel={`Enviar pesquisa NPS para ${paciente.nome}`}
        >
          {sendingNPS ? (
            <ActivityIndicator size="small" color={colors.oliGreen} />
          ) : (
            <Ionicons
              name={npsSent ? 'checkmark-circle-outline' : 'star-outline'}
              size={18}
              color={npsSent ? colors.oliGreen : colors.oliGreen}
            />
          )}
          <Text style={styles.actionBtnNPSText}>
            {npsSent ? 'NPS enviado!' : 'Enviar pesquisa NPS'}
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Modal de encaixe */}
      <Modal visible={showEncaixe} animationType="slide" presentationStyle="pageSheet">
        <EncaixeModal
          paciente={paciente}
          onClose={() => setShowEncaixe(false)}
          onConfirm={() => {
            // Fecha SOMENTE o modal de encaixe. PacienteDetail permanece aberto
            // para evitar bug de Modal aninhado no iOS após retorno do WhatsApp
            // (tela preta / conteúdo vazio). Usuário fecha manualmente.
            setShowEncaixe(false);
          }}
        />
      </Modal>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.oliBackground },
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    padding:           spacing.md,
    backgroundColor:   colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.oliDarkGray },
  closeText:   { fontSize: 16, color: colors.oliGreen },
  scroll:      { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },

  sessionBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: colors.oliGreen,
    borderRadius:    radius.md,
    padding:         spacing.md,
  },
  sessionBannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sessionBannerTitle: { fontSize: 15, fontWeight: '700', color: colors.white },
  sessionBannerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  avatarWrap: { alignItems: 'center' },
  avatar: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: `${colors.oliGreen}26`,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    spacing.sm,
  },
  avatarText: { fontSize: 36, fontWeight: '700', color: colors.oliGreen },
  nome:       { fontSize: 24, fontWeight: '700', color: colors.oliDarkGray },
  syncBadge:  { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  syncDot:    { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  syncText:   { fontSize: 13 },

  card: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    overflow:        'hidden',
  },
  sectionTitle: {
    fontSize:          13,
    fontWeight:        '700',
    color:             colors.gray,
    paddingHorizontal: spacing.md,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },
  row: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical:   12,
    borderTopWidth:    0.5,
    borderTopColor:    `${colors.gray}33`,
  },
  rowLabel: { fontSize: 15, color: colors.gray },
  rowValue: { fontSize: 15, fontWeight: '500', color: colors.oliDarkGray },

  actionsRow:           { flexDirection: 'row', gap: spacing.sm },
  actionBtn:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, padding: spacing.md },
  actionBtnPrimary:     { backgroundColor: colors.oliGreen },
  actionBtnWhatsApp:    { backgroundColor: '#25D366' },
  actionBtnPrimaryText: { color: colors.white, fontSize: 15, fontWeight: '700' },

  actionBtnEncaixe: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    borderRadius:    radius.md,
    padding:         spacing.md,
    backgroundColor: `${colors.oliGold}15`,
    borderWidth:     1,
    borderColor:     `${colors.oliGold}40`,
  },
  actionBtnEncaixeText: { color: colors.oliGold, fontSize: 15, fontWeight: '700' },

  actionBtnNPS: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    borderRadius:    radius.md,
    padding:         spacing.md,
    backgroundColor: `${colors.oliGreen}12`,
    borderWidth:     1,
    borderColor:     `${colors.oliGreen}35`,
  },
  actionBtnNPSSent: {
    backgroundColor: `${colors.oliGreen}20`,
    borderColor:     colors.oliGreen,
  },
  actionBtnNPSText: { color: colors.oliGreen, fontSize: 15, fontWeight: '700' },
});
