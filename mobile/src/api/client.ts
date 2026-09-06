import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../config/env";
import { TOKEN_STORAGE_KEY } from "../config/constants";

type Method = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | undefined>;
}

// Thrown for any non-2xx response. Callers can `instanceof ApiError` and read
// `.status` (e.g. AuthContext logs the user out on 401) and `.detail` (the
// human-readable message from FastAPI's { "detail": ... } body).
export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = API_BASE_URL + path;
  if (!query) return url;

  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);

  return params.length ? `${url}?${params.join("&")}` : url;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false, query } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // 204 No Content, or any empty body — nothing to parse.
  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const detail =
      data && typeof data.detail === "string"
        ? data.detail
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }

  return data as T;
}

export const client = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PUT", body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
