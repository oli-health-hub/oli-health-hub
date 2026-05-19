import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, Animated,
  Modal, FlatList,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/store/authStore';
import { colors, spacing, radius } from '../src/theme/designSystem';
import type {
  SituacaoJuridica, FaturamentoRange, LocalAtuacao,
  NumLocais, NotasFiscaisRange,
} from '../src/models/types';

// ─── Estados brasileiros ──────────────────────────────────────────────────────

const ESTADOS = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
];

// ─── Constantes e Helpers ─────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

function OptionCard<T extends string | boolean>({
  label, sublabel, value, selected, onPress, icon,
}: {
  label: string;
  sublabel?: string;
  value: T;
  selected: boolean;
  onPress: (v: T) => void;
  icon?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.optCard, selected && styles.optCardActive]}
      onPress={() => onPress(value)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      {icon ? (
        <View style={styles.optIconWrap}>
          <Ionicons
            name={icon as any}
            size={20}
            color={selected ? colors.white : colors.oliGreen}
          />
        </View>
      ) : null}
      <View style={styles.optTexts}>
        <Text style={[styles.optLabel, selected && styles.optLabelActive]}>{label}</Text>
        {sublabel ? (
          <Text style={[styles.optSublabel, selected && styles.optSublabelActive]}>{sublabel}</Text>
        ) : null}
      </View>
      {selected && (
        <Ionicons name="checkmark-circle" size={20} color={colors.white} />
      )}
    </TouchableOpacity>
  );
}

