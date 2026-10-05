import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createApiClient } from "./apiClient";
const TOKEN_KEY = "ecoconecta.session";
// No navegador a sessão fica somente em memória. Recarregar exige novo login.
// No Android/iOS o token é guardado criptografado pelo SecureStore.
let webToken = null;
const storage = {
  get: () =>
    Platform.OS === "web"
      ? Promise.resolve(webToken)
      : SecureStore.getItemAsync(TOKEN_KEY),
  set: (token) =>
    Platform.OS === "web"
      ? Promise.resolve((webToken = token))
      : SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () =>
    Platform.OS === "web"
      ? Promise.resolve((webToken = null))
      : SecureStore.deleteItemAsync(TOKEN_KEY),
};
export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL,
  storage,
});
