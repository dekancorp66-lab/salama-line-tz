import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'salamaline.accessToken';

/** Access tokens are secrets and always live in SecureStore, never AsyncStorage. */
export const tokenStore = {
  async get(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async set(token: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  },
  async remove(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    } catch {
      // Clearing a missing token is a no-op.
    }
  },
};
