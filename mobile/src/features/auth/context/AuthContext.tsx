import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { TOKEN_STORAGE_KEY } from "../../../config/constants";
import { ApiError } from "../../../api/client";
import { authApi } from "../api/authApi";
import type { AuthUser } from "../types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  // Called by Login/Register screens after a successful POST /auth/login.
  signIn: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  // On startup: if a token is stored, validate it against /auth/me.
  // Valid -> authenticated; missing or rejected -> unauthenticated.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
      if (!token) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }

      try {
        const profile = await authApi.getMe();
        if (cancelled) return;
        setUser({ username: profile.username, display_name: profile.display_name });
        setStatus("authenticated");
      } catch (err) {
        if (cancelled) return;
        // 401 = expired/invalid token. Any other error (network, 500) we also
        // treat as "not logged in" for now — the user can retry from the login screen.
        if (err instanceof ApiError && err.status === 401) {
          await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
        }
        setStatus("unauthenticated");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (token: string, nextUser: AuthUser) => {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
