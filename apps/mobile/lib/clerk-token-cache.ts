import * as SecureStore from "expo-secure-store";

// Clerk's recommended token cache for Expo — session tokens are sensitive
// enough to warrant the Keychain/Keystore-backed store over AsyncStorage.
export const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // no-op: a failed write just means the user re-authenticates next launch
    }
  },
};
