import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { colors, spacing, radius, shadows } from '../src/theme/designSystem';

// Fotos reais das agentes (salvar em assets/images/agentes/)
const AGENT_PHOTOS: Partial<Record<string, ReturnType<typeof require>>> = {
  ana:      require('../assets/images/agentes/ana-luiza.jpg'),
  isabella: require('../assets/images/agentes/isabella.jpg'),
};

// ─── Personas ─────────────────────────────────────────────────────────────────

type Persona = 'ana' | 'isabella' | 'olivia';

interface PersonaConfig {
  name:      string;
  role:      string;
  avatar:    string;
  color:     string;
  subtitle:  string;
  welcome:   string;
  respond:   (query: string) => string;
}

const PERSONAS: Record<Persona, PersonaConfig> = {
  ana: {
    name:    'Ana Luiza',
    role:    'Assessoria Jurídica',
    avatar:  'A',
    color:   colors.oliGreen,
    subtitle:'CFM, LGPD e Código Civil',
    welcome:
      'Olá! Sou a Ana Luiza, sua assistente jurídica do OLI Health Hub.\n\n' +
      'Posso ajudar com:\n' +
      '• Termos de consentimento (TCLE)\n' +
      '• Publicidade médica (Instagram, antes/depois)\n' +
      '• LGPD e dados de pacientes\n' +
      '• Prontuário defensivo\n' +
      '• Contratos com clínicas e convênios',
    respond(q) {
      const query = q.toLowerCase();
      if (query.includes('consentimento') || query.includes('tcle'))
        return 'O TCLE é obrigatório pelo Art. 22 do Código de Ética Médica.\n\n**Deve conter:**\n• Descrição do procedimento em linguagem acessível\n• Riscos e benefícios esperados\n• Alternativas disponíveis\n• Assinatura do paciente e do médico\n• Data e local\n\nDeseja um modelo de TCLE para a sua especialidade?';
      if (query.includes('instagram') || query.includes('foto') || query.includes('antes e depois'))
        return 'A Resolução CFM nº 2.336/2023 regula publicidade médica nas redes sociais.\n\n**Para publicar antes/depois:**\n• Consentimento escrito e específico do paciente\n• Proibido prometer resultados\n• Proibido usar imagens de terceiros sem autorização\n• Identificar como publicidade médica\n\n⚠️ Infrações geram processo ético no CRM.';
      if (query.includes('lgpd') || query.includes('dado') || query.includes('whatsapp'))
        return 'Dados de saúde são **dados sensíveis** pela LGPD (Art. 5º, II).\n\n**Regras para WhatsApp:**\n• Consentimento explícito antes de enviar qualquer dado\n• Nunca enviar prontuários por grupos\n• Guarde registro do consentimento com timestamp\n\nEste app registra automaticamente o consentimento no cadastro.';
      if (query.includes('prontuário') || query.includes('processo'))
        return 'O prontuário é sua principal defesa em processos.\n\n**Prontuário defensivo:**\n• Registre TUDO: queixas, exame físico, conduta\n• Documente recusas de tratamento\n• Prazo de guarda: **20 anos** (CFM 1.638/2002)\n\n⚠️ Prontuário incompleto é presumido como negligência.';
      if (query.includes('contrato') || query.includes('convênio'))
        return 'Contratos com clínicas — pontos críticos:\n\n• **Exclusividade:** verifique restrições à sua atuação\n• **Rescisão:** mínimo 30 dias de aviso\n• **Propriedade dos pacientes:** são seus, não da clínica\n• **Glosas:** defina prazo máximo para contestação';
      return 'Essa questão requer análise mais aprofundada pela Dra. Ana.\n\nVou encaminhar para ela responder em até 24h úteis.\n\nOu fale com a recepção: (11) 99763-9711';
    },
  },

  isabella: {
    name:    'Isabella',
    role:    'Contabilidade',
    avatar:  'I',
    color:   colors.oliGold,
    subtitle:'Impostos, MEI, Nota Fiscal e Pró-labore',
    welcome:
      'Olá! Sou a Isabella, contadora do OLI Health Hub.\n\n' +
      'Posso ajudar com:\n' +
      '• Abertura e gestão de MEI / PJ médica\n' +
      '• Nota fiscal de consultas e procedimentos\n' +
      '• Pró-labore e distribuição de lucros\n' +
      '• Imposto de renda (IRPF / IRPJ)\n' +
      '• Convênios e faturamento',
    respond(q) {
      const query = q.toLowerCase();
      if (query.includes('mei') || query.includes('pessoa jurídica') || query.includes('pj'))
        return 'Para médicos, a abertura de PJ é mais vantajosa que MEI (limite do MEI é R$81k/ano).\n\n**Opções mais comuns:**\n• **Simples Nacional** — alíquota a partir de 6% (Anexo III)\n• **Lucro Presumido** — indicado para faturamento acima de R$180k/ano\n\nPrecisa de ajuda para abrir sua PJ? Podemos agendar uma consultoria completa.';
      if (query.includes('nota fiscal') || query.includes('nf') || query.includes('nfs'))
        return 'Para consultas médicas:\n\n• Emita **NFS-e** (Nota Fiscal de Serviço Eletrônica) pelo sistema da prefeitura\n• Código do serviço: geralmente **8.01** (Medicina)\n• Alíquota ISS: varia de 2% a 5% conforme o município\n• Obrigatorio para PJ — MEI médico é vedado pelo CRM\n\n⚠️ Consultas sem nota fiscal configuram sonegação fiscal.';
      if (query.includes('pró-labore') || query.includes('pro labore') || query.includes('prolabore'))
        return 'Pró-labore é a remuneração do sócio-administrador.\n\n**Regras:**\n• Mínimo: 1 salário mínimo (para recolhimento do INSS)\n• INSS: 11% retido (até o teto)\n• IRRF: conforme tabela progressiva\n• Distribuição de lucros: **isenta de IR** se contabilidade regular\n\nPlanejar bem o pró-labore pode reduzir a carga tributária significativamente.';
      if (query.includes('imposto') || query.includes('ir') || query.includes('irpf') || query.includes('declaração'))
        return 'Para médicos PF que também têm PJ:\n\n• Declare rendimentos do pró-labore como **rendimentos tributáveis**\n• Distribuição de lucros: **rendimentos isentos**\n• Despesas dedutíveis: livros, congressos, equipamentos\n• Guarde todos os recibos por **5 anos**\n\nO prazo de entrega do IRPF costuma ser em abril. Vou te avisar com antecedência!';
      if (query.includes('convênio') || query.includes('faturamento') || query.includes('glosa'))
        return 'Faturamento de convênios — dicas práticas:\n\n• Envie as guias em até 30 dias do atendimento\n• Guarde prontuário e guia assinada por **5 anos**\n• **Glosas:** conteste em até 30 dias com documentação\n• Negocie reajuste anual (INPC ou IPCA)\n\n⚠️ Tabela CBHPM é a referência mínima de honorários.';
      return 'Para uma orientação mais detalhada sobre este assunto, a Isabella pode ser consultada diretamente.\n\nAgende uma consulta contábil pelo WhatsApp da recepção: (11) 99763-9711';
    },
  },

  olivia: {
    name:    'Olivia',
    role:    'OLI Health Hub',
    avatar:  'O',
    color:   '#7B9E82',
    subtitle:'Infraestrutura, planos, reservas e eventos',
    welcome:
      'Olá! Sou a Olivia, assistente do OLI Health Hub.\n\n' +
      'Posso ajudar com:\n' +
      '• Informações sobre salas e infraestrutura\n' +
      '• Planos STARTER, PRO e VIP\n' +
      '• Reservas e horários disponíveis\n' +
      '• Eventos e workshops do OLI\n' +
      '• Dúvidas gerais sobre o espaço',
    respond(q) {
      const query = q.toLowerCase();
      if (query.includes('sala') || query.includes('espaço') || query.includes('infraestrutura'))
        return 'O OLI Health Hub conta com:\n\n• **7 salas** equipadas (Ginecologia, Clínica Geral, Psicologia, Digital)\n• Recepção com assistente dedicada\n• Wi-Fi 1Gbps em todos os ambientes\n• Copa completa\n• Sala de espera climatizada\n• Totem de checkout\n\nTodas as salas têm maca, armário, pia e iluminação clínica. Reserve diretamente pelo app!';
      if (query.includes('plano') || query.includes('starter') || query.includes('pro') || query.includes('vip'))
        return 'Nossos planos:\n\n**STARTER** — Ideal para início de carreira\n• 10h/mês incluídas · R$2,00/min excedente\n\n**PRO** ⭐ — Mais popular\n• 20h/mês incluídas · R$1,60/min excedente\n• 3 consultas jurídicas/mês\n\n**VIP** — Presença garantida\n• 40h/mês incluídas · R$1,20/min excedente\n• Prioridade na reserva · Eventos exclusivos\n\nUpgrade pelo app → aba Ecossistema → Fazer Upgrade.';
      if (query.includes('reserva') || query.includes('agendar') || query.includes('horário'))
        return 'Para reservar uma sala:\n\n1. Abra a aba **Agenda** no app\n2. Selecione a data no calendário\n3. Filtre pela sua especialidade\n4. Toque na sala desejada\n5. Escolha o horário disponível\n\n⏰ Horário de funcionamento: **7h às 20h** (seg a sex) e **8h às 14h** (sáb)\n\nAs reservas são confirmadas automaticamente e salvas no seu calendário.';
      if (query.includes('evento') || query.includes('workshop') || query.includes('palestra'))
        return 'O OLI realiza eventos mensais para os profissionais:\n\n• **Workshops clínicos** — técnicas e protocolos\n• **Encontros de networking** — toda 1ª quinta-feira\n• **Palestras jurídicas** com a Ana — trimestrais\n• **Happy hour OLI** — última sexta do mês\n\nTodos incluídos no plano PRO e VIP. STARTER tem 1 evento/mês.\n\nVeja a agenda completa na recepção ou pelo WhatsApp.';
      if (query.includes('wifi') || query.includes('internet') || query.includes('impressora'))
        return 'Infraestrutura digital do OLI:\n\n• **Wi-Fi:** rede "OLI-Profissional" · senha na recepção\n• **Impressora:** disponível na copa (A4 colorido e P&B)\n• **Projetor:** sala de reunião — reserve com antecedência\n• **Câmera de alta resolução:** disponível para fotos clínicas (Sala Digital)\n\nTodos os equipamentos são para uso exclusivo dos profissionais.';
      return 'Posso conectar você com a nossa recepção para uma resposta mais completa.\n\nWhatsApp: **(11) 99763-9711**\n\nHorário de atendimento: seg a sex 7h–19h, sáb 8h–13h';
    },
  },
};

