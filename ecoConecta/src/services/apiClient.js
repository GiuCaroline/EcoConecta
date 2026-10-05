// Cliente independente de React: mesma implementação no app e nos testes HTTP.
export function createApiClient({
  baseUrl,
  storage,
  fetcher = fetch,
  timeoutMs = 20000,
}) {
  let onExpired = () => {};
  const getSessionToken = () => storage.get();
  const clearSessionToken = () => storage.clear();
  async function apiRequest(path, { method = "GET", body, auth = true } = {}) {
    const url = baseUrl?.replace(/\/$/, "");
    if (!url)
      throw new Error(
        "Configure EXPO_PUBLIC_API_URL no .env do aplicativo e reinicie o Expo.",
      );
    const token = auth ? await getSessionToken() : null;
    if (auth && !token) throw new Error("Entre na sua conta para continuar.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`${url}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data =
        response.status === 204
          ? null
          : await response.json().catch(() => null);
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
          data?.error?.message ||
            `A API retornou erro ${response.status}. Tente novamente.`,
        );
        error.status = response.status;
        error.fields = data?.error?.fields;
        throw error;
      }
      if (response.status !== 204 && !data)
        throw new Error(
          "Resposta inválida da API. Confira EXPO_PUBLIC_API_URL.",
        );
      return data;
    } catch (error) {
      if (error.name === "AbortError")
        throw new Error(
          "A API demorou para responder. Confira sua conexão e tente novamente.",
        );
      if (error instanceof TypeError)
        throw new Error(
          "Não foi possível conectar à API. Confira o IP/URL no .env, a rede Wi-Fi e a porta 3000.",
        );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async function authenticate(path, input) {
    const session = await apiRequest(path, {
      method: "POST",
      body: input,
      auth: false,
    });
    try {
      await storage.set(session.token);
    } catch {
      // Revoga a sessão que não pôde ser armazenada no aparelho.
      await fetcher(`${baseUrl.replace(/\/$/, "")}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      }).catch(() => {});
      throw new Error(
        "Não foi possível guardar sua sessão neste aparelho. Tente novamente.",
      );
    }
    return session.user;
  }
  async function logout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    await clearSessionToken();
  }
  async function getAll(path) {
    const items = [];
    let offset = 0;
    for (;;) {
      const data = await apiRequest(
        `${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`,
      );
      items.push(...data.items);
      if (!data.hasMore) return items;
      if (!Number.isInteger(data.nextOffset) || data.nextOffset <= offset)
        throw new Error("Paginação inválida da API.");
      offset = data.nextOffset;
    }
  }
  async function loadAppData() {
    const { user } = await apiRequest("/api/auth/me");
    const [points, assigned, favorites, notifications, available] =
      await Promise.all([
        getAll("/api/points"),
        getAll("/api/requests"),
        getAll("/api/favorites"),
        getAll("/api/notifications"),
        user.role === "driver" ? getAll("/api/requests/available") : [],
      ]);
    const requests = [
      ...new Map([...available, ...assigned].map((r) => [r.id, r])).values(),
    ];
    return { user, points, requests, favorites, notifications };
  }
  const transition = async (id, action) =>
    (await apiRequest(`/api/requests/${id}/${action}`, { method: "POST" }))
      .request;
  return {
    apiRequest,
    getSessionToken,
    clearSessionToken,
    getAll,
    loadAppData,
    setSessionExpiredHandler: (handler) => {
      onExpired = handler;
    },
    login: (email, password) =>
      authenticate("/api/auth/login", { email, password }),
    register: (input) => authenticate("/api/auth/register", input),
    logout,
    updateUser: async (input) =>
      (await apiRequest("/api/users/me", { method: "PATCH", body: input }))
        .user,
    createRequest: async (input) =>
      (await apiRequest("/api/requests", { method: "POST", body: input }))
        .request,
    savePoint: async (input, id) =>
      (
        await apiRequest(id ? `/api/points/${id}` : "/api/points", {
          method: id ? "PATCH" : "POST",
          body: input,
        })
      ).point,
    setFavorite: (id, active) =>
      apiRequest(`/api/favorites/${id}`, { method: active ? "PUT" : "DELETE" }),
    markNotificationsRead: () =>
      apiRequest("/api/notifications/read-all", { method: "PATCH" }),
    acceptRequest: (id) => transition(id, "accept"),
    cancelRequest: (id) => transition(id, "cancel"),
    pickupRequest: (id) => transition(id, "pickup"),
    deliverRequest: (id) => transition(id, "deliver"),
    receiveRequest: (id) => transition(id, "receive"),
  };
}
