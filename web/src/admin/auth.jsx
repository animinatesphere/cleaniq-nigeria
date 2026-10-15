// Admin login state + a fetch helper that sends the admin token and logs out on 401.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError } from "../lib/api";

const KEY = "cleaniq-ng-admin";
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
// npm run demo → the admin runs on sample data in the browser (no API). Never on in a normal build.
export const DEMO = import.meta.env.VITE_ADMIN_DEMO === "1";
const AuthContext = createContext(null);

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStored); // { token, admin }

  const save = useCallback((s) => {
    setSession(s);
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => save(null), [save]);

  const request = useCallback(
    async (path, { method = "GET", body, signal } = {}) => {
      if (DEMO) return (await import("./demo/mock.js")).mockRequest(path, { method, body });
      let res;
      try {
        res = await fetch(`${BASE}/api${path}`, {
          method,
          signal,
          headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (e) {
        if (e.name === "AbortError") throw e;
        throw new ApiError("Can't reach the server. Check your connection.", 0);
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && session?.token && !path.startsWith("/auth/admin/login")) logout();
      if (!res.ok) throw new ApiError(data.error || "Something went wrong", res.status, data.details);
      return data;
    },
    [session?.token, logout],
  );

  const login = useCallback(
    async (email, password) => {
      const r = await request("/auth/admin/login", { method: "POST", body: { email, password } });
      save({ token: r.token, admin: r.admin });
      return r.admin;
    },
    [request, save],
  );

  // Refresh who we are (role changes, deactivation) when the admin opens.
  useEffect(() => {
    if (!session?.token) return;
    request("/auth/admin/me")
      .then((r) => save({ token: session.token, admin: r.admin }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      admin: session?.admin || null,
      request,
      login,
      logout,
      setAdmin: (admin) => save({ token: session.token, admin }),
      can: (...roles) => Boolean(session?.admin && roles.includes(session.admin.role)),
    }),
    [session, request, login, logout, save],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Loads data for a page: { data, error, loading, reload }.
export function useLoad(path, deps = []) {
  const { request } = useAuth();
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    request(path, { signal: ctrl.signal })
      .then((data) => setState({ data, error: "", loading: false }))
      .catch((e) => e.name !== "AbortError" && setState({ data: null, error: e.message, loading: false }));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  return { ...state, reload: () => setTick((n) => n + 1) };
}
