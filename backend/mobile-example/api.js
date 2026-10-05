// Copie para ecoConecta/src/services/api.js. Uso para Android/iOS no Expo Go.
import * as SecureStore from "expo-secure-store";
const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
const TOKEN_KEY = "ecoconecta.session";
let onExpired = () => {};
export const setSessionExpiredHandler = (handler) => {
  onExpired = handler;
};
export const getSessionToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const clearSessionToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

export async function apiRequest(
  path,
  { method = "GET", body, auth = true } = {},
) {
  if (!BASE_URL) throw new Error("Defina EXPO_PUBLIC_API_URL no .env do app.");
  const token = auth ? await getSessionToken() : null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      if (
        response.status === 401 &&
        auth &&
        (await getSessionToken()) === token
      ) {
        await clearSessionToken();
        onExpired();
      }
      const error = new Error(
        data?.error?.message || "Não foi possível concluir a operação.",
      );
      error.status = response.status;
      error.fields = data?.error?.fields;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("A API demorou para responder. Confira a conexão.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
async function authenticate(path, input) {
  const session = await apiRequest(path, {
    method: "POST",
    body: input,
    auth: false,
  });
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  return session.user;
}
export const register = (input) => authenticate("/api/auth/register", input);
export const login = (email, password) =>
  authenticate("/api/auth/login", { email, password });
export async function logout() {
  // Só apague a sessão local após confirmar a revogação na API.
  // Se offline, mostre o erro e permita tentar novamente.
  await apiRequest("/api/auth/logout", { method: "POST" });
  await clearSessionToken();
}
export async function getAll(path) {
  const items = [];
  let offset = 0;
  do {
    const data = await apiRequest(
      `${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`,
    );
    items.push(...data.items);
    if (!data.hasMore) return items;
    offset = data.nextOffset;
  } while (true);
}
export async function loadAppData() {
  const { user } = await apiRequest("/api/auth/me");
  const [points, requests, favorites, notifications] = await Promise.all([
    getAll("/api/points"),
    getAll("/api/requests"),
    getAll("/api/favorites"),
    getAll("/api/notifications"),
  ]);
  const available =
    user.role === "driver" ? await getAll("/api/requests/available") : [];
  return {
    user,
    points,
    requests: [...requests, ...available],
    favorites,
    notifications,
  };
}
export const updateUser = async (input) =>
  (await apiRequest("/api/users/me", { method: "PATCH", body: input })).user;
export const createRequest = async (input) =>
  (await apiRequest("/api/requests", { method: "POST", body: input })).request;
export const savePoint = async (input, id) =>
  (
    await apiRequest(id ? `/api/points/${id}` : "/api/points", {
      method: id ? "PATCH" : "POST",
      body: input,
    })
  ).point;
export const setFavorite = (id, active) =>
  apiRequest(`/api/favorites/${id}`, { method: active ? "PUT" : "DELETE" });
export const markNotificationsRead = () =>
  apiRequest("/api/notifications/read-all", { method: "PATCH" });
export const acceptRequest = async (id) =>
  (await apiRequest(`/api/requests/${id}/accept`, { method: "POST" })).request;
export const cancelRequest = async (id) =>
  (await apiRequest(`/api/requests/${id}/cancel`, { method: "POST" })).request;
export const pickupRequest = async (id) =>
  (await apiRequest(`/api/requests/${id}/pickup`, { method: "POST" })).request;
export const deliverRequest = async (id) =>
  (await apiRequest(`/api/requests/${id}/deliver`, { method: "POST" })).request;
export const receiveRequest = async (id) =>
  (await apiRequest(`/api/requests/${id}/receive`, { method: "POST" })).request;
