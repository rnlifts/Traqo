import client from "./client";

export interface RegisterRequest {
  display_name: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  username: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    username: string;
    display_name: string;
  };
}

export const authApi = {
  async register(displayName: string, password: string): Promise<RegisterResponse> {
    const response = await client.post<RegisterResponse>("/auth/register", {
      display_name: displayName,
      password,
    });
    return response.data;
  },

  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await client.post<LoginResponse>("/auth/login", {
      username,
      password,
    });
    return response.data;
  },
};
