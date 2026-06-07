import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Patient } from '../models/types';
import { colors, spacing, radius, shadows } from '../theme/designSystem';
import { ccIsConfigured } from '../services/communicareApi';

interface Props {
  paciente:        Patient;
  showSessionHint?: boolean;  // true quando o profissional está em sala ativa
}

export function PacienteRow({ paciente, showSessionHint = false }: Props) {
  const inicial = paciente.nome.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, shadows.small]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{inicial}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.nome}>{paciente.nome}</Text>
        <Text style={styles.telefone}>{paciente.telefone}</Text>
        <View style={styles.badges}>
          <View style={[
            styles.convenioBadge,
            { backgroundColor: paciente.convenioTipo === 'convenio'
                ? `${colors.oliGold}1A`
                : `${colors.oliGreen}1A` },
          ]}>
            <Text style={[
              styles.convenioBadgeText,
              { color: paciente.convenioTipo === 'convenio' ? colors.oliGold : colors.oliGreen },
            ]}>
              {paciente.convenioTipo === 'convenio' && paciente.convenioNome
                ? paciente.convenioNome
                : 'Particular'}
            </Text>
          </View>
        </View>
      </View>

      {showSessionHint ? (
        <Ionicons name="medkit-outline" size={18} color={colors.oliGreen} />
      ) : (
        <SyncBadge paciente={paciente} />
      )}
    </View>
  );
}

// ─── Badge de sincronização Communicare ──────────────────────────────────────
// Estados visíveis: Sincronizado ✓  /  Sincronizando XX%
// Erro nunca aparece — vira retry interno.
function SyncBadge({ paciente }: { paciente: Patient }) {
  // CC desligado → não mostra estado de sync (evita "Sincronizando" falso)
  if (!ccIsConfigured()) return null;

  const isSynced  = paciente.syncStatus === 'synced' || paciente.isSincronizado;
  const progress  = paciente.syncProgress ?? 0;

  if (isSynced) {
    return (
      <View style={styles.syncWrap} accessibilityLabel="Sincronizado com Communicare">
        <Ionicons name="checkmark-circle" size={16} color={colors.oliGreen} />
      </View>
    );
  }
  return (
    <View style={styles.syncWrap} accessibilityLabel={`Sincronizando ${progress}%`}>
      <Ionicons name="sync" size={14} color={colors.oliGold} />
      <Text style={styles.syncPct}>{progress}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  colors.white,
    borderRadius:     radius.md,
    padding:          spacing.md,
    marginBottom:     spacing.sm,
  },
  avatar: {
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: `${colors.oliGreen}26`,
    justifyContent:  'center',
    alignItems:      'center',
    marginRight:     spacing.md,
  },
  avatarText: {
    fontSize:   20,
    fontWeight: '700',
    color:      colors.oliGreen,
  },
  info: { flex: 1 },
  nome: {
    fontSize:   16,
    fontWeight: '500',
    color:      colors.oliDarkGray,
  },
  telefone: {
    fontSize:  13,
    color:     colors.gray,
    marginTop: 2,
  },
  badges: { flexDirection: 'row', marginTop: 6, gap: 6 },
  convenioBadge: {
    borderRadius:      radius.sm,
    paddingHorizontal: 8,
    paddingVertical:   2,
    alignSelf:         'flex-start',
  },
  convenioBadgeText: { fontSize: 11, fontWeight: '700' },
  syncDot: {
    width:        10,
    height:       10,
    borderRadius: 5,
    marginLeft:   spacing.sm,
  },
  syncWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginLeft:    spacing.sm,
  },
  syncPct: {
    fontSize:   10,
    fontWeight: '700',
    color:      colors.oliGold,
  },
});
