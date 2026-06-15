import { useEffect } from 'react';
import { Text, TextInput } from 'react-native';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { captureReferralFromUrl } from '../src/utils/referral';
import { handleRecoveryDeepLink } from '../src/utils/passwordRecovery';
import { colors } from '../src/theme/designSystem';
import { useAuthStore } from '../src/store/authStore';
import { useAppLock } from '../src/hooks/useAppLock';
import { useSessionTimeout } from '../src/hooks/useSessionTimeout';
import { AppLockScreen } from '../src/components/AppLockScreen';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { checkMFARequired } from '../src/hooks/useMFA';
import {
  requestNotificationPermission,
  addNotificationResponseListener,
} from '../src/services/notificationService';
import { initSentry, setSentryUser, clearSentryUser } from '../src/services/sentryService';

// Inicializa Sentry antes da primeira renderização (sem PII — só DSN)
initSentry();

// Desativa o escalonamento de fonte do sistema em todos os textos do app,
// garantindo tamanhos consistentes entre iOS e Android.
(Text as any).defaultProps = { ...(Text as any).defaultProps, allowFontScaling: false };
(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, allowFontScaling: false };

export default function RootLayout() {
  const { session, isLoading, profile, initialize } = useAuthStore();
  const router   = useRouter();
  const segments = useSegments();
  const { isLocked, unlock } = useAppLock();
  useSessionTimeout(); // logout automático após 30 min de inatividade

  useEffect(() => { initialize(); }, []);

  // Sentry: identifica/desidentifica usuário ao mudar sessão (só UUID, sem PII)
  useEffect(() => {
    if (session?.user?.id) {
      setSentryUser(session.user.id);
    } else {
      clearSentryUser();
    }
  }, [session?.user?.id]);

  // Pede permissão de notificação uma vez na inicialização
  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  // Captura código de indicação (?ref=) de deep link / universal link.
  // Cold start (app aberto pelo link) + warm (link tocado com app rodando).
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      captureReferralFromUrl(url ?? '').catch(() => {});
      // Link de recuperação de senha → abre sessão e vai pra tela de nova senha
      const isRecovery = await handleRecoveryDeepLink(url).catch(() => false);
      if (isRecovery) router.replace('/nova-senha' as never);
    };
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // Navega para a tela certa ao tocar em uma notificação
  useEffect(() => {
    const unsub = addNotificationResponseListener((type) => {
      if (!session) return;
      if (type === 'SESSION_ENDING_SOON' || type === 'SESSION_ENDED' || type === 'BUFFER_URGENT') {
        router.push('/');           // Dashboard — onde fica o timer
      } else if (type === 'LOW_BALANCE') {
        router.push('/(tabs)/ecossistema'); // Tela de compra de horas
      }
    });
    return unsub;
  }, [session]);

  useEffect(() => {
    if (isLoading) return;

    const inLogin      = segments[0] === 'login';
    const inOnboarding = segments[0] === 'onboarding';
    const inMFAVerify  = segments[0] === 'mfa-verify';
    const inMFASetup   = segments[0] === 'mfa-setup';
    const inNovaSenha  = (segments[0] as string) === 'nova-senha';
    const inAuthFlow   = inLogin || inOnboarding || inMFAVerify || inMFASetup || inNovaSenha;

    // Tela de nova senha (recuperação): não redirecionar — fluxo próprio
    if (inNovaSenha) return;

    // Sem sessão → login
    if (!session && !inLogin) { router.replace('/login'); return; }

    if (session && inLogin) {
      // Verifica MFA pendente antes de entrar no app
      checkMFARequired().then(mfaRequired => {
        if (mfaRequired) { router.replace('/mfa-verify'); return; }
        const onboardingDone = profile?.onboarding_complete ?? false;
        router.replace(onboardingDone ? '/' : '/onboarding');
      });
      return;
    }

    // Sessão ativa fora do fluxo de auth — gates de acesso
    if (session && !inAuthFlow) {
      // Gate 1: conta bloqueada/excluída pelo admin → tela de bloqueio
      const accountStatus = (profile as { account_status?: string } | null)?.account_status ?? 'active';
      const inBlocked = (segments[0] as string) === 'conta-bloqueada';
      if (accountStatus !== 'active' && !inBlocked) {
        router.replace('/conta-bloqueada' as never);
        return;
      }
      if (accountStatus === 'active' && inBlocked) {
        router.replace('/');
        return;
      }

      // Gate 2: onboarding pendente
      const onboardingDone = profile?.onboarding_complete ?? false;
      if (!onboardingDone && !inBlocked) { router.replace('/onboarding'); return; }
    }
  }, [session, isLoading, profile, segments]);

  return (
    <ErrorBoundary>
      <StatusBar style="dark" backgroundColor={colors.white} />
      <Stack
        screenOptions={{
          headerStyle:      { backgroundColor: colors.white },
          headerTintColor:  colors.oliDarkGray,
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          contentStyle:     { backgroundColor: colors.oliBackground },
          animation:        'slide_from_right',
        }}
      >
        <Stack.Screen name="login"       options={{ headerShown: false }} />
        <Stack.Screen name="onboarding"  options={{ headerShown: false }} />
        <Stack.Screen name="mfa-verify"  options={{ headerShown: false }} />
        <Stack.Screen name="mfa-setup"   options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="nova-senha"  options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
        <Stack.Screen
          name="chatbot"
          options={{
            title:        'Assessoria Jurídica — Ana',
            presentation: 'modal',
            headerStyle:  { backgroundColor: colors.white },
          }}
        />
        <Stack.Screen
          name="perfil"
          options={{
            title:        'Meu Perfil',
            presentation: 'modal',
            headerStyle:  { backgroundColor: colors.white },
          }}
        />
        <Stack.Screen
          name="politica-privacidade"
          options={{
            title:       'Política de Privacidade',
            headerStyle: { backgroundColor: colors.white },
          }}
        />
      </Stack>

      {/* App Lock — overlay sobre tudo quando sessão está bloqueada.
          Exceto na tela de nova senha (fluxo de recuperação não pode travar). */}
      {isLocked && session && (segments[0] as string) !== 'nova-senha' && (
        <AppLockScreen onUnlock={unlock} />
      )}
    </ErrorBoundary>
  );
}
