import React, { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import client from "../../api/client";

export interface CurrentUser {
  username: string;
  display_name: string;
}

interface AuthContextType {
  token: string | null;
  currentUser: CurrentUser | null;
  login: (token: string, user: CurrentUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("auth_token");
    const savedUser = localStorage.getItem("current_user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      setCurrentUser(JSON.parse(savedUser));
      // Set Authorization header for axios
      client.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, user: CurrentUser) => {
    setToken(newToken);
    setCurrentUser(user);
    localStorage.setItem("auth_token", newToken);
    localStorage.setItem("current_user", JSON.stringify(user));
    client.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
  };

  const logout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("current_user");
    delete client.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        currentUser,
        login,
        logout,
        isAuthenticated: !!token,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
