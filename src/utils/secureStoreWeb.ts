import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store não tem implementação web (usa keychain/keystore nativo).
// No SSR do Expo web o módulo nem tem `window` disponível ainda — guard duplo.
const webSafeSecureStore = {
  getItemAsync:    async (k: string) => (typeof window === 'undefined' ? null : window.localStorage.getItem(k)),
  setItemAsync:    async (k: string, v: string) => { if (typeof window !== 'undefined') window.localStorage.setItem(k, v); },
  deleteItemAsync: async (k: string) => { if (typeof window !== 'undefined') window.localStorage.removeItem(k); },
};

export const secureStore = Platform.OS === 'web' ? webSafeSecureStore : SecureStore;
