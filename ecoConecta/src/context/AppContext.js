import { Feedback } from "../utils/feedback";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEMO_USER, INITIAL_POINTS, INITIAL_REQUESTS } from "../data/mock";
import { acceptsMaterials, canAdvance } from "../utils/domain";

const AppContext = createContext(null);
const KEY = "@ecoconecta/frontend/v1";
const defaults = () => ({
  user: null,
  points: INITIAL_POINTS,
  requests: INITIAL_REQUESTS,
  favorites: [],
  notifications: [],
});

export function AppProvider({ children }) {
  const [state, setState] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw || !alive) return;
        const data = JSON.parse(raw);
        if (
          !Array.isArray(data.points) ||
          !Array.isArray(data.requests) ||
          !Array.isArray(data.favorites) ||
          !Array.isArray(data.notifications)
        )
          throw new Error("Dados inválidos");
        setState(data);
      })
      .catch(() => {
        if (alive)
          Feedback.alert(
            "Dados locais",
            "Não foi possível carregar os dados. O app abriu com os exemplos iniciais.",
          );
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const snapshot = JSON.stringify(state);
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(KEY, snapshot))
      .then(() => setStorageError(false))
      .catch(() => setStorageError(true));
  }, [state, ready]);

  function notify(current, title, body) {
    return [
      { id: `${Date.now()}-${Math.random()}`, title, body, read: false },
      ...current,
    ].slice(0, 50);
  }
  function login(profile) {
    setState((s) => ({ ...s, user: profile }));
  }
  function demo() {
    login({ ...DEMO_USER });
  }
  function logout() {
    setState((s) => ({ ...s, user: null }));
  }
  function updateUser(values) {
    setState((s) => ({ ...s, user: { ...s.user, ...values } }));
  }
  function favorite(id) {
    setState((s) => ({
      ...s,
      favorites: s.favorites.includes(id)
        ? s.favorites.filter((item) => item !== id)
        : [...s.favorites, id],
    }));
  }
  function addRequest(values) {
    const id = `EC-${Date.now()}`;
    setState((s) => {
      const point = s.points.find((p) => p.id === values.pointId);
      if (!s.user || !point || !acceptsMaterials(point, values.materials))
        return s;
      return {
        ...s,
        requests: [
          {
            ...values,
            id,
            residentId: s.user.id,
            residentName: s.user.name,
            status: 0,
            driverId: null,
            driverName: null,
            createdAt: new Date().toISOString(),
          },
          ...s.requests,
        ],
        notifications: notify(
          s.notifications,
          "Coleta solicitada!",
          "Seu pedido está disponível para um motorista parceiro.",
        ),
      };
    });
    return id;
  }
  function cancelRequest(id) {
    setState((s) => ({
      ...s,
      requests: s.requests.map((r) =>
        r.id === id && r.residentId === s.user?.id && r.status === 0
          ? { ...r, cancelled: true }
          : r,
      ),
    }));
  }
  function acceptRequest(id) {
    setState((s) => {
      const request = s.requests.find((r) => r.id === id);
      if (
        s.user?.role !== "driver" ||
        s.user.online === false ||
        !request ||
        request.status !== 0 ||
        request.cancelled
      )
        return s;
      return {
        ...s,
        requests: s.requests.map((r) =>
          r.id === id && r.status === 0 && !r.cancelled
            ? { ...r, status: 1, driverId: s.user.id, driverName: s.user.name }
            : r,
        ),
        notifications: notify(
          s.notifications,
          "Motorista atribuído",
          "Uma coleta recebeu um motorista parceiro.",
        ),
      };
    });
  }
  function advanceRequest(id) {
    setState((s) => {
      const request = s.requests.find((r) => r.id === id);
      const owned = s.points
        .filter(
          (p) =>
            p.owner === s.user?.id ||
            (s.user?.id === "demo" && p.owner === "demo-point"),
        )
        .map((p) => p.id);
      if (!request || !canAdvance(request, s.user?.role, s.user?.id, owned))
        return s;
      return {
        ...s,
        requests: s.requests.map((r) =>
          r.id === id ? { ...r, status: r.status + 1 } : r,
        ),
        notifications: notify(
          s.notifications,
          "Coleta atualizada",
          request.status === 3
            ? "Recebimento confirmado. Material com novo destino!"
            : "O pedido avançou para a próxima etapa.",
        ),
      };
    });
  }
  function savePoint(values, id) {
    const pointId = id || `P-${Date.now()}`;
    setState((s) => {
      if (s.user?.role !== "point") return s;
      const existing = s.points.find((p) => p.id === id);
      if (
        existing &&
        existing.owner !== s.user.id &&
        !(s.user.id === "demo" && existing.owner === "demo-point")
      )
        return s;
      const point = {
        ...values,
        id: pointId,
        owner: existing?.owner || s.user.id,
        icon: "business-outline",
      };
      return {
        ...s,
        points: id
          ? s.points.map((p) => (p.id === id ? point : p))
          : [point, ...s.points],
      };
    });
    return pointId;
  }
  function markRead() {
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
  }
  function reset() {
    setState({ ...defaults(), user: { ...DEMO_USER } });
  }
  const ownedPoints = state.points.filter(
    (p) =>
      p.owner === state.user?.id ||
      (state.user?.id === "demo" && p.owner === "demo-point"),
  );
  return (
    <AppContext.Provider
      value={{
        ...state,
        ready,
        storageError,
        ownedPoints,
        login,
        demo,
        logout,
        updateUser,
        favorite,
        addRequest,
        cancelRequest,
        acceptRequest,
        advanceRequest,
        savePoint,
        markRead,
        reset,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  return useContext(AppContext);
}