// ─── Chatbot Screen ───────────────────────────────────────────────────────────

interface ChatMessage {
  id:        string;
  text:      string;
  isUser:    boolean;
}

export default function ChatbotScreen() {
  const { persona: rawPersona } = useLocalSearchParams<{ persona?: string }>();
  const isValidPersona = (p: string | undefined): p is Persona =>
    p === 'ana' || p === 'isabella' || p === 'olivia';
  const persona = isValidPersona(rawPersona) ? rawPersona : 'ana';
  const cfg     = PERSONAS[persona];

  const welcome: ChatMessage = { id: 'welcome', text: cfg.welcome, isUser: false };

  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input,    setInput]    = useState('');
  const [typing,   setTyping]   = useState(false);
  const listRef = useRef<FlatList>(null);

  const send = () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), text, isUser: true };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const botMsg: ChatMessage = {
        id:     `bot-${Date.now()}`,
        text:   cfg.respond(text),
        isUser: false,
      };
      setMessages(prev => [...prev, botMsg]);
      setTyping(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={88}
      >
        {/* ── Header da agente ── */}
        <View style={[styles.agentHeader, shadows.small]}>
          <View style={[styles.agentAvatar, { backgroundColor: cfg.color }]}>
            {AGENT_PHOTOS[persona] ? (
              <Image
                source={AGENT_PHOTOS[persona]}
                style={styles.agentPhoto}
                accessibilityLabel={`Foto de ${cfg.name}`}
              />
            ) : (
              <Text style={styles.agentAvatarText}>{cfg.avatar}</Text>
            )}
          </View>
          <View>
            <Text style={styles.agentName}>{cfg.name} — {cfg.role}</Text>
            <Text style={styles.agentSubtitle}>{cfg.subtitle}</Text>
          </View>
        </View>

        {/* ── Mensagens ── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => <Bubble message={item} accentColor={cfg.color} />}
          ListFooterComponent={typing ? <TypingIndicator color={cfg.color} /> : null}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* ── Input ── */}
        <View style={[styles.inputRow, shadows.small]}>
          <TextInput
            style={styles.textInput}
            placeholder={`Pergunte para ${cfg.name}...`}
            placeholderTextColor={colors.gray}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            accessibilityLabel={`Campo de mensagem para ${cfg.name}`}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: cfg.color }, !input.trim() && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim()}
            accessibilityLabel="Enviar mensagem"
          >
            <Ionicons name="arrow-up-outline" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({ message, accentColor }: { message: ChatMessage; accentColor: string }) {
  return (
    <View style={[bubbleStyles.wrap, message.isUser && bubbleStyles.wrapUser]}>
      <View style={[
        bubbleStyles.bubble,
        message.isUser
          ? [bubbleStyles.bubbleUser, { backgroundColor: accentColor }]
          : bubbleStyles.bubbleBot,
      ]}>
        <Text style={[bubbleStyles.text, message.isUser && bubbleStyles.textUser]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrap:       { marginBottom: spacing.sm, maxWidth: '82%' },
  wrapUser:   { alignSelf: 'flex-end' },
  bubble:     { borderRadius: radius.lg, padding: 12 },
  bubbleBot:  { backgroundColor: colors.white, ...shadows.small, alignSelf: 'flex-start' },
  bubbleUser: {},
  text:       { fontSize: 15, color: colors.oliDarkGray, lineHeight: 22 },
  textUser:   { color: colors.white },
});

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ color }: { color: string }) {
  return (
    <View style={[typingStyles.container, shadows.small]}>
      {[0, 1, 2].map(i => (
        <View key={i} style={[typingStyles.dot, { backgroundColor: `${color}80` }]} />
      ))}
    </View>
  );
}

const typingStyles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 4, padding: 12, backgroundColor: colors.white, borderRadius: radius.lg, alignSelf: 'flex-start', marginBottom: spacing.sm },
  dot:       { width: 8, height: 8, borderRadius: 4 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.oliBackground },
  flex:  { flex: 1 },
  agentHeader:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.white },
  agentAvatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  agentAvatarText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  agentPhoto:      { width: 44, height: 44, borderRadius: 22 },
  agentName:       { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray },
  agentSubtitle:   { fontSize: 12, color: colors.gray },
  messageList:     { padding: spacing.md, paddingBottom: 0 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.white },
  textInput: {
    flex:              1,
    borderWidth:       1,
    borderColor:       colors.border,
    borderRadius:      radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical:   Platform.OS === 'ios' ? 10 : 6,
    fontSize:          15,
    color:             colors.oliDarkGray,
    maxHeight:         100,
  },
  sendBtn:         { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
