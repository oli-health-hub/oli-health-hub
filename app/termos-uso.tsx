import { ScrollView, Text, View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../src/theme/designSystem';

export default function TermosUsoScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <Ionicons name="document-text" size={40} color={colors.oliGreen} />
          <Text style={styles.title}>Termos de Uso</Text>
          <Text style={styles.subtitle}>OLI Health Hub — Versão 1.0 · Junho 2026</Text>
        </View>

        <Section title="1. Aceitação dos termos">
          Estes Termos de Uso regem o uso do aplicativo OLI Health Hub, operado pela OLI Health Hub Ltda. Ao criar uma conta ou usar o app, você concorda integralmente com estes termos e com a nossa Política de Privacidade.
        </Section>

        <Section title="2. Quem pode usar">
          O app é destinado exclusivamente a profissionais de saúde de nível superior habilitados (médicos, psicólogos, nutricionistas e demais categorias com registro em conselho profissional — CRM, CRP, CRN, CRO, entre outros), maiores de 18 anos.
        </Section>

        <Section title="3. O que o app oferece">
          <BulletItem>Reserva de salas para atendimento presencial, com cobrança por minutagem</BulletItem>
          <BulletItem>Gestão de pacientes (CRM) com consentimento LGPD</BulletItem>
          <BulletItem>Painel financeiro de faturas e pacotes de horas</BulletItem>
          <BulletItem>Acesso ao ecossistema OLI: especialistas de IA, eventos e módulos parceiros</BulletItem>
          <BulletItem>Planos START, BASE e PRO, com recursos e preços descritos no app</BulletItem>
        </Section>

        <Section title="4. Cadastro e conta">
          Você é responsável por manter a confidencialidade da sua senha e por todas as atividades realizadas na sua conta. Informações cadastrais devem ser verdadeiras, completas e mantidas atualizadas. Recomendamos ativar a verificação em duas etapas (MFA) disponível no app.
        </Section>

        <Section title="5. Planos, cobrança e minutagem">
          <BulletItem>START — sem mensalidade, R$ 1,29/minuto de sala utilizada</BulletItem>
          <BulletItem>PRO — R$ 299,00/mês (ciclo mensal) ou R$ 199,00/mês (ciclo semestral, cobrado mês a mês, com compromisso de permanência de 6 meses), R$ 0,79/minuto</BulletItem>
          <BulletItem>O uso de sala é cobrado por minuto efetivamente utilizado, conforme a tarifa do plano ativo, via Asaas</BulletItem>
          <BulletItem>O pacote de 10 horas pré-pago concede 10% de horas em bônus (10h → 11h); horas são debitadas por minuto e não reembolsáveis após o uso</BulletItem>
          <BulletItem>Alteração de plano tem efeito imediato; condições já em vigor para quem já é assinante permanecem congeladas mesmo após mudanças de tabela</BulletItem>
          <BulletItem>Em caso de inadimplência, a OLI pode suspender o acesso a reservas até a regularização</BulletItem>
        </Section>

        <Section title="6. Cancelamento">
          Você pode cancelar sua assinatura a qualquer momento pelo app (Perfil → Meu Plano) ou por e-mail. O cancelamento encerra a renovação automática ao final do ciclo vigente. Se você aderiu a um plano com compromisso de permanência de 6 meses (START com compromisso, ou PRO semestral), o cancelamento antes do fim desse período segue as condições comerciais informadas no momento da contratação. Reservas de sala já confirmadas seguem a política de cancelamento vigente na tela de reserva.
        </Section>

        <Section title="7. Conduta e uso adequado">
          <BulletItem>É proibido usar o app para fins ilícitos, fraude ou violação de direitos de terceiros</BulletItem>
          <BulletItem>Dados de pacientes só podem ser cadastrados com o consentimento do titular</BulletItem>
          <BulletItem>É proibido compartilhar credenciais de acesso ou tentar burlar mecanismos de segurança</BulletItem>
          <BulletItem>O uso indevido pode resultar em suspensão ou encerramento da conta</BulletItem>
        </Section>

        <Section title="8. Assistentes de IA">
          As respostas dos especialistas de IA (Ana, Isabella, Amanda, Ronaldo e Olivia) têm caráter orientativo e não substituem aconselhamento jurídico, contábil ou médico individualizado. A OLI não se responsabiliza por decisões tomadas exclusivamente com base nessas respostas.
        </Section>

        <Section title="9. Propriedade intelectual">
          O app, sua marca, design e conteúdo são de propriedade da OLI Health Hub Ltda. ou de seus licenciadores. Nenhuma licença é concedida além do direito de uso pessoal do app conforme estes termos.
        </Section>

        <Section title="10. Limitação de responsabilidade">
          O app é fornecido "como está". A OLI Health Hub envida esforços razoáveis para manter a disponibilidade do serviço, mas não garante operação ininterrupta ou livre de erros. A OLI não se responsabiliza por decisões clínicas tomadas pelo profissional nem pelo conteúdo dos atendimentos realizados nas salas.
        </Section>

        <Section title="11. Encerramento de conta">
          Você pode excluir sua conta a qualquer momento pelo app (Perfil → Privacidade → Excluir Conta). A OLI pode suspender ou encerrar contas que violem estes termos, mediante aviso prévio quando possível.
        </Section>

        <Section title="12. Alterações nestes termos">
          Alterações relevantes serão notificadas via push notification e e-mail com antecedência mínima de 15 dias. O uso continuado do app após a notificação implica aceite dos novos termos.
        </Section>

        <Section title="13. Lei aplicável e foro">
          Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de São Paulo – SP para dirimir quaisquer controvérsias.
        </Section>

        <Section title="14. Contato">
          Dúvidas sobre estes termos:{'\n\n'}
          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:contato@olihealthhub.com.br')}
            accessibilityLabel="Enviar e-mail para a OLI Health Hub"
          >
            <Text style={styles.link}>contato@olihealthhub.com.br</Text>
          </TouchableOpacity>
        </Section>

        <View style={styles.footer}>
          <Ionicons name="document-text-outline" size={16} color={colors.gray} />
          <Text style={styles.footerText}>
            Ao usar o OLI Health Hub, você declara ter lido e aceito estes Termos de Uso
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

function BulletItem({ children }: { children: ReactNode }) {
  return <Text style={styles.bullet}>{'\n'}• {children}</Text>;
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