function SectionTitle({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.stepBadge}>Etapa {step} de {TOTAL_STEPS}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      {subtitle ? <Text style={styles.stepSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router      = useRouter();
  const { profile, setProfile } = useAuthStore();
  const [step,      setStep]    = useState(1);
  const [loading,   setLoading] = useState(false);
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  // ── Step 1: Situação jurídica ──
  const [situacaoJuridica, setSituacaoJuridica] = useState<SituacaoJuridica | null>(null);
  const [possuiCLT,        setPossuiCLT]        = useState<boolean | null>(null);
  const [possuiSocios,     setPossuiSocios]     = useState<boolean | null>(null);

  // ── Step 2: Atividade e locais ──
  const [atividadeExercida, setAtividadeExercida] = useState('');
  const [localAtuacao,      setLocalAtuacao]      = useState<LocalAtuacao | null>(null);
  const [numLocais,         setNumLocais]         = useState<NumLocais | null>(null);
  const [cidade,            setCidade]            = useState('');
  const [uf,                setUf]                = useState('');
  const [showEstadoPicker,  setShowEstadoPicker]  = useState(false);

  // ── Step 3: Como nos conheceu ──
  const [comoConheceu,       setComoConheceu]       = useState<string | null>(null);
  const [referidoPorId,      setReferidoPorId]      = useState<string | null>(null);
  const [referidoPorNome,    setReferidoPorNome]    = useState('');
  const [memberSearch,       setMemberSearch]       = useState('');
  const [memberResults,      setMemberResults]      = useState<{ id: string; nome: string; especialidade: string | null }[]>([]);
  const [memberSearching,    setMemberSearching]    = useState(false);

  // ── Step 4: Financeiro ──
  const [faturamentoRange,   setFaturamentoRange]   = useState<FaturamentoRange | null>(null);
  const [notasFiscaisRange,  setNotasFiscaisRange]  = useState<NotasFiscaisRange | null>(null);
  const [possuiFuncionarios, setPossuiFuncionarios] = useState<boolean | null>(null);
  const [previsaoContratacao,setPrevisaoContratacao]= useState<boolean | null>(null);

  // ── Validação por step ──
  const step1Valid = situacaoJuridica !== null && possuiCLT !== null && possuiSocios !== null;
  const cidadeUF   = cidade.trim() && uf ? `${cidade.trim()} / ${uf}` : '';
  const step2Valid = atividadeExercida.trim().length > 0 && localAtuacao !== null && numLocais !== null && cidade.trim().length > 0 && uf.length > 0;
  const step3Valid = comoConheceu !== null && (comoConheceu !== 'membro_oli' || referidoPorId !== null);
  const step4Valid = faturamentoRange !== null && notasFiscaisRange !== null &&
    possuiFuncionarios !== null &&
    (possuiFuncionarios === true || previsaoContratacao !== null);

  const isCurrentStepValid = () => {
    if (step === 1) return step1Valid;
    if (step === 2) return step2Valid;
    if (step === 3) return step3Valid;
    if (step === 4) return step4Valid;
    return true; // step 5 é resumo
  };

  const searchMembers = async (q: string) => {
    if (q.trim().length < 2) { setMemberResults([]); return; }
    setMemberSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, especialidade')
      .ilike('nome', `%${q.trim()}%`)
      .neq('id', profile!.id)
      .limit(8);
    setMemberResults((data ?? []) as { id: string; nome: string; especialidade: string | null }[]);
    setMemberSearching(false);
  };

  const animateProgress = (nextStep: number) => {
    Animated.timing(progressAnim, {
      toValue: nextStep / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleNext = () => {
    if (!isCurrentStepValid()) {
      Alert.alert('Campos obrigatórios', 'Preencha todos os campos antes de continuar.');
      return;
    }
    const next = step + 1;
    setStep(next);
    animateProgress(next);
  };

  const handleBack = () => {
    const prev = step - 1;
    setStep(prev);
    animateProgress(prev);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          onboarding_complete:   true,
          situacao_juridica:     situacaoJuridica,
          faturamento_range:     faturamentoRange,
          atividade_exercida:    atividadeExercida.trim(),
          especialidade:         atividadeExercida.trim(),
          possui_clt:            possuiCLT,
          local_atuacao:         localAtuacao,
          num_locais:            numLocais,
          cidade_uf:             cidadeUF.trim(),
          notas_fiscais_range:   notasFiscaisRange,
          possui_funcionarios:   possuiFuncionarios,
          previsao_contratacao:  possuiFuncionarios ? null : previsaoContratacao,
          possui_socios:         possuiSocios,
          como_conheceu:         comoConheceu,
          referido_por:          referidoPorId,
        })
        .eq('id', profile!.id)
        .select()
        .single();

      if (error) throw error;
      if (data) setProfile(data);

      router.replace('/');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar suas respostas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      {/* ── Modal: Seletor de Estado ── */}
      <Modal visible={showEstadoPicker} animationType="slide" transparent>
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>Selecionar Estado</Text>
              <TouchableOpacity onPress={() => setShowEstadoPicker(false)} accessibilityLabel="Fechar">
                <Ionicons name="close" size={24} color={colors.oliDarkGray} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={ESTADOS}
              keyExtractor={item => item.uf}
              renderItem={({ item }) => {
                const selected = uf === item.uf;
                return (
                  <TouchableOpacity
                    style={[pickerStyles.item, selected && pickerStyles.itemSelected]}
                    onPress={() => { setUf(item.uf); setShowEstadoPicker(false); }}
                    accessibilityLabel={item.nome}
                  >
                    <Text style={[pickerStyles.itemUF, selected && pickerStyles.itemUFSelected]}>
                      {item.uf}
                    </Text>
                    <Text style={[pickerStyles.itemNome, selected && pickerStyles.itemNomeSelected]}>
                      {item.nome}
                    </Text>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={colors.oliGreen} />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={pickerStyles.separator} />}
            />
          </View>
        </View>
      </Modal>
      {/* ── Barra de progresso ── */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ════════════════════════════════════════════════
              STEP 1 — Estrutura jurídica e vínculos
          ════════════════════════════════════════════════ */}
          {step === 1 && (
            <>
              <SectionTitle
                step={1}
                title="Estrutura jurídica e vínculos"
                subtitle="Essas informações permitem que o OLI personalize as soluções do ecossistema para o seu perfil."
              />

              {/* Q1 */}
              <Text style={styles.question}>
                Como você atua hoje?
              </Text>
              <Text style={styles.questionHint}>Pessoa Física, Jurídica ou ambos?</Text>
              {([
                { value: 'pf',    label: 'Pessoa Física',          icon: 'person-outline',    sublabel: 'Autônomo sem CNPJ' },
                { value: 'pj',    label: 'Pessoa Jurídica',        icon: 'business-outline',  sublabel: 'Com CNPJ (PJ)' },
                { value: 'ambos', label: 'Pessoa Física e Jurídica', icon: 'git-merge-outline', sublabel: 'Recebe por ambas as formas' },
              ] as const).map(o => (
                <OptionCard
                  key={o.value}
                  value={o.value}
                  label={o.label}
                  sublabel={o.sublabel}
                  icon={o.icon}
                  selected={situacaoJuridica === o.value}
                  onPress={setSituacaoJuridica}
                />
              ))}

              {/* Q4 */}
              <Text style={[styles.question, styles.questionSpacing]}>
                Possui vínculo CLT?
              </Text>
              <View style={styles.boolRow}>
                <OptionCard
                  value={true}
                  label="Sim"
                  icon="checkmark-outline"
                  selected={possuiCLT === true}
                  onPress={setPossuiCLT}
                />
                <OptionCard
                  value={false}
                  label="Não"
                  icon="close-outline"
                  selected={possuiCLT === false}
                  onPress={setPossuiCLT}
                />
              </View>

              {/* Q10 */}
              <Text style={[styles.question, styles.questionSpacing]}>
                Atua sozinho(a) ou possui sócios?
              </Text>
              <View style={styles.boolRow}>
                <OptionCard
                  value={false}
                  label="Sozinho(a)"
                  icon="person-outline"
                  selected={possuiSocios === false}
                  onPress={setPossuiSocios}
                />
                <OptionCard
                  value={true}
                  label="Com sócios"
                  icon="people-outline"
                  selected={possuiSocios === true}
                  onPress={setPossuiSocios}
                />
              </View>
            </>
          )}

          {/* ════════════════════════════════════════════════
              STEP 2 — Atividade e locais de atuação
          ════════════════════════════════════════════════ */}
          {step === 2 && (
            <>
              <SectionTitle
                step={2}
                title="Atividade e locais de atuação"
                subtitle="Onde e como você exerce a medicina."
              />

              {/* Q3 */}
              <Text style={styles.question}>Qual atividade você exerce?</Text>
              <Text style={styles.questionHint}>Especialidade médica ou tipo de atendimento</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: Clínica Geral, Cardiologia, Psiquiatria..."
                placeholderTextColor={colors.gray}
                value={atividadeExercida}
                onChangeText={setAtividadeExercida}
                autoCapitalize="words"
                accessibilityLabel="Atividade ou especialidade exercida"
              />

              {/* Q5 */}
              <Text style={[styles.question, styles.questionSpacing]}>
                Como a atividade é exercida?
              </Text>
              {([
                { value: 'proprio',   label: 'Estabelecimento próprio', icon: 'home-outline' },
                { value: 'terceiros', label: 'Estabelecimento de terceiros', icon: 'business-outline', sublabel: 'Clínicas, hospitais, coworkings' },
                { value: 'ambos',     label: 'Ambos', icon: 'git-merge-outline' },
              ] as const).map(o => (
                <OptionCard
                  key={o.value}
                  value={o.value}
                  label={o.label}
                  sublabel={'sublabel' in o ? o.sublabel : undefined}
                  icon={o.icon}
                  selected={localAtuacao === o.value}
                  onPress={setLocalAtuacao}
                />
              ))}

              {/* Q6 */}
              <Text style={[styles.question, styles.questionSpacing]}>
                Em quantos locais atua atualmente?
              </Text>
              <Text style={styles.questionHint}>Incluindo hospitais e clínicas</Text>
              <View style={styles.chipRow}>
                {([
                  { value: '1',     label: '1 local' },
                  { value: '2_3',   label: '2 a 3' },
                  { value: '4_6',   label: '4 a 6' },
                  { value: 'mais_6', label: 'Mais de 6' },
                ] as const).map(o => {
                  const active = numLocais === o.value;
                  return (
                    <TouchableOpacity
                      key={o.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setNumLocais(o.value)}
                      accessibilityLabel={o.label}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Q7 */}
              <Text style={[styles.question, styles.questionSpacing]}>
                Cidade / Estado de atuação principal
              </Text>

              {/* Seletor de Estado */}
              <TouchableOpacity
                style={[styles.pickerBtn, uf ? styles.pickerBtnFilled : null]}
                onPress={() => setShowEstadoPicker(true)}
                accessibilityLabel="Selecionar estado"
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={uf ? colors.oliGreen : colors.gray}
                />
                <Text style={[styles.pickerBtnText, uf ? styles.pickerBtnTextFilled : null]}>
                  {uf ? ESTADOS.find(e => e.uf === uf)?.nome + ` (${uf})` : 'Selecionar estado'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={uf ? colors.oliGreen : colors.gray} />
              </TouchableOpacity>

              {/* Campo de Cidade */}
              <TextInput
                style={[styles.textInput, { marginTop: spacing.sm }]}
                placeholder="Nome da cidade"
                placeholderTextColor={colors.gray}
                value={cidade}
                onChangeText={setCidade}
                autoCapitalize="words"
                accessibilityLabel="Cidade de atuação"
              />
            </>
          )}

          {/* ════════════════════════════════════════════════
              STEP 3 — Como nos conheceu
          ════════════════════════════════════════════════ */}
          {step === 3 && (
            <>
              <SectionTitle
                step={3}
                title="Como você nos conheceu?"
                subtitle="Isso nos ajuda a entender como o OLI está crescendo e a fortalecer nossa comunidade."
              />

              {([
                { value: 'membro_oli',  label: 'Indicação de membro OLI',   icon: 'people-outline',      sublabel: 'Outro profissional do cowork' },
                { value: 'amigo',       label: 'Indicação de amigo',        icon: 'person-add-outline',  sublabel: 'Colega ou conhecido' },
                { value: 'redes',       label: 'Redes sociais',             icon: 'logo-instagram',      sublabel: 'Instagram, LinkedIn…' },
                { value: 'evento',      label: 'Evento OLI',                icon: 'calendar-outline',    sublabel: 'Palestra, workshop, open house' },
                { value: 'google',      label: 'Google / Internet',         icon: 'search-outline',      sublabel: 'Pesquisa online' },
                { value: 'outro',       label: 'Outro',                     icon: 'ellipsis-horizontal-outline' },
              ] as const).map(o => (
                <OptionCard
                  key={o.value}
                  value={o.value}
                  label={o.label}
                  sublabel={'sublabel' in o ? o.sublabel : undefined}
                  icon={o.icon}
                  selected={comoConheceu === o.value}
                  onPress={(v) => {
                    setComoConheceu(v);
                    if (v !== 'membro_oli') { setReferidoPorId(null); setReferidoPorNome(''); setMemberResults([]); }
                  }}
                />
              ))}

              {/* Busca de membro — só aparece quando "membro_oli" está selecionado */}
              {comoConheceu === 'membro_oli' && (
                <View style={styles.memberSearchWrap}>
                  <Text style={styles.question}>Qual é o nome desse profissional?</Text>
                  <View style={styles.memberInputRow}>
                    <Ionicons name="search-outline" size={18} color={colors.gray} />
                    <TextInput
                      style={styles.memberInput}
                      placeholder="Buscar pelo nome…"
                      placeholderTextColor={colors.gray}
                      value={memberSearch}
                      onChangeText={q => { setMemberSearch(q); searchMembers(q); }}
                      autoCapitalize="words"
                      accessibilityLabel="Buscar membro OLI que indicou"
                    />
                    {memberSearching && (
                      <Ionicons name="hourglass-outline" size={16} color={colors.gray} />
                    )}
                  </View>

                  {/* Resultado selecionado */}
                  {referidoPorId && (
                    <View style={styles.memberSelected}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.oliGreen} />
                      <Text style={styles.memberSelectedText}>{referidoPorNome}</Text>
                      <TouchableOpacity
                        onPress={() => { setReferidoPorId(null); setReferidoPorNome(''); setMemberSearch(''); setMemberResults([]); }}
                        accessibilityLabel="Remover seleção"
                      >
                        <Ionicons name="close-circle" size={18} color={colors.gray} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Lista de resultados */}
                  {!referidoPorId && memberResults.length > 0 && (
                    <View style={styles.memberList}>
                      {memberResults.map(m => (
                        <TouchableOpacity
                          key={m.id}
                          style={styles.memberItem}
                          onPress={() => {
                            setReferidoPorId(m.id);
                            setReferidoPorNome(m.nome);
                            setMemberSearch('');
                            setMemberResults([]);
                          }}
                          accessibilityLabel={`Selecionar ${m.nome}`}
                        >
                          <Text style={styles.memberItemName}>{m.nome}</Text>
                          {m.especialidade ? (
                            <Text style={styles.memberItemSpec}>{m.especialidade}</Text>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {!referidoPorId && memberSearch.trim().length >= 2 && memberResults.length === 0 && !memberSearching && (
                    <Text style={styles.memberNoResult}>Nenhum profissional encontrado com esse nome.</Text>
                  )}
                </View>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════
              STEP 4 — Financeiro e estrutura operacional
          ════════════════════════════════════════════════ */}
          {step === 4 && (
            <>
              <SectionTitle
                step={4}
                title="Financeiro e estrutura operacional"
                subtitle="Quanto mais contexto o OLI tiver, mais assertivas serão as orientações."
              />

              {/* Q2 */}
              <Text style={styles.question}>
                Qual a média de faturamento mensal?
              </Text>
              <Text style={styles.questionHint}>Previsão ou média dos últimos meses</Text>
              {([
                { value: 'ate_10k',    label: 'Até R$ 10.000' },
                { value: '10k_30k',   label: 'R$ 10.001 – R$ 30.000' },
                { value: '30k_80k',   label: 'R$ 30.001 – R$ 80.000' },
                { value: '80k_160k',  label: 'R$ 80.001 – R$ 160.000' },
                { value: 'acima_160k', label: 'Acima de R$ 160.000' },
              ] as const).map(o => {
                const active = faturamentoRange === o.value;
                return (
                  <TouchableOpacity
                    key={o.value}
                    style={[styles.rangeRow, active && styles.rangeRowActive]}
                    onPress={() => setFaturamentoRange(o.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={o.label}
                  >
                    <Text style={[styles.rangeLabel, active && styles.rangeLabelActive]}>
                      {o.label}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={colors.white} />}
                  </TouchableOpacity>
                );
              })}

              {/* Q8 */}
              <Text style={[styles.question, styles.questionSpacing]}>
                Notas fiscais emitidas por mês?
              </Text>
              <View style={styles.chipRow}>
                {([
                  { value: 'nao_emite', label: 'Não emite' },
                  { value: 'ate_5',     label: 'Até 5' },
                  { value: '6_20',      label: '6 a 20' },
                  { value: '21_50',     label: '21 a 50' },
                  { value: 'acima_50',  label: 'Mais de 50' },
                ] as const).map(o => {
                  const active = notasFiscaisRange === o.value;
                  return (
                    <TouchableOpacity
                      key={o.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setNotasFiscaisRange(o.value)}
                      accessibilityLabel={o.label}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Q9 */}
              <Text style={[styles.question, styles.questionSpacing]}>
                Possui funcionários registrados?
              </Text>
              <View style={styles.boolRow}>
                <OptionCard
                  value={true}
                  label="Sim"
                  icon="checkmark-outline"
                  selected={possuiFuncionarios === true}
                  onPress={(v) => { setPossuiFuncionarios(v); setPrevisaoContratacao(null); }}
                />
                <OptionCard
                  value={false}
                  label="Não"
                  icon="close-outline"
                  selected={possuiFuncionarios === false}
                  onPress={(v) => { setPossuiFuncionarios(v); }}
                />
              </View>

              {possuiFuncionarios === false && (
                <>
                  <Text style={[styles.question, styles.questionSpacing]}>
                    Há previsão de contratação?
                  </Text>
                  <View style={styles.boolRow}>
                    <OptionCard
                      value={true}
                      label="Sim"
                      icon="checkmark-outline"
                      selected={previsaoContratacao === true}
                      onPress={setPrevisaoContratacao}
                    />
                    <OptionCard
                      value={false}
                      label="Não por enquanto"
                      icon="close-outline"
                      selected={previsaoContratacao === false}
                      onPress={setPrevisaoContratacao}
                    />
                  </View>
                </>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════════
              STEP 5 — Resumo e confirmação
          ════════════════════════════════════════════════ */}
          {step === 5 && (
            <>
              <SectionTitle
                step={5}
                title="Tudo certo!"
                subtitle="Confira um resumo das suas respostas antes de finalizar."
              />

              <View style={styles.summaryCard}>
                <SummaryRow label="Situação jurídica"  value={LABELS_SITUACAO[situacaoJuridica!]} />
                <SummaryRow label="Vínculo CLT"        value={possuiCLT ? 'Sim' : 'Não'} />
                <SummaryRow label="Sócios"             value={possuiSocios ? 'Com sócios' : 'Sozinho(a)'} />
                <SummaryRow label="Atividade"          value={atividadeExercida} />
                <SummaryRow label="Local de atuação"   value={LABELS_LOCAL[localAtuacao!]} />
                <SummaryRow label="Nº de locais"       value={LABELS_LOCAIS[numLocais!]} />
                <SummaryRow label="Cidade / UF"        value={cidadeUF} />
                <SummaryRow label="Como nos conheceu"  value={LABELS_COMO_CONHECEU[comoConheceu!] ?? comoConheceu!} />
                {referidoPorNome ? <SummaryRow label="Indicado por" value={referidoPorNome} /> : null}
                <SummaryRow label="Faturamento mensal" value={LABELS_FATURAMENTO[faturamentoRange!]} />
                <SummaryRow label="Notas fiscais/mês"  value={LABELS_NOTAS[notasFiscaisRange!]} />
                <SummaryRow label="Funcionários"       value={possuiFuncionarios ? 'Sim' : 'Não'} />
                {possuiFuncionarios === false && (
                  <SummaryRow label="Previsão de contratação" value={previsaoContratacao ? 'Sim' : 'Não'} />
                )}
              </View>

              <View style={styles.finishNote}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.oliGreen} />
                <Text style={styles.finishNoteText}>
                  Suas informações são confidenciais e serão usadas pelo OLI para personalizar
                  as soluções do ecossistema ao seu perfil, conforme a Política de Privacidade.
                </Text>
              </View>
            </>
          )}

        </ScrollView>

        {/* ── Navegação ── */}
        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              accessibilityLabel="Voltar para etapa anterior"
            >
              <Ionicons name="arrow-back" size={18} color={colors.oliGreen} />
              <Text style={styles.backBtnText}>Voltar</Text>
            </TouchableOpacity>
          )}

          {step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[styles.nextBtn, !isCurrentStepValid() && styles.nextBtnDisabled]}
              onPress={handleNext}
              disabled={!isCurrentStepValid()}
              accessibilityLabel="Próxima etapa"
            >
              <Text style={styles.nextBtnText}>Próximo</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, loading && styles.nextBtnDisabled]}
              onPress={handleFinish}
              disabled={loading}
              accessibilityLabel="Finalizar questionário"
            >
              <Text style={styles.nextBtnText}>{loading ? 'Salvando...' : 'Finalizar'}</Text>
              {!loading && <Ionicons name="checkmark" size={18} color={colors.white} />}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

// ─── Labels de exibição ───────────────────────────────────────────────────────

const LABELS_SITUACAO: Record<SituacaoJuridica, string> = {
  pf:    'Pessoa Física',
  pj:    'Pessoa Jurídica',
  ambos: 'PF e PJ',
};

const LABELS_LOCAL: Record<LocalAtuacao, string> = {
  proprio:   'Estabelecimento próprio',
  terceiros: 'Estabelecimento de terceiros',
  ambos:     'Próprio e terceiros',
};

const LABELS_LOCAIS: Record<NumLocais, string> = {
  '1':     '1 local',
  '2_3':   '2 a 3 locais',
  '4_6':   '4 a 6 locais',
  mais_6:  'Mais de 6 locais',
};

const LABELS_FATURAMENTO: Record<FaturamentoRange, string> = {
  ate_10k:    'Até R$ 10.000',
  '10k_30k':  'R$ 10.001 – R$ 30.000',
  '30k_80k':  'R$ 30.001 – R$ 80.000',
  '80k_160k': 'R$ 80.001 – R$ 160.000',
  acima_160k: 'Acima de R$ 160.000',
};

const LABELS_NOTAS: Record<NotasFiscaisRange, string> = {
  nao_emite: 'Não emite',
  ate_5:     'Até 5 por mês',
  '6_20':    '6 a 20 por mês',
  '21_50':   '21 a 50 por mês',
  acima_50:  'Mais de 50 por mês',
};

const LABELS_COMO_CONHECEU: Record<string, string> = {
  membro_oli: 'Indicação de membro OLI',
  amigo:      'Indicação de amigo/colega',
  redes:      'Redes sociais',
  evento:     'Evento OLI',
  google:     'Google / Internet',
  outro:      'Outro',
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.oliBackground },
  flex:  { flex: 1 },

  progressWrap: {
    paddingHorizontal: spacing.md,
    paddingTop:        spacing.sm,
    paddingBottom:     spacing.xs,
    backgroundColor:   colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressTrack: {
    height:       6,
    borderRadius: 3,
    backgroundColor: `${colors.oliGreen}20`,
    overflow:     'hidden',
  },
  progressFill: {
    height:       6,
    borderRadius: 3,
    backgroundColor: colors.oliGreen,
  },

  scroll:        { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xs },

  sectionTitle: { marginBottom: spacing.md },
  stepBadge: {
    fontSize:      12,
    fontWeight:    '700',
    color:         colors.oliGreen,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom:  spacing.xs,
  },
  stepTitle:    { fontSize: 22, fontWeight: '700', color: colors.oliDarkGray },
  stepSubtitle: { fontSize: 14, color: colors.gray, marginTop: 6, lineHeight: 20 },

  question: {
    fontSize:     15,
    fontWeight:   '700',
    color:        colors.oliDarkGray,
    marginTop:    spacing.sm,
    marginBottom: 4,
  },
  questionSpacing: { marginTop: spacing.lg },
  questionHint:    { fontSize: 12, color: colors.gray, marginBottom: spacing.sm },

  // ── Option cards ──
  optCard: {
    flexDirection:   'row',
    alignItems:      'center',
    padding:         spacing.md,
    borderRadius:    radius.md,
    borderWidth:     1.5,
    borderColor:     colors.border,
    backgroundColor: colors.white,
    marginBottom:    spacing.sm,
    gap:             spacing.sm,
  },
  optCardActive: {
    backgroundColor: colors.oliGreen,
    borderColor:     colors.oliGreen,
  },
  // Wrapper com dimensões explícitas garante centralização correta no Android
  optIconWrap: {
    width:           28,
    height:          28,
    justifyContent:  'center',
    alignItems:      'center',
    flexShrink:      0,
  },
  optTexts: { flex: 1 },
  optLabel: { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  optLabelActive: { color: colors.white },
  optSublabel: { fontSize: 12, color: colors.gray, marginTop: 2 },
  optSublabelActive: { color: `${colors.white}CC` },

  // ── Bool row (Sim/Não) ──
  boolRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },

  // ── Chips ──
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical:   10,
    borderRadius:      radius.md,
    borderWidth:       1.5,
    borderColor:       colors.border,
    backgroundColor:   colors.white,
  },
  chipActive: {
    backgroundColor: colors.oliGreen,
    borderColor:     colors.oliGreen,
  },
  chipText:       { fontSize: 13, fontWeight: '600', color: colors.oliDarkGray },
  chipTextActive: { color: colors.white },

  // ── Range rows ──
  rangeRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    padding:         spacing.md,
    borderRadius:    radius.md,
    borderWidth:     1.5,
    borderColor:     colors.border,
    backgroundColor: colors.white,
    marginBottom:    spacing.sm,
  },
  rangeRowActive: {
    backgroundColor: colors.oliGreen,
    borderColor:     colors.oliGreen,
  },
  rangeLabel:       { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  rangeLabelActive: { color: colors.white },

  // ── Text input ──
  textInput: {
    borderWidth:     1.5,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    padding:         spacing.md,
    fontSize:        15,
    color:           colors.oliDarkGray,
    backgroundColor: colors.white,
  },

  // ── Picker button (estado) ──
  pickerBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    borderWidth:     1.5,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    padding:         spacing.md,
    backgroundColor: colors.white,
  },
  pickerBtnFilled:     { borderColor: colors.oliGreen },
  pickerBtnText:       { flex: 1, fontSize: 15, color: colors.gray },
  pickerBtnTextFilled: { color: colors.oliDarkGray, fontWeight: '500' },

  // ── Resumo ──
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             12,
  },
  summaryRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom:  10,
    gap:            spacing.sm,
  },
  summaryLabel: { fontSize: 13, color: colors.gray, flex: 1 },
  summaryValue: { fontSize: 13, fontWeight: '600', color: colors.oliDarkGray, textAlign: 'right', flex: 1 },

  finishNote: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.sm,
    backgroundColor: `${colors.oliGreen}0F`,
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginTop:       spacing.sm,
  },
  finishNoteText: { flex: 1, fontSize: 12, color: colors.oliGreen, lineHeight: 18 },

  // ── Rodapé de navegação ──
  footer: {
    flexDirection:     'row',
    justifyContent:    'flex-end',
    alignItems:        'center',
    padding:           spacing.md,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    backgroundColor:   colors.white,
    gap:               spacing.sm,
  },
  backBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: colors.oliGreen },
  nextBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   colors.oliGreen,
    borderRadius:      radius.md,
    paddingVertical:   12,
    paddingHorizontal: spacing.lg,
  },
  nextBtnDisabled: { backgroundColor: `${colors.gray}80` },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },

  // ── Busca de membro (step 3) ──
  memberSearchWrap: {
    marginTop:       spacing.sm,
    gap:             spacing.sm,
  },
  memberInputRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    borderWidth:     1.5,
    borderColor:     colors.oliGreen,
    borderRadius:    radius.md,
    padding:         spacing.md,
    backgroundColor: colors.white,
  },
  memberInput: {
    flex:     1,
    fontSize: 15,
    color:    colors.oliDarkGray,
  },
  memberSelected: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    backgroundColor: `${colors.oliGreen}12`,
    borderRadius:    radius.md,
    padding:         spacing.md,
  },
  memberSelectedText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '600',
    color:      colors.oliDarkGray,
  },
  memberList: {
    backgroundColor: colors.white,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
  },
  memberItem: {
    padding:           spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberItemName: { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  memberItemSpec: { fontSize: 12, color: colors.gray, marginTop: 2 },
  memberNoResult: { fontSize: 13, color: colors.oliLightGray, textAlign: 'center', paddingVertical: spacing.sm },
});

// ── Estilos do seletor de estados ─────────────────────────────────────────────

const pickerStyles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    maxHeight:       '75%',
    paddingBottom:   spacing.xxl,
  },
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    padding:         spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.oliDarkGray },

  item: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap:             spacing.sm,
  },
  itemSelected:  { backgroundColor: `${colors.oliGreen}10` },
  itemUF:        { fontSize: 14, fontWeight: '700', color: colors.oliDarkGray, width: 32 },
  itemUFSelected:{ color: colors.oliGreen },
  itemNome:      { flex: 1, fontSize: 15, color: colors.oliDarkGray },
  itemNomeSelected: { color: colors.oliGreen, fontWeight: '600' },
  separator:     { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },
});
