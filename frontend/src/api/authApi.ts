import client from "./client";

export interface RegisterRequest {
  display_name: string;
  username: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  username: string;
}

export interface CheckUsernameResponse {
  available: boolean;
  reason?: string;
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

export interface BodyMetrics {
  bmi: number;
  bmr: number;
  maintenance_calories: number;
}

export interface UserProfile {
  username: string;
  display_name: string;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  gender: string | null;
  activity_level: string | null;
  is_complete: boolean;
  body_metrics: BodyMetrics | null;
}

export interface UpdateProfileRequest {
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  gender: string | null;
  activity_level: string | null;
}

export const authApi = {
  async register(displayName: string, username: string, password: string): Promise<RegisterResponse> {
    const response = await client.post<RegisterResponse>("/auth/register", {
      display_name: displayName,
      username,
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

  async checkUsernameAvailability(username: string): Promise<CheckUsernameResponse> {
    const response = await client.get<CheckUsernameResponse>("/auth/check-username", {
      params: { username },
    });
    return response.data;
  },

  async getMe(): Promise<UserProfile> {
    const response = await client.get<UserProfile>("/auth/me");
    return response.data;
  },

  async updateProfile(req: UpdateProfileRequest): Promise<UserProfile> {
    const response = await client.put<UserProfile>("/auth/profile", req);
    return response.data;
  },
};
