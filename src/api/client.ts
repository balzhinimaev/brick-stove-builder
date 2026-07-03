import type { ReadyProject } from "../domain/types";
import type { LocalDraft } from "../storage/draft";

const TOKEN_KEY = "brick-stove-token";
const LOGIN_KEY = "brick-stove-login";

export type Session = { login: string; token: string };

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
    body: JSON.stringify({ login, password })
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
  const response = await fetch(`${apiBaseUrl()}/projects`, { headers: authHeaders(token) });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.projects) ? data.projects : [];
}

export async function createSavedProject(project: ReadyProject, token: string): Promise<ReadyProject> {
  const response = await fetch(`${apiBaseUrl()}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(project)
  });
  if (!response.ok) throw new Error("Failed to save project");
  const data = await response.json();
  return data.project;
}

export async function updateSavedProject(id: string, project: ReadyProject, token: string): Promise<ReadyProject> {
  const response = await fetch(`${apiBaseUrl()}/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    // slug фиксируем явно, иначе сервер сгенерирует новый и id проекта «уедет»
    body: JSON.stringify({ ...project, slug: id })
  });
  if (!response.ok) throw new Error("Failed to update project");
  return (await response.json()).project;
}

export async function deleteSavedProject(id: string, token: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl()}/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token)
  });
  if (!response.ok) throw new Error("Failed to delete project");
}

export async function fetchRemoteDraft(token: string): Promise<LocalDraft | null> {
  const response = await fetch(`${apiBaseUrl()}/draft`, { headers: authHeaders(token) });
  if (!response.ok) return null;
  const data = await response.json();
  return data.draft ?? null;
}

export async function pushRemoteDraft(draft: LocalDraft, token: string): Promise<boolean> {
  const response = await fetch(`${apiBaseUrl()}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(draft)
  });
  return response.ok;
}

export type PublishFields = { description: string; price: number | null; region: string };

async function projectAction(id: string, action: "publish" | "unpublish", body: object, token: string): Promise<ReadyProject> {
  const response = await fetch(`${apiBaseUrl()}/projects/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Failed to ${action} project`);
  return (await response.json()).project;
}

export function publishProject(id: string, fields: PublishFields, token: string): Promise<ReadyProject> {
  return projectAction(id, "publish", fields, token);
}

export function unpublishProject(id: string, token: string): Promise<ReadyProject> {
  return projectAction(id, "unpublish", {}, token);
}

export async function fetchShowcaseProjects(): Promise<ReadyProject[]> {
  const response = await fetch(`${apiBaseUrl()}/showcase`);
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.projects) ? data.projects : [];
}

export async function submitLead(lead: { name: string; phone: string; comment: string; source: string }): Promise<boolean> {
  const response = await fetch(`${apiBaseUrl()}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead)
  });
  return response.ok;
}
