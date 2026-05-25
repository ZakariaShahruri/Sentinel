import { ApiEvent, ApiNode, Game, TiltReading } from "@/types";

const DEFAULT_DEV_API_URL = "http://localhost:8000";
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "development" ? DEFAULT_DEV_API_URL : "");

type AuthUser = {
  id: number;
  username: string;
  role: string;
};

type RequestError = Error & {
  status?: number;
  retryAfter?: number;
};

export type LoginResponse = {
  requires_otp?: boolean;
  email?: string;
  otp_expires_at?: string;
  access_token?: string;
  token_type?: string;
  user?: AuthUser;
};

export type AuthMeResponse = {
  username: string;
  role: string | null;
  user_id: number | null;
};

function buildUrl(path: string): string {
  return BASE_URL ? `${BASE_URL}${path}` : path;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const rawBody = await response.text();
  if (!rawBody) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawBody);
    } catch {
      return rawBody;
    }
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

function getErrorMessage(body: unknown, fallbackMessage: string): string {
  if (typeof body === "string") {
    return body;
  }

  if (body && typeof body === "object") {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }

    const message = (body as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return fallbackMessage;
}

function buildRequestError(
  response: Response,
  body: unknown,
  fallbackMessage: string
): RequestError {
  const error = new Error(getErrorMessage(body, fallbackMessage)) as RequestError;
  error.status = response.status;

  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const parsedRetryAfter = Number(retryAfter);
    if (!Number.isNaN(parsedRetryAfter)) {
      error.retryAfter = parsedRetryAfter;
    }
  }

  return error;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), init);
  const body = await readResponseBody(response);

  if (!response.ok) {
    throw buildRequestError(response, body, `Request failed with status ${response.status}`);
  }

  return body as T;
}

export function getApiBaseUrl(): string {
  return BASE_URL;
}

export async function getNodes(nodeId?: number): Promise<ApiNode[]> {
  const url = nodeId ? `/nodes?node_id=${nodeId}` : "/nodes";
  return requestJson<ApiNode[]>(url);
}

export async function getEvents(params?: { nodeId?: number; limit?: number }): Promise<ApiEvent[]> {
  const query = new URLSearchParams();
  if (params?.nodeId) query.set("node_id", String(params.nodeId));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return requestJson<ApiEvent[]>(`/events${qs ? `?${qs}` : ""}`);
}

export async function getEventById(id: number): Promise<ApiEvent> {
  return requestJson<ApiEvent>(`/events/${id}`);
}

// ── Auth functions use relative URLs so the Next.js proxy handles them ──

export async function getMe(token?: string): Promise<AuthMeResponse> {
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch("/auth/me", {
    headers,
    credentials: "include",
  });
  const body = await readResponseBody(response);
  if (!response.ok) throw buildRequestError(response, body, `Request failed with status ${response.status}`);
  return body as AuthMeResponse;
}

export async function loginUser(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
    credentials: "include",
  });
  const body = await readResponseBody(response);
  if (!response.ok) throw buildRequestError(response, body, `Request failed with status ${response.status}`);
  return body as LoginResponse;
}

export async function verifyOtp(email: string, otp: string): Promise<LoginResponse> {
  const response = await fetch("/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
    credentials: "include",
  });
  const body = await readResponseBody(response);
  if (!response.ok) throw buildRequestError(response, body, `Request failed with status ${response.status}`);
  return body as LoginResponse;
}

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<void> {
  const response = await fetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  const body = await readResponseBody(response);
  if (!response.ok) throw buildRequestError(response, body, `Request failed with status ${response.status}`);
}

// ── Other API functions use buildUrl (BASE_URL) as before ──

export async function getGames(token?: string, gameId?: number): Promise<Game[]> {
  const url = gameId != null ? `/games?game_id=${gameId}` : "/games";
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  return requestJson<Game[]>(url, { headers, credentials: "include" });
}

export async function createGame(): Promise<Game> {
  return requestJson<Game>("/games", {
    method: "POST",
    credentials: "include",
  });
}

export async function changeGameStatus(gameId: number, endReason: string): Promise<Game> {
  return requestJson<Game>("/games", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game_id: gameId, end_reason: endReason }),
    credentials: "include",
  });
}

export async function getTilts(gameId?: number): Promise<TiltReading[]> {
  const url = gameId != null ? `${BASE_URL}/tilts?game_id=${gameId}` : `${BASE_URL}/tilts`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch tilts: ${res.status}`);
  return res.json();
}

export async function analyzeGame(gameId: number, onChunk: (chunk: string) => void): Promise<void> {
  const res = await fetch(`${BASE_URL}/game_summaries/${gameId}/analysis`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Analysis failed ${res.status}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;
      try {
        onChunk(JSON.parse(data));
      } catch {
        /* skip partial lines */
      }
    }
  }
}
