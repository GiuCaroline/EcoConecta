import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { api } from "../services/api";
const AppContext = createContext(null);
const empty = () => ({
  user: null,
  points: [],
  requests: [],
  favorites: [],
  notifications: [],
});
export function AppProvider({ children }) {
  const [state, setState] = useState(empty);
  const current = useRef(state);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const revision = useRef(0);
  const inFlight = useRef(null);
  const locks = useRef(new Set());
  const alive = useRef(true);
  const publish = useCallback((value) => {
    current.current =
      typeof value === "function" ? value(current.current) : value;
    if (alive.current) setState(current.current);
  }, []);
  const expire = useCallback(() => {
    generation.current++;
    revision.current++;
    inFlight.current = null;
    publish(empty());
    setSyncError("");
    setBootError("");
  }, [publish]);
  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const session = generation.current,
      version = revision.current;
    setRefreshing(true);
    const pending = (async () => {
      try {
        const data = await api.loadAppData();
        if (
          alive.current &&
          session === generation.current &&
          version === revision.current
        ) {
          publish(data);
          setSyncError("");
        }
        return data;
      } catch (error) {
        if (
          alive.current &&
          session === generation.current &&
          error.status !== 401
        )
          setSyncError(error.message);
        throw error;
      } finally {
        if (inFlight.current === pending) {
          inFlight.current = null;
          if (alive.current) setRefreshing(false);
        }
      }
    })();
    inFlight.current = pending;
    return pending;
  }, [publish]);
  const initialize = useCallback(async () => {
    try {
      if (await api.getSessionToken()) await refresh();
    } catch (error) {
      if (error.status !== 401 && alive.current) setBootError(error.message);
    } finally {
      if (alive.current) setReady(true);
    }
  }, [refresh]);
  useEffect(() => {
    alive.current = true;
    api.setSessionExpiredHandler(expire);
    initialize();
    return () => {
      alive.current = false;
      api.setSessionExpiredHandler(() => {});
    };
  }, [expire, initialize]);
  const userId = state.user?.id;
  useEffect(() => {
    if (!userId) return;
    const sync = () => {
      if (AppState.currentState === "active" || AppState.currentState == null)
        refresh().catch(() => {});
    };
    const timer = setInterval(sync, 20000);
    const subscription = AppState.addEventListener("change", (value) => {
      if (value === "active") sync();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [userId, refresh]);
  async function authenticate(action) {
    generation.current++;
    revision.current++;
    inFlight.current = null;
    const session = generation.current;
    publish(empty());
    setSyncError("");
    const user = await action();
    if (session !== generation.current) return;
    // O login já foi confirmado. Uma falha ao carregar listas não cria uma conta fictícia.
    publish({ ...empty(), user });
    await refresh().catch(() => {});
  }
  const login = (email, password) =>
    authenticate(() => api.login(email, password));
  const registerAccount = (input) => authenticate(() => api.register(input));
  async function logout() {
    await api.logout();
    expire();
  }
  async function mutate(key, action, apply) {
    if (!current.current.user) throw new Error("Entre na sua conta.");
    if (locks.current.has(key))
      throw new Error("Esta operação já está em andamento.");
    locks.current.add(key);
    const session = generation.current;
    inFlight.current = null;
    revision.current++; // Descarta qualquer leitura que começou antes desta gravação.
    try {
      const result = await action();
      if (session !== generation.current) return result;
      revision.current++;
      inFlight.current = null;
      publish((s) => apply(s, result));
      refresh().catch(() => {});
      return result;
    } catch (error) {
      if (session === generation.current && [404, 409].includes(error.status))
        refresh().catch(() => {});
      throw error;
    } finally {
      locks.current.delete(key);
    }
  }
  const storeRequest = (s, r) => ({
    ...s,
    requests: [r, ...s.requests.filter((item) => item.id !== r.id)],
  });
  async function updateUser(values) {
    const user = current.current.user;
    const allowed = [
      "name",
      "phone",
      "address",
      ...(user?.role === "driver" ? ["vehicle", "plate", "online"] : []),
    ];
    if (Object.keys(values).some((key) => !allowed.includes(key)))
      throw new Error("O perfil da conta não pode ser alterado nesta sessão.");
    return mutate(
      "profile",
      () => api.updateUser(values),
      (s, saved) => ({ ...s, user: saved }),
    );
  }
  async function favorite(id) {
    const active = !current.current.favorites.includes(id);
    return mutate(
      `favorite-${id}`,
      () => api.setFavorite(id, active),
      (s) => ({
        ...s,
        favorites: active
          ? [...new Set([...s.favorites, id])]
          : s.favorites.filter((item) => item !== id),
      }),
    );
  }
  async function addRequest(values) {
    const saved = await mutate(
      "create-request",
      () => api.createRequest(values),
      storeRequest,
    );
    return saved.id;
  }
  const cancelRequest = (id) =>
    mutate(`request-${id}`, () => api.cancelRequest(id), storeRequest);
  const acceptRequest = (id) =>
    mutate(`request-${id}`, () => api.acceptRequest(id), storeRequest);
  async function advanceRequest(id) {
    const { user, requests } = current.current;
    const request = requests.find((r) => r.id === id);
    let action;
    if (user.role === "driver" && request?.status === 1)
      action = api.pickupRequest;
    else if (user.role === "driver" && request?.status === 2)
      action = api.deliverRequest;
    else if (user.role === "point" && request?.status === 3)
      action = api.receiveRequest;
    else throw new Error("Esta etapa não está disponível. Atualize os dados.");
    return mutate(`request-${id}`, () => action(id), storeRequest);
  }
  async function savePoint(values, id) {
    const input = Object.fromEntries(
      [
        "name",
        "address",
        "phone",
        "hours",
        "description",
        "materials",
        "active",
      ].map((key) => [key, values[key]]),
    );
    const saved = await mutate(
      `point-${id || "new"}`,
      () => api.savePoint(input, id),
      (s, p) => ({
        ...s,
        points: [p, ...s.points.filter((item) => item.id !== p.id)],
      }),
    );
    return saved.id;
  }
  const markRead = () =>
    mutate("notifications", api.markNotificationsRead, (s) => ({
      ...s,
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
  const ownedPoints = state.points.filter((p) => p.owner === state.user?.id);
  return (
    <AppContext.Provider
      value={{
        ...state,
        ready,
        bootError,
        syncError,
        refreshing,
        ownedPoints,
        refresh,
        retryInitialize: () => {
          setReady(false);
          setBootError("");
          initialize();
        },
        login,
        registerAccount,
        logout,
        updateUser,
        favorite,
        addRequest,
        cancelRequest,
        acceptRequest,
        advanceRequest,
        savePoint,
        markRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  return useContext(AppContext);
}
