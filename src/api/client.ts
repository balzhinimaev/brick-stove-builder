import type { ReadyProject } from "../domain/types";
import type { LocalDraft } from "../storage/draft";

const TOKEN_KEY = "brick-stove-token";
const LOGIN_KEY = "brick-stove-login";

export type Session = { login: string; token: string };

const TIMEOUT_MS = 15_000;

/** HTTP-ошибка API; всё остальное (обрыв сети, таймаут) — обычный Error/DOMException. */
export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`API request failed: HTTP ${status}`);
    this.name = "ApiError";
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * Постоянный отказ: повторять запрос с теми же данными бессмысленно
 * (в отличие от сети/5xx/429, которые лечатся ретраем).
 */
export function isPermanentError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${apiBaseUrl()}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS), ...init });
  if (!response.ok) throw new ApiError(response.status);
  return response;
}

export function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined;
  if (configured) return configured.replace(/\/$/, "");
  if (window.location.pathname.startsWith("/brick-stove-builder")) return "/brick-stove-builder/api";
  return "/api";
}

export function normalizeLogin(value: string): string {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

export function loadSession(): Session | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const login = localStorage.getItem(LOGIN_KEY);
  if (!token || !login) return null;
  return { login, token };
}

export function saveSession(session: Session): void {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(LOGIN_KEY, session.login);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LOGIN_KEY);
}

export type AuthResult = { ok: true; session: Session } | { ok: false; status: number };

async function authRequest(path: "register" | "login", login: string, password: string): Promise<AuthResult> {
  const response = await fetch(`${apiBaseUrl()}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) return { ok: false, status: response.status };
  const data = await response.json();
  if (!data?.token) return { ok: false, status: 500 };
  return { ok: true, session: { login, token: data.token } };
}

export function register(login: string, password: string): Promise<AuthResult> {
  return authRequest("register", login, password);
}

export function login(login: string, password: string): Promise<AuthResult> {
  return authRequest("login", login, password);
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchSavedProjects(token: string): Promise<ReadyProject[]> {
  const response = await apiFetch("/projects", { headers: authHeaders(token) });
  const data = await response.json();
  return Array.isArray(data.projects) ? data.projects : [];
}

export async function createSavedProject(project: ReadyProject, token: string): Promise<ReadyProject> {
  const response = await apiFetch("/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    // Клиентский id уходит как slug: повтор из офлайн-очереди после потерянного
    // ответа сервер узнаёт по нему и не создаёт дубликат.
    body: JSON.stringify({ ...project, slug: project.id })
  });
  const data = await response.json();
  return data.project;
}

export async function updateSavedProject(id: string, project: ReadyProject, token: string): Promise<ReadyProject> {
  const response = await apiFetch(`/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    // slug фиксируем явно, иначе сервер сгенерирует новый и id проекта «уедет»
    body: JSON.stringify({ ...project, slug: id })
  });
  return (await response.json()).project;
}

export async function deleteSavedProject(id: string, token: string): Promise<void> {
  await apiFetch(`/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
}

export async function fetchRemoteDraft(token: string): Promise<LocalDraft | null> {
  const response = await apiFetch("/draft", { headers: authHeaders(token) });
  const data = await response.json();
  return data.draft ?? null;
}

export type DraftPushResult = { stale: false } | { stale: true; draft: LocalDraft | null };

export async function pushRemoteDraft(draft: LocalDraft, token: string): Promise<DraftPushResult> {
  const response = await fetch(`${apiBaseUrl()}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(draft),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  // 409 — на сервере черновик новее (другое устройство); это не ошибка.
  if (response.status === 409) {
    const data = await response.json().catch(() => null);
    return { stale: true, draft: data?.draft ?? null };
  }
  if (!response.ok) throw new ApiError(response.status);
  return { stale: false };
}

export type PublishFields = { description: string; price: number | null; region: string };

async function projectAction(id: string, action: "publish" | "unpublish", body: object, token: string): Promise<ReadyProject> {
  const response = await apiFetch(`/projects/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body)
  });
  return (await response.json()).project;
}

export function publishProject(id: string, fields: PublishFields, token: string): Promise<ReadyProject> {
  return projectAction(id, "publish", fields, token);
}

export function unpublishProject(id: string, token: string): Promise<ReadyProject> {
  return projectAction(id, "unpublish", {}, token);
}

export async function fetchShowcaseProjects(): Promise<ReadyProject[]> {
  const response = await fetch(`${apiBaseUrl()}/showcase`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.projects) ? data.projects : [];
}

export async function submitLead(lead: { name: string; phone: string; comment: string; source: string }): Promise<boolean> {
  const response = await fetch(`${apiBaseUrl()}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  return response.ok;
}
