import { ScrollView, Text, View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../src/theme/designSystem';

export default function PoliticaPrivacidadeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={40} color={colors.oliGreen} />
          <Text style={styles.title}>Política de Privacidade</Text>
          <Text style={styles.subtitle}>OLI Health Hub — Versão 1.0 · Maio 2026</Text>
        </View>

        <Section title="1. Quem somos">
          O OLI Health Hub é uma plataforma de gestão para profissionais de saúde, operada pela OLI Health Hub Ltda., localizada na Av. Paulista, São Paulo – SP. Responsável pelo tratamento de dados: Guilherme Pasquetti (guilherme@olihealthhub.com.br).
        </Section>

        <Section title="2. Dados que coletamos">
          <BulletItem>Nome completo, e-mail e CRM/registro profissional</BulletItem>
          <BulletItem>Especialidade médica e duração padrão de consulta</BulletItem>
          <BulletItem>Dados de reservas de sala (horários, duração, sala utilizada)</BulletItem>
          <BulletItem>Dados de pacientes cadastrados com consentimento explícito (nome, telefone, diagnóstico — armazenados criptografados)</BulletItem>
          <BulletItem>Logs de uso para faturamento por minutagem</BulletItem>
          <BulletItem>Dados de autenticação (e-mail, hash de senha — nunca a senha em texto)</BulletItem>
        </Section>

        <Section title="3. Dados que NÃO coletamos">
          <BulletItem>CPF em texto puro — armazenamos apenas hash SHA-256 + últimos 3 dígitos</BulletItem>
          <BulletItem>Dados de cartão de crédito ou conta bancária</BulletItem>
          <BulletItem>Conteúdo de consultas médicas ou prontuários (apenas referência de ID quando integrado ao Communicare)</BulletItem>
          <BulletItem>Localização GPS</BulletItem>
        </Section>

        <Section title="4. Base legal (LGPD)">
          O tratamento de dados se baseia em:
          <BulletItem>Execução de contrato (Art. 7º, V) — para gerenciar reservas e faturamento</BulletItem>
          <BulletItem>Consentimento explícito (Art. 7º, I) — para dados de pacientes cadastrados</BulletItem>
          <BulletItem>Legítimo interesse (Art. 7º, IX) — para segurança e prevenção de fraudes</BulletItem>
          {'\n'}Dados de saúde dos pacientes são tratados como dados sensíveis (Art. 11) com base em consentimento específico registrado com timestamp.
        </Section>

        <Section title="5. Como usamos os dados">
          <BulletItem>Gerenciar reservas de salas e calcular cobrança por minutagem</BulletItem>
          <BulletItem>Enviar notificações de sessão, buffer e alertas de conta</BulletItem>
          <BulletItem>Gerar relatórios de uso para o profissional</BulletItem>
          <BulletItem>Cumprir obrigações legais e tributárias</BulletItem>
          <BulletItem>Melhorar a plataforma com base em dados agregados e anonimizados</BulletItem>
        </Section>

        <Section title="6. Compartilhamento">
          Não vendemos dados pessoais. Compartilhamos apenas com:
          <BulletItem>Supabase (infraestrutura de banco de dados — servidores sa-east-1, Brasil)</BulletItem>
          <BulletItem>Asaas (processamento de pagamentos — PCI DSS)</BulletItem>
          <BulletItem>Communicare (prontuário eletrônico — apenas quando autorizado pelo médico)</BulletItem>
          <BulletItem>Autoridades competentes, quando exigido por lei</BulletItem>
        </Section>

        <Section title="7. Segurança">
          <BulletItem>Dados em trânsito: TLS 1.3</BulletItem>
          <BulletItem>Dados em repouso: criptografia AES-256 (Supabase + expo-secure-store)</BulletItem>
          <BulletItem>Autenticação: MFA TOTP disponível, app lock biométrico</BulletItem>
          <BulletItem>Audit log imutável de acesso a dados de saúde</BulletItem>
          <BulletItem>Rate limiting: máx. 5 tentativas de login por 15 minutos</BulletItem>
        </Section>

        <CheckSection title="8. Seus direitos (LGPD Art. 18)">
          <Text style={styles.sectionBody}>
            Você pode exercer os seguintes direitos pelo app (Perfil → Privacidade) ou por e-mail:
          </Text>
          <CheckItem>Confirmação e acesso — ver todos os dados que temos sobre você</CheckItem>
          <CheckItem>Portabilidade — exportar seus dados em formato JSON</CheckItem>
          <CheckItem>Exclusão — apagar sua conta e todos os dados pessoais</CheckItem>
          <CheckItem>Correção — editar dados incorretos diretamente no app</CheckItem>
          <CheckItem>Revogação de consentimento — remover consentimento dado a qualquer momento</CheckItem>
        </CheckSection>

        <Section title="9. Retenção de dados">
          Dados pessoais são mantidos enquanto a conta estiver ativa. Após exclusão da conta, os dados são removidos em até 15 dias úteis. Logs de auditoria são mantidos por 5 anos para fins de conformidade regulatória.
        </Section>

        <Section title="10. Menores de idade">
          Esta plataforma é destinada exclusivamente a profissionais de saúde habilitados. Não coletamos dados de menores de 18 anos.
        </Section>

        <Section title="11. Alterações nesta política">
          Alterações relevantes serão notificadas via push notification e e-mail com antecedência mínima de 15 dias. O uso continuado após a notificação implica aceite.
        </Section>

        <Section title="12. Contato e DPO">
          Para exercer seus direitos ou tirar dúvidas:{'\n\n'}
          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:privacidade@olihealthhub.com.br')}
            accessibilityLabel="Enviar e-mail para o DPO"
          >
            <Text style={styles.link}>privacidade@olihealthhub.com.br</Text>
          </TouchableOpacity>
        </Section>

        <View style={styles.footer}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.gray} />
          <Text style={styles.footerText}>
            Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

function CheckSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletItem({ children }: { children: ReactNode }) {
  return <Text style={styles.bullet}>{'\n'}• {children}</Text>;
}

function CheckItem({ children }: { children: string }) {
  return (
    <View style={styles.checkRow}>
      <Ionicons name="checkmark-circle" size={16} color={colors.oliGreen} style={styles.checkIcon} />
      <Text style={styles.checkText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { padding: spacing.md, paddingBottom: 48 },

  header: {
    alignItems:    'center',
    paddingVertical: spacing.xl,
    gap:           spacing.sm,
    marginBottom:  spacing.md,
  },
  title:    { fontSize: 22, fontWeight: '800', color: colors.oliDarkGray, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.gray, textAlign: 'center' },

  section: {
    backgroundColor: colors.white,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray, marginBottom: spacing.xs },
  sectionBody:  { fontSize: 14, color: colors.oliLightGray, lineHeight: 22 },
  bullet:       { fontSize: 14, color: colors.oliLightGray, lineHeight: 22 },

  checkRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: spacing.sm },
  checkIcon: { marginTop: 2, flexShrink: 0 },
  checkText: { fontSize: 14, color: colors.oliLightGray, lineHeight: 22, flex: 1 },

  link: { fontSize: 14, color: colors.oliGreen, fontWeight: '700', textDecorationLine: 'underline' },

  footer: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.xs,
    justifyContent: 'center',
    paddingTop:     spacing.lg,
    paddingBottom:  spacing.md,
  },
  footerText: { fontSize: 12, color: colors.gray, textAlign: 'center', flex: 1 },
});
