import { useEffect } from 'react';
import { Text, TextInput } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/theme/designSystem';
import { useAuthStore } from '../src/store/authStore';
import { useAppLock } from '../src/hooks/useAppLock';
import { useSessionTimeout } from '../src/hooks/useSessionTimeout';
import { AppLockScreen } from '../src/components/AppLockScreen';
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
    const inAuthFlow   = inLogin || inOnboarding || inMFAVerify || inMFASetup;

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

    // Sessão ativa fora do fluxo de auth — garantir gate de onboarding
    if (session && !inAuthFlow) {
      const onboardingDone = profile?.onboarding_complete ?? false;
      if (!onboardingDone) { router.replace('/onboarding'); return; }
    }
  }, [session, isLoading, profile, segments]);

  return (
    <>
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

      {/* App Lock — overlay sobre tudo quando sessão está bloqueada */}
      {isLocked && session && <AppLockScreen onUnlock={unlock} />}
    </>
  );
}
