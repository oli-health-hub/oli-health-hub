import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Switch, ActivityIndicator, Image,
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
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

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
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const durationMin = parseInt(duracao) || 60;
      const updates = {
        nome:                         nome.trim() || profile!.nome,
        crm:                          crm.trim()  || null,
        especialidade:                especialidade.trim() || null,
        bio:                          bio.trim()   || null,
        consultation_duration_minutes: durationMin,
        instagram:                    instagram.trim() || null,
        linkedin:                     linkedin.trim()  || null,
        website:                      website.trim()   || null,
        whatsapp:                     whatsapp.trim()  || null,
        subespecialidades:            subespecialidades.length > 0 ? subespecialidades : null,
      };
      await updateProfile(session.user.id, updates);
      setProfile({ ...profile!, ...updates });
      useAppStore.getState().setUserName(updates.nome);
      useAppStore.getState().setConsultationDuration(durationMin);
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
                : <Ionicons name="camera" size={14} color={colors.white} />
              }
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{displayName}</Text>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>Plano {userPlan}</Text>
          </View>
        </View>

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.oliBackground },
  content: { paddingBottom: 48 },

  avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
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
    width:           28,
    height:          28,
    borderRadius:    14,
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
});
