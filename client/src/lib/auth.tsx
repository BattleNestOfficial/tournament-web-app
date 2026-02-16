import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("bn_token");
    const savedUser = localStorage.getItem("bn_user");
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("bn_token");
        localStorage.removeItem("bn_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("bn_token", newToken);
    localStorage.setItem("bn_user", JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("bn_token");
    localStorage.removeItem("bn_user");
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem("bn_user", JSON.stringify(updatedUser));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export function authFetch(token: string | null) {
  return async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (options.body && typeof options.body === "string") {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(url, { ...options, headers });
    return res;
  };
}
