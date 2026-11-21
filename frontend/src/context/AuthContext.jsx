import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearSession, message } from "../lib/api";
const AuthContext = createContext();
// Context and hook intentionally share this module.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
function storedUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    localStorage.getItem("access_token"),
  );
  const [user, setUser] = useState(storedUser);
  const navigate = useNavigate();
  useEffect(() => {
    const expire = () => {
      setToken(null);
      setUser(null);
      navigate("/login", { replace: true });
    };
    const refreshed = () => setToken(localStorage.getItem("access_token"));
    const synced = () => {
      refreshed();
      setUser(storedUser());
    };
    window.addEventListener("session-expired", expire);
    window.addEventListener("session-refreshed", refreshed);
    window.addEventListener("storage", synced);
    return () => {
      window.removeEventListener("session-expired", expire);
      window.removeEventListener("session-refreshed", refreshed);
      window.removeEventListener("storage", synced);
    };
  }, [navigate]);
  async function login(email, password) {
    try {
      const { data } = await api.post("/login", { email, password });
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      localStorage.setItem("user", JSON.stringify(data.user));
      setToken(data.access);
      setUser(data.user);
      navigate("/", { replace: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: message(error) };
    }
  }
  async function register(full_name, email, password, confirm_password) {
    try {
      await api.post("/register", {
        full_name,
        email,
        password,
        confirm_password,
      });
      return await login(email, password);
    } catch (error) {
      return { success: false, error: message(error) };
    }
  }
  return (
    <AuthContext.Provider
      value={{ token, user, login, register, logout: clearSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}
