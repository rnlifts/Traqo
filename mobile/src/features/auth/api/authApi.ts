import { client } from "../../../api/client";
import type {
  CheckUsernameResponse,
  LoginResponse,
  RegisterResponse,
  UserProfile,
} from "../types";

// One function per auth endpoint. These only shape requests/responses —
// they never store tokens or touch UI (that's AuthContext's job).
export const authApi = {
  
  register(displayName: string, username: string, password: string) {
    return client.post<RegisterResponse>("/auth/register", {
      display_name: displayName,
      username,
      password,
    });
  },

  login(username: string, password: string) {
    return client.post<LoginResponse>("/auth/login", { username, password });
  },

  checkUsername(username: string) {
    return client.get<CheckUsernameResponse>("/auth/check-username", {
      query: { username },
    });
  },

  getMe() {
    return client.get<UserProfile>("/auth/me", { auth: true });
  },
};
