// Shapes mirror the backend auth contract:
//   backend/src/modules/auth/presentation/schemas.py + routes.py

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

export interface AuthUser {
  username: string;
  display_name: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface BodyMetrics {
  bmi: number;
  bmr: number;
  maintenance_calories: number;
}

// GET /auth/me — the full profile. Used on startup to validate a stored token.
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

// Client-side validation rules — must match the backend pattern
// ^[a-z][a-z0-9_]{2,19}$ and the 8..128 password length.
export const USERNAME_REGEX = /^[a-z][a-z0-9_]{2,19}$/;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
