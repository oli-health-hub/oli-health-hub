import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { colors, spacing, radius, shadows } from '../src/theme/designSystem';
import { sendChatMessage, type ChatTurn } from '../src/services/chatService';

// Fotos reais das agentes (salvar em assets/images/agentes/)
const AGENT_PHOTOS: Partial<Record<string, ReturnType<typeof require>>> = {
  ana:      require('../assets/images/agentes/ana-luiza.jpg'),
  isabella: require('../assets/images/agentes/isabella.jpg'),
};

// ─── Personas ─────────────────────────────────────────────────────────────────

type Persona = 'ana' | 'isabella' | 'olivia' | 'convenios' | 'carreira' | 'bpo';

interface PersonaConfig {
  name:     string;
  role:     string;
  avatar:   string;
  color:    string;
  subtitle: string;
  welcome:  string;
}

const PERSONAS: Record<Persona, PersonaConfig> = {
  ana: {
    name:    'Ana Luiza',
    role:    'Direito Médico',
    avatar:  'A',
    color:   colors.oliGreen,
    subtitle:'CFM, LGPD, contratos e ética médica',
    welcome:
      'Olá! Sou a Ana Luiza, especialista em Direito Médico do OLI Health Hub.\n\n' +
      'Posso ajudar com:\n' +
      '• Ética médica e normas do CFM\n' +
      '• LGPD aplicada à saúde\n' +
      '• Consentimento informado (TCLE)\n' +
      '• Contratos com clínicas e hospitais\n' +
      '• Publicidade médica (Res. CFM 2.336/2023)\n' +
      '• Responsabilidade civil e prontuário defensivo',
  },

  isabella: {
    name:    'Isabella',
    role:    'Contabilidade Médica',
    avatar:  'I',
    color:   colors.oliGold,
    subtitle:'Impostos, PJ médica, nota fiscal e pró-labore',
    welcome:
      'Olá! Sou a Isabella, especialista em Contabilidade Médica do OLI Health Hub.\n\n' +
      'Posso ajudar com:\n' +
      '• Abertura e gestão de PJ médica\n' +
      '• Simples Nacional, Lucro Presumido e Lucro Real\n' +
      '• Nota fiscal de consultas e procedimentos\n' +
      '• Pró-labore e distribuição de lucros\n' +
      '• IRPF e IRPJ para médicos\n' +
      '• Planejamento tributário',
  },

  convenios: {
    name:    'Amanda',
    role:    'Credenciamento de Operadoras',
    avatar:  'A',
    color:   '#C0714A',
    subtitle:'Credenciamento, faturamento TISS e glosas',
    welcome:
      'Olá! Sou a Amanda, especialista em Credenciamento de Operadoras do OLI Health Hub.\n\n' +
      'Posso ajudar com:\n' +
      '• Credenciamento em operadoras de saúde\n' +
      '• Faturamento pelo padrão TISS/ANS\n' +
      '• Contestação e recurso de glosas\n' +
      '• Tabela CBHPM e negociação de honorários\n' +
      '• Rol de Procedimentos ANS e carências\n' +
      '• No-show em contratos de planos de saúde',
  },

  carreira: {
    name:    'Ronaldo',
    role:    'Carreira Médica',
    avatar:  'R',
    color:   '#7B6EA8',
    subtitle:'Posicionamento, captação e gestão de no-show',
    welcome:
      'Olá! Sou o Ronaldo, especialista em Carreira Médica do OLI Health Hub.\n\n' +
      'Posso ajudar com:\n' +
      '• Posicionamento e marca pessoal médica\n' +
      '• Captação de pacientes particulares\n' +
      '• Presença digital (Instagram, Google, LinkedIn)\n' +
      '• Gestão de agenda e produtividade\n' +
      '• No-show: estratégias de redução e cobrança\n' +
      '• Transição convênio → atendimento particular',
  },

  bpo: {
    name:    'Miriam',
    role:    'BPO Financeiro',
    avatar:  'M',
    color:   '#2E7D6E',
    subtitle:'Fluxo de caixa, inadimplência e gestão financeira',
    welcome:
      'Olá! Sou a Miriam, especialista em BPO Financeiro do OLI Health Hub.\n\n' +
      'Posso ajudar com:\n' +
      '• Gestão do fluxo de caixa do consultório\n' +
      '• Controle de contas a pagar e a receber\n' +
      '• Conciliação bancária e relatórios financeiros\n' +
      '• Gestão de inadimplência e cobrança de pacientes\n' +
      '• DRE e indicadores financeiros do consultório\n' +
      '• Precificação e análise de custos operacionais',
  },

  olivia: {
    name:    'Olivia',
    role:    'OLI Health Hub',
    avatar:  'O',
    color:   '#7B9E82',
    subtitle:'Salas, planos, reservas e eventos',
    welcome:
      'Olá! Sou a Olivia, assistente geral do OLI Health Hub.\n\n' +
      'Posso ajudar com:\n' +
      '• Informações sobre salas e infraestrutura\n' +
      '• Planos STARTER, PRO e VIP\n' +
      '• Reservas e horários disponíveis\n' +
      '• Eventos e workshops do OLI\n' +
      '• Dúvidas gerais sobre o espaço',
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
    p === 'ana' || p === 'isabella' || p === 'olivia' || p === 'convenios' || p === 'carreira' || p === 'bpo';
  const persona = isValidPersona(rawPersona) ? rawPersona : 'ana';
  const cfg     = PERSONAS[persona];

  const welcome: ChatMessage = { id: 'welcome', text: cfg.welcome, isUser: false };

  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input,    setInput]    = useState('');
  const [typing,   setTyping]   = useState(false);
  // histórico enviado à API (exclui a mensagem de boas-vindas)
  const historyRef = useRef<ChatTurn[]>([]);
  const listRef    = useRef<FlatList>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), text, isUser: true };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    // acumula histórico para contexto de conversa
    historyRef.current = [...historyRef.current, { role: 'user', content: text }];

    try {
      const reply = await sendChatMessage(persona, historyRef.current);
      historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }];

      const botMsg: ChatMessage = { id: `bot-${Date.now()}`, text: reply, isUser: false };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      Alert.alert('Erro', 'Não foi possível obter resposta. Verifique sua conexão e tente novamente.');
      // remove a mensagem do usuário do histórico em caso de erro
      historyRef.current = historyRef.current.slice(0, -1);
    } finally {
      setTyping(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
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
  if (message.isUser) {
    return (
      <View style={bubbleStyles.wrapUser}>
        <View style={[bubbleStyles.bubbleUser, { backgroundColor: accentColor }]}>
          <Text style={bubbleStyles.textUser}>{message.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={bubbleStyles.wrapBot}>
      <View style={[bubbleStyles.bubbleBot, shadows.small]}>
        <Markdown style={markdownStyles}>{message.text}</Markdown>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrapUser:   { alignSelf: 'flex-end', maxWidth: '82%', marginBottom: spacing.sm },
  wrapBot:    { alignSelf: 'flex-start', maxWidth: '92%', marginBottom: spacing.sm },
  bubbleBot:  { backgroundColor: colors.white, borderRadius: radius.lg, padding: 12 },
  bubbleUser: { borderRadius: radius.lg, padding: 12 },
  textUser:   { fontSize: 15, color: colors.white, lineHeight: 22 },
});

const markdownStyles = {
  body:        { fontSize: 15, color: colors.oliDarkGray, lineHeight: 22 },
  heading1:    { fontSize: 17, fontWeight: '700' as const, color: colors.oliDarkGray, marginBottom: 6, marginTop: 8 },
  heading2:    { fontSize: 16, fontWeight: '700' as const, color: colors.oliDarkGray, marginBottom: 4, marginTop: 8 },
  heading3:    { fontSize: 15, fontWeight: '600' as const, color: colors.oliDarkGray, marginBottom: 4, marginTop: 6 },
  strong:      { fontWeight: '700' as const, color: colors.oliDarkGray },
  em:          { fontStyle: 'italic' as const },
  bullet_list: { marginVertical: 4 },
  ordered_list:{ marginVertical: 4 },
  list_item:   { marginBottom: 2 },
  hr:          { backgroundColor: colors.border, height: 1, marginVertical: 8 },
  blockquote:  { borderLeftColor: colors.oliGreen, borderLeftWidth: 3, paddingLeft: 10, marginVertical: 4 },
  table:       { borderWidth: 1, borderColor: colors.border, borderRadius: 6, marginVertical: 8, overflow: 'hidden' as const },
  th:          { backgroundColor: colors.oliBackground, fontWeight: '700' as const, padding: 8, fontSize: 13 },
  td:          { padding: 8, fontSize: 13 },
  tr:          { borderBottomWidth: 1, borderBottomColor: colors.border },
  code_inline: { backgroundColor: colors.oliBackground, borderRadius: 4, paddingHorizontal: 4, fontSize: 13, fontFamily: 'monospace' },
  fence:       { backgroundColor: colors.oliBackground, borderRadius: 6, padding: 10, fontSize: 13 },
};

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
