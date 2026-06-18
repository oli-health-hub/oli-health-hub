import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/**
 * Fecha um overlay/modal customizado ao pressionar o botão voltar do Android.
 *
 * Modais renderizados condicionalmente (View/SafeAreaView, sem o componente
 * <Modal> nativo) não recebem `onRequestClose`, então o back de hardware
 * sairia da aba/app em vez de fechar o overlay. Este hook intercepta o evento
 * e chama `onBack`, consumindo-o. Em overlays empilhados, o último montado
 * trata primeiro (ordem reversa de registro do BackHandler).
 */
export function useAndroidBack(onBack: () => void) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
}
