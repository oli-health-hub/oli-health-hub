import { Component, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../theme/designSystem';
import { reportError } from '../services/sentryService';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Captura erros de renderização em toda a árvore abaixo dela.
 * Sem isto, um crash de render mostra tela branca e derruba o app.
 *
 * - Envia o erro ao Sentry (sem PII — scrubEvent filtra).
 * - Mostra uma tela de recuperação com botão "Tentar novamente".
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    reportError(error, { componentStack: info.componentStack.slice(0, 500) });
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Algo deu errado</Text>
        <Text style={styles.message}>
          Encontramos um problema inesperado. Tente novamente — se persistir,
          feche e reabra o app.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={this.handleReset}
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
        >
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    padding:         spacing.xl,
    backgroundColor: colors.oliBackground,
  },
  icon: {
    fontSize:     48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize:     typography.title2.fontSize,
    fontWeight:   '700',
    color:        colors.oliDarkGray,
    marginBottom: spacing.sm,
    textAlign:    'center',
  },
  message: {
    fontSize:     15,
    color:        colors.oliLightGray,
    textAlign:    'center',
    marginBottom: spacing.xl,
    lineHeight:   22,
  },
  button: {
    backgroundColor:  colors.oliGreen,
    paddingVertical:  spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius:     radius.md,
  },
  buttonText: {
    color:      colors.white,
    fontSize:   16,
    fontWeight: '700',
  },
});
