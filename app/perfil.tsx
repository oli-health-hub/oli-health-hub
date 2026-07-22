import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Switch, ActivityIndicator, Image, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/store/appStore';
import { useAuthStore } from '../src/store/authStore';
import { usePatientStore } from '../src/store/patientStore';
import { signOut, updateProfile } from '../src/services/auth';
import { exportMyData, deleteAccountData } from '../src/services/accountService';
import { updateProfileAvatar, removeProfileAvatar } from '../src/services/avatarService';
import { useAppLock } from '../src/hooks/useAppLock';
import { colors, spacing, radius, shadows } from '../src/theme/designSystem';
import { TagInput } from '../src/components/TagInput';
import { ProfileCompletionCard } from '../src/components/ProfileCompletionCard';
import { OlicoinsBadge } from '../src/components/OlicoinsBadge';
import { IndiqueEGanheButton } from '../src/components/IndiqueEGanheButton';
import { OlicoinsToast } from '../src/components/OlicoinsToast';
import { creditOlicoins } from '../src/services/olicoinsService';
import { unregisterPushToken } from '../src/services/pushService';
import { PROFILE_SECTIONS } from '../src/utils/profileSections';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import type {
  SituacaoJuridica, FaturamentoRange, LocalAtuacao,
  NumLocais, NotasFiscaisRange,
} from '../src/models/types';

const ESTADOS = [
  { uf: 'AC', nome: 'Acre' }, { uf: 'AL', nome: 'Alagoas' }, { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' }, { uf: 'BA', nome: 'Bahia' }, { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' }, { uf: 'ES', nome: 'Espírito Santo' }, { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' }, { uf: 'MT', nome: 'Mato Grosso' }, { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' }, { uf: 'PA', nome: 'Pará' }, { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' }, { uf: 'PE', nome: 'Pernambuco' }, { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' }, { uf: 'RN', nome: 'Rio Grande do Norte' }, { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' }, { uf: 'RR', nome: 'Roraima' }, { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' }, { uf: 'SE', nome: 'Sergipe' }, { uf: 'TO', nome: 'Tocantins' },
];

const SITUACAO_OPTIONS: { value: SituacaoJuridica; label: string }[] = [
  { value: 'pf', label: 'Pessoa Física' },
  { value: 'pj', label: 'Pessoa Jurídica' },
  { value: 'ambos', label: 'Pessoa Física e Jurídica' },
];
const LOCAL_OPTIONS: { value: LocalAtuacao; label: string }[] = [
  { value: 'proprio', label: 'Estabelecimento próprio' },
  { value: 'terceiros', label: 'Estabelecimento de terceiros' },
  { value: 'ambos', label: 'Ambos' },
];
const NUM_LOCAIS_OPTIONS: { value: NumLocais; label: string }[] = [
  { value: '1', label: '1 local' }, { value: '2_3', label: '2 a 3 locais' },
  { value: '4_6', label: '4 a 6 locais' }, { value: 'mais_6', label: 'Mais de 6 locais' },
];
const FATURAMENTO_OPTIONS: { value: FaturamentoRange; label: string }[] = [
  { value: 'ate_10k', label: 'Até R$ 10.000' },
  { value: '10k_30k', label: 'R$ 10.001 – R$ 30.000' },
  { value: '30k_80k', label: 'R$ 30.001 – R$ 80.000' },
  { value: '80k_160k', label: 'R$ 80.001 – R$ 160.000' },
  { value: 'acima_160k', label: 'Acima de R$ 160.000' },
];
const NOTAS_OPTIONS: { value: NotasFiscaisRange; label: string }[] = [
  { value: 'nao_emite', label: 'Não emite' }, { value: 'ate_5', label: 'Até 5 por mês' },
  { value: '6_20', label: '6 a 20 por mês' }, { value: '21_50', label: '21 a 50 por mês' },
  { value: 'acima_50', label: 'Mais de 50 por mês' },
];
const COMO_CONHECEU_OPTIONS = [
  { value: 'membro_oli', label: 'Indicação de membro OLI' },
  { value: 'amigo', label: 'Indicação de amigo/colega' },
  { value: 'redes', label: 'Redes sociais' },
  { value: 'evento', label: 'Evento OLI' },
  { value: 'google', label: 'Google / Internet' },
  { value: 'outro', label: 'Outro' },
];
const ASSESSORIA_OPTIONS = [
  { value: 'contabilidade', label: 'Contabilidade' },
  { value: 'juridica', label: 'Jurídica' },
  { value: 'convenios', label: 'Convênios' },
  { value: 'marketing', label: 'Marketing' },
];

