import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { colors, spacing, radius, shadows } from '../src/theme/designSystem';
import { sendChatMessage, type ChatTurn } from '../src/services/chatService';

const AGENT_NAME  = 'Olivia';
const AGENT_ROLE  = 'Assistente Virtual OLI';
const AGENT_COLOR = colors.oliGreen;
const AGENT_WELCOME =
  'Olá! Sou a Olivia, assistente virtual do OLI Health Hub.\n\n' +
  'Posso ajudar com:\n' +
  '• Salas, infraestrutura e reservas\n' +
  '• Planos START e PRO\n' +
  '• Módulos e soluções\n' +
  '• Eventos e comunidade\n' +
  '• Dúvidas gerais sobre o app';

// ─── Chatbot Screen ───────────────────────────────────────────────────────────

interface ChatMessage {
  id:     string;
  text:   string;
  isUser: boolean;
}

export default function ChatbotScreen() {
  const welcome: ChatMessage = { id: 'welcome', text: AGENT_WELCOME, isUser: false };

  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input,    setInput]    = useState('');
  const [typing,   setTyping]   = useState(false);
  const historyRef = useRef<ChatTurn[]>([]);
  const listRef    = useRef<FlatList>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), text, isUser: true };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    historyRef.current = [...historyRef.current, { role: 'user', content: text }];

    try {
      const reply = await sendChatMessage(historyRef.current);
      historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }];
      setMessages(prev => [...prev, { id: `bot-${Date.now()}`, text: reply, isUser: false }]);
    } catch {
      Alert.alert('Erro', 'Não foi possível obter resposta. Verifique sua conexão e tente novamente.');
      historyRef.current = historyRef.current.slice(0, -1);
    } finally {
      setTyping(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: `${AGENT_ROLE} — ${AGENT_NAME}` }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={88}
      >
        {/* ── Header da agente ── */}
        <View style={[styles.agentHeader, shadows.small]}>
          <View style={[styles.agentAvatar, { backgroundColor: AGENT_COLOR }]}>
            <Text style={styles.agentAvatarText}>{AGENT_NAME[0]}</Text>
          </View>
          <View style={styles.agentInfo}>
            <Text style={styles.agentName}>{AGENT_NAME} — {AGENT_ROLE}</Text>
            <Text style={styles.agentSubtitle}>Dúvidas sobre o OLI Health Hub</Text>
          </View>
        </View>

        {/* ── Mensagens ── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => <Bubble message={item} />}
          ListFooterComponent={typing ? <TypingIndicator color={AGENT_COLOR} /> : null}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* ── Input ── */}
        <View style={[styles.inputRow, shadows.small]}>
          <TextInput
            style={styles.textInput}
            placeholder={`Pergunte para ${AGENT_NAME}...`}
            placeholderTextColor={colors.gray}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            accessibilityLabel={`Campo de mensagem para ${AGENT_NAME}`}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: AGENT_COLOR }, !input.trim() && styles.sendBtnDisabled]}
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

interface BubbleProps {
  message: ChatMessage;
}

function Bubble({ message }: BubbleProps) {
  if (message.isUser) {
    return (
      <View style={bubbleStyles.wrapUser}>
        <View style={[bubbleStyles.bubbleUser, { backgroundColor: AGENT_COLOR }]}>
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
  wrapUser: { alignSelf: 'flex-end', maxWidth: '82%', marginBottom: spacing.sm },
  wrapBot:  { alignSelf: 'flex-start', maxWidth: '92%', marginBottom: spacing.sm },
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
  agentHeader:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.white },
  agentAvatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 },
  agentAvatarText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  agentInfo:       { flex: 1 },
  agentName:       { fontSize: 15, fontWeight: '700', color: colors.oliDarkGray },
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
