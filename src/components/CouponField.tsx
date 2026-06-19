import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme/designSystem';
import { validateCouponPreview } from '../services/checkoutService';
import { formatCurrency } from '../utils/formatters';

interface Props {
  targetType:     'modulo' | 'plano' | 'pacote';
  baseValue:      number;
  professionalId: string;
  /** Reporta o cupom aplicado (code=null quando removido/inválido). */
  onApplied: (code: string | null, desconto: number, valorFinal: number) => void;
}

/** Campo de cupom de desconto — valida via RPC e mostra o desconto antes de pagar. */
export function CouponField({ targetType, baseValue, professionalId, onApplied }: Props) {
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState<{ desconto: number } | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const handleApply = async () => {
    const c = code.trim();
    if (!c) return;
    setLoading(true);
    setError(null);
    const res = await validateCouponPreview(c, targetType, baseValue, professionalId);
    setLoading(false);
    if (!res.valid) {
      setError(res.error ?? 'Cupom inválido');
      setApplied(null);
      onApplied(null, 0, baseValue);
      return;
    }
    setApplied({ desconto: res.desconto });
    onApplied(c.toUpperCase(), res.desconto, res.valorFinal);
  };

  const handleRemove = () => {
    setApplied(null);
    setError(null);
    setCode('');
    onApplied(null, 0, baseValue);
  };

  if (applied) {
    return (
      <View style={styles.appliedRow}>
        <Ionicons name="pricetag" size={16} color={colors.oliGreen} />
        <Text style={styles.appliedText}>Cupom aplicado — −{formatCurrency(applied.desconto)}</Text>
        <TouchableOpacity onPress={handleRemove} accessibilityLabel="Remover cupom">
          <Text style={styles.removeText}>Remover</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Tem um cupom?"
          placeholderTextColor={colors.oliLightGray}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Código do cupom"
        />
        <TouchableOpacity
          style={[styles.applyBtn, (!code.trim() || loading) && styles.applyBtnDisabled]}
          onPress={handleApply}
          disabled={loading || !code.trim()}
          accessibilityLabel="Aplicar cupom"
        >
          {loading
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.applyText}>Aplicar</Text>}
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.oliDarkGray,
  },
  applyBtn: {
    backgroundColor: colors.oliGreen,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnDisabled: { opacity: 0.5 },
  applyText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  errorText: { color: colors.oliRed, fontSize: 12 },
  appliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: `${colors.oliGreen}14`,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  appliedText: { flex: 1, color: colors.oliGreen, fontWeight: '600', fontSize: 13 },
  removeText: { color: colors.oliLightGray, fontSize: 12, textDecorationLine: 'underline' },
});