export default function PerfilScreen() {
  const router = useRouter();
  const { userPlan } = useAppStore();
  const { profile, session, setProfile } = useAuthStore();
  const { exportData } = usePatientStore();

  const [editing,       setEditing]      = useState(false);
  const [saving,        setSaving]       = useState(false);
  const [uploadingPhoto,setUploadingPhoto]= useState(false);
  const [fotoUrl,       setFotoUrl]      = useState<string | null>(profile?.foto_url ?? null);

  const [nome,         setNome]         = useState(profile?.nome ?? '');
  const [crm,          setCrm]          = useState(profile?.crm ?? '');
  const [especialidade,setEspecialidade]= useState(profile?.especialidade ?? '');
  const [bio,          setBio]          = useState(profile?.bio ?? '');
  const [duracao,      setDuracao]      = useState(String(profile?.consultation_duration_minutes ?? 60));
  const [instagram,    setInstagram]    = useState(profile?.instagram ?? '');
  const [linkedin,     setLinkedin]     = useState(profile?.linkedin ?? '');
  const [website,      setWebsite]      = useState(profile?.website ?? '');
  const [whatsapp,     setWhatsapp]     = useState(profile?.whatsapp ?? '');
  const [subespecialidades, setSubespecialidades] = useState<string[]>(profile?.subespecialidades ?? []);

  // ── Objetivos do perfil (movidos do onboarding) ──
  const [atendePresencial, setAtendePresencial] = useState(!!profile?.tipo_atendimento && profile.tipo_atendimento !== 'telemedicina');
  const [atendeOnline,     setAtendeOnline]     = useState(profile?.tipo_atendimento === 'telemedicina' || profile?.tipo_atendimento === 'ambos');
  const [situacaoJuridica, setSituacaoJuridica] = useState<SituacaoJuridica | null>((profile?.situacao_juridica as SituacaoJuridica) ?? null);
  const [possuiCLT,        setPossuiCLT]        = useState<boolean | null>(profile?.possui_clt ?? null);
  const [possuiSocios,     setPossuiSocios]     = useState<boolean | null>(profile?.possui_socios ?? null);
  const [localAtuacao,     setLocalAtuacao]     = useState<LocalAtuacao | null>((profile?.local_atuacao as LocalAtuacao) ?? null);
  const [numLocais,        setNumLocais]        = useState<NumLocais | null>((profile?.num_locais as NumLocais) ?? null);
  const [cidade,           setCidade]           = useState(profile?.cidade_uf?.split(' / ')[0] ?? '');
  const [uf,               setUf]               = useState(profile?.cidade_uf?.split(' / ')[1] ?? '');
  const [faturamentoRange, setFaturamentoRange] = useState<FaturamentoRange | null>((profile?.faturamento_range as FaturamentoRange) ?? null);
  const [notasFiscaisRange,setNotasFiscaisRange] = useState<NotasFiscaisRange | null>((profile?.notas_fiscais_range as NotasFiscaisRange) ?? null);
  const [possuiFuncionarios, setPossuiFuncionarios] = useState<boolean | null>(profile?.possui_funcionarios ?? null);
  const [previsaoContratacao, setPrevisaoContratacao] = useState<boolean | null>(profile?.previsao_contratacao ?? null);
  const [assessoriasAtuais, setAssessoriasAtuais] = useState<string[]>(profile?.assessorias_atuais ?? []);
  const [comoConheceu,     setComoConheceu]     = useState<string | null>(profile?.como_conheceu ?? null);
  const [olicoinsToast,    setOlicoinsToast]    = useState<{ amount: number } | null>(null);

  const toggleAssessoria = (value: string) =>
    setAssessoriasAtuais(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);

  const {
    biometricAvailable,
    biometricEnabled,
    enableBiometric,
    disableBiometric,
  } = useAppLock();

  const [notifSessions,   setNotifSessions]   = useState(true);
  const [notifBuffer,     setNotifBuffer]     = useState(true);
  const [notifFinanceiro, setNotifFinanceiro] = useState(false);

  const handleSave = async () => {
    if (!session?.user?.id || !profile) return;
    setSaving(true);
    try {
      const durationMin = parseInt(duracao) || 60;
      const tipoAtendimento =
        atendePresencial && atendeOnline ? 'ambos'
        : atendePresencial ? 'presencial'
        : atendeOnline ? 'telemedicina'
        : null;
      const cidadeUf = cidade.trim() && uf ? `${cidade.trim()} / ${uf}` : null;
      const especialidadeTrim = especialidade.trim() || null;

      const updates = {
        nome:                         nome.trim() || profile.nome,
        crm:                          crm.trim()  || null,
        especialidade:                especialidadeTrim,
        atividade_exercida:           especialidadeTrim,
        bio:                          bio.trim()   || null,
        consultation_duration_minutes: durationMin,
        instagram:                    instagram.trim().replace(/^@/, '') || null,
        linkedin:                     linkedin.trim()  || null,
        website:                      website.trim()   || null,
        whatsapp:                     whatsapp.trim()  || null,
        subespecialidades:            subespecialidades.length > 0 ? subespecialidades : null,
        tipo_atendimento:             tipoAtendimento,
        situacao_juridica:            situacaoJuridica,
        possui_clt:                   possuiCLT,
        possui_socios:                possuiSocios,
        local_atuacao:                localAtuacao,
        num_locais:                   numLocais,
        cidade_uf:                    cidadeUf,
        faturamento_range:            faturamentoRange,
        notas_fiscais_range:          notasFiscaisRange,
        possui_funcionarios:          possuiFuncionarios,
        previsao_contratacao:         possuiFuncionarios ? null : previsaoContratacao,
        assessorias_atuais:           assessoriasAtuais,
        como_conheceu:                comoConheceu,
      };
      await updateProfile(session.user.id, updates);
      const updatedProfile = { ...profile, ...updates };
      setProfile(updatedProfile);
      useAppStore.getState().setUserName(updates.nome);
      useAppStore.getState().setConsultationDuration(durationMin);

      // Seções que acabaram de ficar completas creditam Olicoins (idempotente).
      const newlyDone = PROFILE_SECTIONS.filter(s => !s.isComplete(profile) && s.isComplete(updatedProfile));
      if (newlyDone.length > 0) {
        const amount = newlyDone.reduce((sum, s) => sum + s.pontos, 0);
        await Promise.all(newlyDone.map(s => creditOlicoins(profile.id, s.evento, s.pontos)));
        setOlicoinsToast({ amount });
        setTimeout(() => setOlicoinsToast(null), 2000);
      }

      setEditing(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as alterações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setNome(profile?.nome ?? '');
    setCrm(profile?.crm ?? '');
    setEspecialidade(profile?.especialidade ?? '');
    setBio(profile?.bio ?? '');
    setDuracao(String(profile?.consultation_duration_minutes ?? 60));
    setInstagram(profile?.instagram ?? '');
    setLinkedin(profile?.linkedin ?? '');
    setWebsite(profile?.website ?? '');
    setWhatsapp(profile?.whatsapp ?? '');
    setSubespecialidades(profile?.subespecialidades ?? []);
    setAtendePresencial(!!profile?.tipo_atendimento && profile.tipo_atendimento !== 'telemedicina');
    setAtendeOnline(profile?.tipo_atendimento === 'telemedicina' || profile?.tipo_atendimento === 'ambos');
    setSituacaoJuridica((profile?.situacao_juridica as SituacaoJuridica) ?? null);
    setPossuiCLT(profile?.possui_clt ?? null);
    setPossuiSocios(profile?.possui_socios ?? null);
    setLocalAtuacao((profile?.local_atuacao as LocalAtuacao) ?? null);
    setNumLocais((profile?.num_locais as NumLocais) ?? null);
    setCidade(profile?.cidade_uf?.split(' / ')[0] ?? '');
    setUf(profile?.cidade_uf?.split(' / ')[1] ?? '');
    setFaturamentoRange((profile?.faturamento_range as FaturamentoRange) ?? null);
    setNotasFiscaisRange((profile?.notas_fiscais_range as NotasFiscaisRange) ?? null);
    setPossuiFuncionarios(profile?.possui_funcionarios ?? null);
    setPrevisaoContratacao(profile?.previsao_contratacao ?? null);
    setAssessoriasAtuais(profile?.assessorias_atuais ?? []);
    setComoConheceu(profile?.como_conheceu ?? null);
    setEditing(false);
  };

  const handleAvatarOptions = () => {
    const userId = session?.user?.id;
    if (!userId) return;

    const options: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
      {
        text: 'Escolher da galeria',
        onPress: async () => {
          setUploadingPhoto(true);
          try {
            const url = await updateProfileAvatar(userId, 'gallery');
            if (url) { setFotoUrl(url); setProfile({ ...profile!, foto_url: url }); }
          } catch {
            Alert.alert('Erro', 'Não foi possível atualizar a foto. Tente novamente.');
          } finally { setUploadingPhoto(false); }
        },
      },
      {
        text: 'Tirar foto',
        onPress: async () => {
          setUploadingPhoto(true);
          try {
            const url = await updateProfileAvatar(userId, 'camera');
            if (url) { setFotoUrl(url); setProfile({ ...profile!, foto_url: url }); }
          } catch {
            Alert.alert('Erro', 'Não foi possível atualizar a foto. Tente novamente.');
          } finally { setUploadingPhoto(false); }
        },
      },
    ];

    if (fotoUrl) {
      options.push({
        text: 'Remover foto',
        style: 'destructive',
        onPress: async () => {
          setUploadingPhoto(true);
          try {
            await removeProfileAvatar(userId);
            setFotoUrl(null);
            setProfile({ ...profile!, foto_url: null });
          } catch {
            Alert.alert('Erro', 'Não foi possível remover a foto.');
          } finally { setUploadingPhoto(false); }
        },
      });
    }

    options.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Foto de Perfil', 'Escolha uma opção', options);
  };

  const handleExportData = () => {
    Alert.alert(
      'Exportar Meus Dados',
      'Seus dados serão exportados em formato JSON conforme exigido pela LGPD (Art. 18). O arquivo será compartilhado pelo seu dispositivo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Exportar',
          onPress: async () => {
            try {
              await exportMyData();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Erro desconhecido';
              Alert.alert('Erro', `Não foi possível exportar os dados.\n\n${msg}`);
            }
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir Conta',
      'Esta ação excluirá permanentemente todos os seus dados do OLI Health Hub, conforme Art. 18 da LGPD. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar exclusão',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Tem certeza?',
              'Todos os seus pacientes, reservas e histórico serão apagados permanentemente.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Excluir tudo',
                  style: 'destructive',
                  onPress: async () => {
                    if (!session?.user?.id) return;
                    try {
                      await deleteAccountData(session.user.id);
                      router.replace('/login');
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
                      Alert.alert('Erro', `Não foi possível excluir a conta.\n\n${msg}`);
                    }
                  },
                },
              ],
            ),
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          if (session?.user?.id) await unregisterPushToken(session.user.id);
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  const displayName = profile?.nome ?? '';
  const initial     = displayName.split(' ').find(w => w.length > 1)?.charAt(0) ?? displayName.charAt(0) ?? '?';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Avatar + Nome ── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={handleAvatarOptions}
            accessibilityLabel="Alterar foto de perfil"
            disabled={uploadingPhoto}
          >
            {fotoUrl ? (
              <Image source={{ uri: fotoUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>{initial.toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              {uploadingPhoto
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Ionicons name="camera" size={16} color={colors.white} />
              }
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{displayName}</Text>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>Plano {userPlan}</Text>
          </View>
          {session?.user?.id && <OlicoinsBadge professionalId={session.user.id} />}
          <View style={styles.badgeRow}>
            <IndiqueEGanheButton />
          </View>
        </View>

        {/* ── Progresso do perfil (Olicoins) ── */}
        {profile && <ProfileCompletionCard profile={profile} />}

        {/* ── Dados Pessoais ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>DADOS PESSOAIS</Text>
          {!editing ? (
            <TouchableOpacity onPress={() => setEditing(true)} accessibilityLabel="Editar dados">
              <Text style={styles.editLink}>Editar</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity onPress={handleCancelEdit} style={styles.cancelBtn} accessibilityRole="button" accessibilityLabel="Cancelar edição">
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving} accessibilityRole="button" accessibilityLabel="Salvar alterações">
                {saving
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={styles.saveBtnText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={[styles.card, shadows.card]}>
          <EditableRow
            icon="person-outline"
            label="Nome"
            value={nome}
            editing={editing}
            onChangeText={setNome}
            autoCapitalize="words"
          />
          <EditableRow
            icon="medical-outline"
            label="CRM"
            value={crm}
            editing={editing}
            onChangeText={setCrm}
            placeholder="Ex: CRM/SP 123456"
          />
          <EditableRow
            icon="ribbon-outline"
            label="Especialidade"
            value={especialidade}
            editing={editing}
            onChangeText={setEspecialidade}
            placeholder="Ex: Ginecologia"
            autoCapitalize="words"
          />
          <EditableBioRow
            value={bio}
            editing={editing}
            onChangeText={setBio}
          />
          <EditableRow
            icon="time-outline"
            label="Duração da consulta (min)"
            value={duracao}
            editing={editing}
            onChangeText={setDuracao}
            keyboardType="number-pad"
            placeholder="60"
          />
          <ProfileRow
            icon="mail-outline"
            label="E-mail"
            value={session?.user?.email ?? '—'}
          />
          <EditableRow
            icon="logo-whatsapp"
            label="WhatsApp"
            value={whatsapp}
            editing={editing}
            onChangeText={setWhatsapp}
            placeholder="11999998888"
            keyboardType="number-pad"
          />
          <EditableRow
            icon="logo-instagram"
            label="Instagram"
            value={instagram}
            editing={editing}
            onChangeText={setInstagram}
            placeholder="@seu_usuario"
            autoCapitalize="none"
            keyboardType="url"
          />
          <EditableRow
            icon="logo-linkedin"
            label="LinkedIn"
            value={linkedin}
            editing={editing}
            onChangeText={setLinkedin}
            placeholder="linkedin.com/in/seu-perfil"
            autoCapitalize="none"
            keyboardType="url"
          />
          <EditableRow
            icon="globe-outline"
            label="Website"
            value={website}
            editing={editing}
            onChangeText={setWebsite}
            placeholder="https://seusite.com.br"
            autoCapitalize="none"
            keyboardType="url"
            last
          />
        </View>

        {/* ── Subespecialidades ── */}
        <Text style={styles.sectionTitle}>SUBESPECIALIDADES</Text>
        <View style={[styles.card, shadows.card, { padding: spacing.md }]}>
          {editing ? (
            <TagInput
              tags={subespecialidades}
              onChange={setSubespecialidades}
              placeholder="Ex: cirurgia bariátrica"
            />
          ) : subespecialidades.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {subespecialidades.map(s => (
                <View key={s} style={styles.subChip}>
                  <Text style={styles.subChipText}>{s}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.bioValue}>Nenhuma subespecialidade adicionada.</Text>
          )}
        </View>

        {/* ── Objetivos do perfil (movidos do onboarding — rendem Olicoins) ── */}
        <Text style={styles.sectionTitle}>SEUS OBJETIVOS</Text>
        <View style={[styles.card, shadows.card]}>
          <ToggleRow icon="business-outline" label="Atende presencial" value={atendePresencial} editing={editing} onChange={setAtendePresencial} />
          <ToggleRow icon="videocam-outline" label="Atende por telemedicina" value={atendeOnline} editing={editing} onChange={setAtendeOnline} />
          <SelectRow
            icon="briefcase-outline" label="Situação jurídica" value={situacaoJuridica} editing={editing}
            displayValue={SITUACAO_OPTIONS.find(o => o.value === situacaoJuridica)?.label ?? ''}
            options={SITUACAO_OPTIONS} onSelect={setSituacaoJuridica}
          />
          <ToggleRow icon="checkmark-done-outline" label="Possui vínculo CLT" value={possuiCLT} editing={editing} onChange={setPossuiCLT} />
          <ToggleRow icon="people-outline" label="Possui sócios" value={possuiSocios} editing={editing} onChange={setPossuiSocios} />
          <SelectRow
            icon="home-outline" label="Local de atuação" value={localAtuacao} editing={editing}
            displayValue={LOCAL_OPTIONS.find(o => o.value === localAtuacao)?.label ?? ''}
            options={LOCAL_OPTIONS} onSelect={setLocalAtuacao}
          />
          <SelectRow
            icon="git-branch-outline" label="Nº de locais" value={numLocais} editing={editing}
            displayValue={NUM_LOCAIS_OPTIONS.find(o => o.value === numLocais)?.label ?? ''}
            options={NUM_LOCAIS_OPTIONS} onSelect={setNumLocais}
          />
          <EditableRow icon="location-outline" label="Cidade" value={cidade} editing={editing} onChangeText={setCidade} placeholder="Ex: São Paulo" autoCapitalize="words" />
          <SelectRow
            icon="map-outline" label="Estado" value={uf} editing={editing}
            displayValue={ESTADOS.find(e => e.uf === uf)?.nome ?? ''}
            options={ESTADOS.map(e => ({ value: e.uf, label: e.nome }))} onSelect={setUf}
          />
          <SelectRow
            icon="cash-outline" label="Faturamento mensal" value={faturamentoRange} editing={editing}
            displayValue={FATURAMENTO_OPTIONS.find(o => o.value === faturamentoRange)?.label ?? ''}
            options={FATURAMENTO_OPTIONS} onSelect={setFaturamentoRange}
          />
          <SelectRow
            icon="receipt-outline" label="Notas fiscais/mês" value={notasFiscaisRange} editing={editing}
            displayValue={NOTAS_OPTIONS.find(o => o.value === notasFiscaisRange)?.label ?? ''}
            options={NOTAS_OPTIONS} onSelect={setNotasFiscaisRange}
          />
          <ToggleRow icon="people-circle-outline" label="Possui funcionários" value={possuiFuncionarios} editing={editing} onChange={(v) => { setPossuiFuncionarios(v); setPrevisaoContratacao(null); }} />
          {possuiFuncionarios === false && (
            <ToggleRow icon="calendar-outline" label="Previsão de contratação" value={previsaoContratacao} editing={editing} onChange={setPrevisaoContratacao} />
          )}
          <SelectRow
            icon="megaphone-outline" label="Como nos conheceu" value={comoConheceu} editing={editing}
            displayValue={COMO_CONHECEU_OPTIONS.find(o => o.value === comoConheceu)?.label ?? ''}
            options={COMO_CONHECEU_OPTIONS} onSelect={setComoConheceu} last={!editing}
          />
          {editing && (
            <View>
              <Text style={[styles.rowLabel, styles.assessoriasLabel]}>Assessorias que já possui</Text>
              <View style={styles.chipRow}>
                {ASSESSORIA_OPTIONS.map(o => {
                  const active = assessoriasAtuais.includes(o.value);
                  return (
                    <TouchableOpacity key={o.value} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleAssessoria(o.value)} accessibilityLabel={o.label}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* ── Notificações ── */}
        <Text style={styles.sectionTitle}>NOTIFICAÇÕES</Text>
        <View style={[styles.card, shadows.card]}>
          <NotifRow label="Alertas de Sessão"  description="Buffer e overtime da sala"          value={notifSessions}   onChange={setNotifSessions} />
          <NotifRow label="Tempo Esgotado"      description="Aviso com 15 min de antecedência"  value={notifBuffer}     onChange={setNotifBuffer} />
          <NotifRow label="Financeiro"          description="Novas faturas e cobranças"          value={notifFinanceiro} onChange={setNotifFinanceiro} last />
        </View>

        {/* ── Segurança ── */}
        <Text style={styles.sectionTitle}>SEGURANÇA</Text>
        <View style={[styles.card, shadows.card]}>

          {/* Bloqueio biométrico */}
          <View style={styles.notifRow}>
            <View style={styles.notifText}>
              <View style={styles.secIconRow}>
                <Ionicons
                  name={biometricEnabled ? 'finger-print' : 'lock-closed-outline'}
                  size={18}
                  color={biometricEnabled ? colors.oliGreen : colors.gray}
                />
                <Text style={styles.notifLabel}>Bloqueio Biométrico</Text>
              </View>
              <Text style={styles.notifDesc}>
                {biometricAvailable
                  ? 'Trava o app após 5 min em segundo plano'
                  : 'Face ID / Touch ID não disponível neste dispositivo'}
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={async (v) => {
                if (v) {
                  await enableBiometric();
                } else {
                  await disableBiometric();
                }
              }}
              disabled={!biometricAvailable}
              trackColor={{ false: colors.border, true: `${colors.oliGreen}80` }}
              thumbColor={biometricEnabled ? colors.oliGreen : colors.gray}
              accessibilityLabel={`Bloqueio biométrico: ${biometricEnabled ? 'ativado' : 'desativado'}`}
            />
          </View>

          {/* MFA */}
          <TouchableOpacity
            style={[styles.actionRow, styles.actionRowLast]}
            onPress={() => router.push('/mfa-setup')}
            accessibilityLabel="Configurar verificação em duas etapas"
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.oliGreen} />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionLabel}>Verificação em Duas Etapas</Text>
              <Text style={styles.actionDesc}>TOTP — Google Authenticator, Authy</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.gray} />
          </TouchableOpacity>

        </View>

        {/* ── Plano e Indicação ── */}
        <Text style={styles.sectionTitle}>PLANO E BENEFÍCIOS</Text>
        <View style={[styles.card, shadows.card]}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/meu-plano')}
            accessibilityLabel="Ver meu plano e opções de upgrade"
          >
            <Ionicons name="star-outline" size={20} color={colors.oliGold} />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionLabel}>Meu Plano</Text>
              <Text style={styles.actionDesc}>Comparar planos e fazer upgrade</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.gray} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionRow, styles.actionRowLast]}
            onPress={() => router.push('/indicacao')}
            accessibilityLabel="Programa de indicação — ganhe 1 hora grátis"
          >
            <Ionicons name="gift-outline" size={20} color={colors.oliGold} />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionLabel}>Programa de Indicação</Text>
              <Text style={styles.actionDesc}>Indique colegas e ganhe 1h de crédito</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.gray} />
          </TouchableOpacity>
        </View>

        {/* ── Privacidade LGPD ── */}
        <Text style={styles.sectionTitle}>PRIVACIDADE E DADOS (LGPD)</Text>
        <View style={[styles.card, shadows.card]}>
          <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/politica-privacidade')} accessibilityLabel="Ver política de privacidade">
            <Ionicons name="document-text-outline" size={20} color={colors.oliGreen} />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionLabel}>Política de Privacidade</Text>
              <Text style={styles.actionDesc}>Como tratamos seus dados pessoais</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.gray} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={handleExportData} accessibilityLabel="Exportar meus dados">
            <Ionicons name="download-outline" size={20} color={colors.oliGreen} />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionLabel}>Exportar Meus Dados</Text>
              <Text style={styles.actionDesc}>Art. 18 LGPD — direito de portabilidade</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.gray} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionRow, styles.actionRowLast]} onPress={handleDeleteAccount} accessibilityLabel="Excluir conta e dados">
            <Ionicons name="trash-outline" size={20} color={colors.oliRed} />
            <View style={styles.actionTextWrap}>
              <Text style={[styles.actionLabel, { color: colors.oliRed }]}>Excluir Conta e Dados</Text>
              <Text style={styles.actionDesc}>Art. 18 LGPD — direito ao esquecimento</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.gray} />
          </TouchableOpacity>
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} accessibilityLabel="Sair da conta">
          <Ionicons name="log-out-outline" size={20} color={colors.oliRed} />
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>

        {/* Rodapé com versão + ID da OTA ativa */}
        <View style={styles.versionBlock}>
          <Text style={styles.version}>
            OLI Health Hub v{Constants.expoConfig?.version ?? '1.0.0'}
            {Constants.expoConfig?.ios?.buildNumber ? ` (build ${Constants.expoConfig.ios.buildNumber})` : ''}
          </Text>
          <Text style={styles.versionSub}>
            {Updates.channel ? `Canal: ${Updates.channel}` : ''}
            {Updates.updateId ? `  ·  OTA ${Updates.updateId.slice(0, 8)}` : '  ·  embutida'}
          </Text>
        </View>
      </ScrollView>

      <OlicoinsToast visible={!!olicoinsToast} amount={olicoinsToast?.amount ?? 0} />
    </SafeAreaView>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function EditableRow({
  icon, label, value, editing, onChangeText,
  placeholder, keyboardType, autoCapitalize, last,
}: {
  icon: string; label: string; value: string; editing: boolean;
  onChangeText: (v: string) => void; placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'url'; autoCapitalize?: 'none' | 'words';
  last?: boolean;
}) {
  return (
    <View style={[styles.profileRow, last && styles.profileRowLast]}>
      <Ionicons name={icon as any} size={18} color={colors.gray} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      {editing ? (
        <TextInput
          style={styles.rowInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? '—'}
          placeholderTextColor={colors.oliLightGray}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'none'}
        />
      ) : (
        <Text style={styles.rowValue} numberOfLines={1}>{value || '—'}</Text>
      )}
    </View>
  );
}

