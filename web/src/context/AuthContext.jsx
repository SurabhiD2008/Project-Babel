import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { API } from "../lib/api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => API.currentUser());
  const refresh = useCallback(() => setUser(API.currentUser()), []);
  // A remembered profile is shown at once, then checked against the server.
  useEffect(() => { API.restoreSession().then(refresh); }, [refresh]);
  const login = useCallback(async (e, p) => { const r = await API.login(e, p); refresh(); return r; }, [refresh]);
  const register = useCallback(async (e, p, n) => { const r = await API.register(e, p, n); refresh(); return r; }, [refresh]);
  const logout = useCallback(() => { API.logout(); refresh(); }, [refresh]);
  return <AuthCtx.Provider value={{ user, login, register, logout, refresh }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
