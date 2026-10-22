const ACCESS_KEY = "tefu.client.access";
const REFRESH_KEY = "tefu.client.refresh";

export type ApiResult<T> = { success: boolean; message: string; data: T; code?: string };

function apiRoot() {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
  if (fromEnv) return `${fromEnv}/api/v1`;
  if (typeof window !== "undefined" && /(^|\.)tefuinvestment\.com$/i.test(window.location.hostname)) {
    return "https://api.tefuinvestment.com/api/v1";
  }
  return "/api/v1";
}

export function saveApiTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearApiTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function hasApiSession() {
  return Boolean(localStorage.getItem(ACCESS_KEY));
}

export function newIdempotencyKey() {
  return crypto.randomUUID();
}

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parse<T>(response: Response): Promise<ApiResult<T>> {
  const body = (await response.json().catch(() => null)) as ApiResult<T> | null;
  if (!response.ok || !body?.success) {
    throw new ApiError(body?.message || "Request failed.", response.status, body?.code);
  }
  return body;
}

export async function api<T>(path: string, init?: RequestInit & { idempotencyKey?: string; auth?: boolean }): Promise<ApiResult<T>> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
  if (init?.idempotencyKey) headers.set("Idempotency-Key", init.idempotencyKey);
  const auth = init?.auth !== false;
  const token = localStorage.getItem(ACCESS_KEY);
  if (auth && token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiRoot()}${path}`, { ...init, headers });
  if (response.status === 401 && auth && localStorage.getItem(REFRESH_KEY)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${localStorage.getItem(ACCESS_KEY)}`);
      return parse<T>(await fetch(`${apiRoot()}${path}`, { ...init, headers }));
    }
  }
  return parse<T>(response);
}

async function refreshSession() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const result = await api<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ refreshToken }),
    });
    saveApiTokens(result.data.accessToken, result.data.refreshToken);
    return true;
  } catch {
    clearApiTokens();
    return false;
  }
}

export type Checkout = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  publicKey: string | null;
};

export type Tokens = { accessToken: string; refreshToken: string };