function EditableBioRow({ value, editing, onChangeText }: {
  value: string; editing: boolean; onChangeText: (v: string) => void;
}) {
  return (
    <View style={[styles.profileRow, { alignItems: 'flex-start', paddingVertical: spacing.md }]}>
      <Ionicons name="text-outline" size={18} color={colors.gray} style={[styles.rowIcon, { marginTop: 2 }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { marginBottom: 4 }]}>Bio (aparece na comunidade)</Text>
        {editing ? (
          <TextInput
            style={styles.bioInput}
            value={value}
            onChangeText={onChangeText}
            placeholder="Conte um pouco sobre você e sua especialidade…"
            placeholderTextColor={colors.oliLightGray}
            multiline
            numberOfLines={3}
            autoCapitalize="sentences"
          />
        ) : (
          <Text style={styles.bioValue} numberOfLines={4}>
            {value || 'Nenhuma bio adicionada.'}
          </Text>
        )}
      </View>
    </View>
  );
}

function ProfileRow({ icon, label, value, last = false }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.profileRow, last && styles.profileRowLast]}>
      <Ionicons name={icon as any} size={18} color={colors.gray} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function NotifRow({ label, description, value, onChange, last = false }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void; last?: boolean;
}) {
  return (
    <View style={[styles.notifRow, last && styles.profileRowLast]}>
      <View style={styles.notifText}>
        <Text style={styles.notifLabel}>{label}</Text>
        <Text style={styles.notifDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: `${colors.oliGreen}80` }}
        thumbColor={value ? colors.oliGreen : colors.gray}
        accessibilityLabel={`${label}: ${value ? 'ativado' : 'desativado'}`}
      />
    </View>
  );
}

