import { ScrollView, Text, View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../src/theme/designSystem';

export default function ContratoServicoScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <Ionicons name="briefcase" size={40} color={colors.oliGreen} />
          <Text style={styles.title}>Contrato de Prestação de Serviços</Text>
          <Text style={styles.subtitle}>OLI Health Hub — Versão 1.0 · Junho 2026</Text>
        </View>

        <Section title="1. Partes">
          De um lado, OLI Health Hub Ltda. ("OLI"), operadora do coworking médico e da plataforma digital de mesmo nome. Do outro, o profissional de saúde cadastrado no app ("Profissional"), qualificado pelos dados informados no cadastro (nome, CRM/registro profissional, e-mail).
        </Section>

        <Section title="2. Objeto">
          Prestação de serviços de infraestrutura clínica (salas para atendimento) e ecossistema digital de gestão (agenda, CRM de pacientes, financeiro, acesso a assessorias especializadas e assistentes de IA), conforme o plano contratado pelo Profissional dentro do app.
        </Section>

        <Section title="3. Planos e mensalidade">
          <BulletItem>START — sem mensalidade. Opcionalmente, o Profissional pode aderir a um compromisso de permanência de 6 meses, que dá direito a diagnóstico contábil e jurídico como cortesia única na contratação</BulletItem>
          <BulletItem>PRO — R$ 299,00/mês no ciclo mensal, ou R$ 199,00/mês no ciclo semestral (cobrado mês a mês, com compromisso de permanência de 6 meses)</BulletItem>
          {'\n'}Os valores e recursos de cada plano estão descritos na tela Ecossistema do app e podem ser reajustados mediante aviso prévio de 30 dias. Condições já em vigor para assinantes existentes permanecem congeladas mesmo após mudanças de tabela.
        </Section>

        <Section title="4. Minutagem e uso de salas">
          <BulletItem>START — R$ 1,29/minuto de sala utilizada</BulletItem>
          <BulletItem>PRO — R$ 0,79/minuto</BulletItem>
          {'\n'}A cobrança é calculada pelo tempo real de sessão, medido pelo timer do app desde o check-in até o encerramento da reserva. O pacote de 10 horas pré-pago concede 10% de horas em bônus (10h → 11h) e é debitado por minuto, consumido antes da cobrança avulsa.
        </Section>

        <Section title="5. Faturamento e pagamento">
          As cobranças de mensalidade e minutagem são processadas pela Asaas (instituição de pagamento parceira). Faturas ficam disponíveis na aba Financeiro do app. O atraso no pagamento pode resultar em suspensão do acesso a novas reservas até a regularização, sem prejuízo de outras medidas cabíveis.
        </Section>

        <Section title="6. Vigência">
          Este contrato vigora por prazo indeterminado a partir da aceitação no app, renovando-se automaticamente a cada ciclo de faturamento enquanto o Profissional mantiver conta ativa em plano pago.
        </Section>

        <Section title="7. Rescisão">
          <BulletItem>Pelo Profissional — a qualquer momento, pelo app (Perfil → Meu Plano) ou por e-mail; o cancelamento encerra a renovação ao final do ciclo vigente já pago</BulletItem>
          <BulletItem>Planos com compromisso de permanência de 6 meses (START com compromisso, ou PRO semestral) — o cancelamento antes do fim do período de permanência está sujeito às condições comerciais informadas ao Profissional no momento da contratação</BulletItem>
          <BulletItem>Pela OLI — mediante aviso prévio de 30 dias, ou imediatamente em caso de inadimplência não regularizada ou violação dos Termos de Uso</BulletItem>
        </Section>

        <Section title="8. Obrigações da OLI">
          <BulletItem>Disponibilizar as salas reservadas nas condições anunciadas</BulletItem>
          <BulletItem>Manter a plataforma digital operacional, ressalvadas manutenções programadas</BulletItem>
          <BulletItem>Tratar os dados do Profissional e de seus pacientes conforme a Política de Privacidade e a LGPD</BulletItem>
        </Section>

        <Section title="9. Obrigações do Profissional">
          <BulletItem>Manter cadastro (CRM/registro profissional) verdadeiro e válido</BulletItem>
          <BulletItem>Obter consentimento LGPD dos pacientes antes de cadastrá-los no app</BulletItem>
          <BulletItem>Respeitar os horários reservados e as normas de uso das salas físicas</BulletItem>
          <BulletItem>Manter os pagamentos em dia</BulletItem>
        </Section>

        <Section title="10. Responsabilidade profissional">
          A OLI fornece infraestrutura e tecnologia de gestão, mas não interfere no exercício da atividade clínica. Toda decisão diagnóstica, terapêutica ou ética é de responsabilidade exclusiva do Profissional, perante seu conselho de classe e a legislação aplicável.
        </Section>

        <Section title="11. Módulos e serviços de parceiros">
          Módulos opcionais (assessoria contábil, jurídica, convênios, CRM Communicare) são prestados por parceiros da OLI e sujeitos a contratos e condições próprias, aceitos separadamente no momento da contratação de cada módulo.
        </Section>

        <Section title="12. Alterações contratuais">
          Alterações relevantes neste contrato serão comunicadas via push notification e e-mail com antecedência mínima de 30 dias. A permanência como assinante ativo após esse prazo implica aceite das novas condições.
        </Section>

        <Section title="13. Lei aplicável e foro">
          Este contrato é regido pelas leis brasileiras. Fica eleito o foro da comarca de São Paulo – SP para dirimir controvérsias, com renúncia a qualquer outro, por mais privilegiado que seja.
        </Section>

        <Section title="14. Contato">
          Dúvidas sobre este contrato:{'\n\n'}
          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:contato@olihealthhub.com.br')}
            accessibilityLabel="Enviar e-mail para a OLI Health Hub"
          >
            <Text style={styles.link}>contato@olihealthhub.com.br</Text>
          </TouchableOpacity>
        </Section>

        <View style={styles.footer}>
          <Ionicons name="briefcase-outline" size={16} color={colors.gray} />
          <Text style={styles.footerText}>
            A aceitação deste contrato ocorre com a confirmação de cadastro no app
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
