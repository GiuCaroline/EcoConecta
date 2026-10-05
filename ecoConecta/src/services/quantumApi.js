import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

export async function getQuantumSessionToken() {
  // A demonstração web não armazena tokens. O fluxo conectado deste serviço
  // usa o mesmo SecureStore da integração mobile documentada no backend.
  if (Platform.OS === "web") return null;
  return SecureStore.getItemAsync("ecoconecta.session");
}
export async function requestQuantum({ volumeA, volumeB, requestIds, token }) {
  if (!BASE_URL)
    throw new Error(
      "Configure EXPO_PUBLIC_API_URL no .env do app e inicie a API Node e o serviço Python. Veja QUANTUM.md no backend.",
    );
  const connected = Boolean(token && requestIds);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(
      `${BASE_URL}/api/quantum/${connected ? "recommendation" : "demo"}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(connected ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(connected ? { requestIds } : { volumeA, volumeB }),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data?.error?.message || "Não foi possível executar o circuito.",
      );
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error(
        "A simulação demorou. Confira se o serviço Python está ativo e tente novamente.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