function ToggleRow({ icon, label, value, editing, onChange, last = false }: {
  icon: string; label: string; value: boolean | null; editing: boolean;
  onChange: (v: boolean) => void; last?: boolean;
}) {
  return (
    <View style={[styles.profileRow, last && styles.profileRowLast]}>
      <Ionicons name={icon as any} size={18} color={colors.gray} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      {editing ? (
        <Switch
          value={value === true}
          onValueChange={onChange}
          trackColor={{ false: colors.border, true: `${colors.oliGreen}80` }}
          thumbColor={value ? colors.oliGreen : colors.gray}
          accessibilityLabel={`${label}: ${value ? 'sim' : 'não'}`}
        />
      ) : (
        <Text style={styles.rowValue}>{value === null ? '—' : value ? 'Sim' : 'Não'}</Text>
      )}
    </View>
  );
}

function SelectRow<T extends string>({
  icon, label, value, displayValue, editing, options, onSelect, last = false,
}: {
  icon: string; label: string; value: T | null; displayValue: string; editing: boolean;
  options: { value: T; label: string }[]; onSelect: (v: T) => void; last?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={[styles.profileRow, last && styles.profileRowLast]}
        onPress={() => editing && setOpen(true)}
        disabled={!editing}
        accessibilityLabel={label}
      >
        <Ionicons name={icon as any} size={18} color={colors.gray} style={styles.rowIcon} />
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1}>{displayValue || '—'}</Text>
        {editing && <Ionicons name="chevron-forward" size={16} color={colors.oliLightGray} />}
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" transparent>
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} accessibilityLabel="Fechar">
                <Ionicons name="close" size={24} color={colors.oliDarkGray} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={o => o.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={pickerStyles.item}
                  onPress={() => { onSelect(item.value); setOpen(false); }}
                  accessibilityLabel={item.label}
                >
                  <Text style={pickerStyles.itemText}>{item.label}</Text>
                  {value === item.value && <Ionicons name="checkmark-circle" size={20} color={colors.oliGreen} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { paddingBottom: 48 },

  avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
  badgeRow:      { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  avatarWrap:    { marginBottom: spacing.md, position: 'relative' },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: `${colors.oliGreen}26`,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImg: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2, borderColor: colors.oliGreen,
  },
  avatarEditBadge: {
    position:        'absolute',
    bottom:          0,
    right:           0,
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: colors.oliGreen,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     2,
    borderColor:     colors.white,
  },
  avatarLetter: { fontSize: 40, fontWeight: '700', color: colors.oliGreen },
  userName:     { fontSize: 22, fontWeight: '700', color: colors.oliDarkGray },
  planBadge:    { marginTop: 6, backgroundColor: `${colors.oliGold}1A`, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 4 },
  planBadgeText:{ fontSize: 13, fontWeight: '700', color: colors.oliGold },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.xs },
  sectionTitle:  { fontSize: 12, fontWeight: '700', color: colors.gray, paddingHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.xs, letterSpacing: 0.5 },
  editLink:      { fontSize: 14, fontWeight: '600', color: colors.oliGreen },
  editActions:   { flexDirection: 'row', gap: spacing.sm },
  cancelBtn:     { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  cancelBtnText: { fontSize: 14, color: colors.gray },
  saveBtn:       { backgroundColor: colors.oliGreen, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 4, minWidth: 60, alignItems: 'center' },
  saveBtnText:   { fontSize: 14, fontWeight: '700', color: colors.white },

  card: { backgroundColor: colors.white, borderRadius: radius.lg, marginHorizontal: spacing.md, overflow: 'hidden' },

  profileRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  profileRowLast: { borderBottomWidth: 0 },
  rowIcon:  { marginRight: spacing.sm },
  rowLabel: { fontSize: 14, color: colors.gray, flex: 1 },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray, maxWidth: '55%', textAlign: 'right' },
  rowInput:  { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray, textAlign: 'right', flex: 1 },
  bioInput:  { fontSize: 13, color: colors.oliDarkGray, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, minHeight: 60, textAlignVertical: 'top' },
  bioValue:  { fontSize: 13, color: colors.gray, lineHeight: 18 },
  subChip:      { backgroundColor: `${colors.oliGreen}12`, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  subChipText:  { fontSize: 12, fontWeight: '600', color: colors.oliGreen },

  notifRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  notifText:  { flex: 1 },
  notifLabel: { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  notifDesc:  { fontSize: 12, color: colors.gray, marginTop: 2 },
  secIconRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: 16,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  actionRowLast:  { borderBottomWidth: 0 },
  actionTextWrap: { flex: 1 },
  actionLabel:    { fontSize: 14, fontWeight: '600', color: colors.oliDarkGray },
  actionDesc:     { fontSize: 12, color: colors.gray, marginTop: 2 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.lg,
    paddingVertical: 14, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.oliRed,
    backgroundColor: `${colors.oliRed}0D`,
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: colors.oliRed },
  version:    { textAlign: 'center', fontSize: 12, color: colors.gray },
  versionBlock: { alignItems: 'center', marginTop: spacing.lg, gap: 2, paddingBottom: spacing.md },
  versionSub: { fontSize: 10, color: colors.gray, fontFamily: 'Courier' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.md },
  assessoriasLabel: { padding: spacing.md, paddingBottom: 0 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.oliGreen, borderColor: colors.oliGreen },
  chipText: { fontSize: 13, color: colors.oliDarkGray },
  chipTextActive: { color: colors.white, fontWeight: '600' },
});

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 16, fontWeight: '700', color: colors.oliDarkGray },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  itemText: { fontSize: 14, color: colors.oliDarkGray },
});
