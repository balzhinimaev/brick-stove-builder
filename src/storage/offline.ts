import type { ReadyProject } from "../domain/types";

/**
 * Офлайн-слой для сохранённых проектов: локальный кэш списка + очередь
 * несинхронизированных операций. Работает в вебе и в Android-приложении:
 * без сети проекты сохраняются локально, при появлении сети очередь
 * выталкивается на сервер (см. useSavedProjects).
 */
export type PendingOp =
  | { kind: "create"; project: ReadyProject; queuedAt: number }
  | { kind: "update"; id: string; project: ReadyProject; queuedAt: number }
  | { kind: "delete"; id: string; queuedAt: number };

const cacheKey = (login: string) => `brick-stove-projects-cache:${login || "anon"}`;
const pendingKey = (login: string) => `brick-stove-pending-ops:${login || "anon"}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadProjectsCache(login: string): ReadyProject[] {
  return readJson<ReadyProject[]>(cacheKey(login), []);
}

export function saveProjectsCache(login: string, projects: ReadyProject[]): void {
  try {
    localStorage.setItem(cacheKey(login), JSON.stringify(projects));
  } catch {
    /* переполнение хранилища не должно ломать редактор */
  }
}

export function loadPendingOps(login: string): PendingOp[] {
  return readJson<PendingOp[]>(pendingKey(login), []);
}

export function savePendingOps(login: string, ops: PendingOp[]): void {
  try {
    localStorage.setItem(pendingKey(login), JSON.stringify(ops));
  } catch {
    /* при переполнении очередь живёт только в памяти — но не роняем сохранение */
  }
}

export function enqueuePendingOp(login: string, op: PendingOp): PendingOp[] {
  const ops = [...loadPendingOps(login), op];
  savePendingOps(login, ops);
  return ops;
}

/** Транспорт очереди — подменяется в тестах фейком. */
export type FlushExecutor = {
  create: (project: ReadyProject) => Promise<ReadyProject>;
  update: (id: string, project: ReadyProject) => Promise<ReadyProject>;
  remove: (id: string) => Promise<void>;
  /** Ошибка постоянная (404/400…): ретрай бессмысленен, операция выбрасывается. */
  isPermanent: (error: unknown) => boolean;
  /** 401: токен недействителен — очередь замирает до перелогина. */
  isAuth: (error: unknown) => boolean;
};

export type FlushResult = {
  /** Невыполненный хвост очереди (порядок сохранён). */
  remaining: PendingOp[];
  /** Временный id офлайн-созданного проекта → серверный id. */
  idMap: Record<string, string>;
  authFailed: boolean;
};

/**
 * Прокачка очереди. Правила:
 * - операции выполняются строго по порядку;
 * - транзиентная ошибка (сеть/5xx/429) прерывает прокачку — упавшая операция
 *   и ВСЁ после неё остаются в очереди (иначе старый update перегонит новый);
 * - постоянная ошибка (404/400) выбрасывает только эту операцию: повтор
 *   не поможет, а операция-отрава навсегда заблокировала бы очередь;
 * - 401 останавливает всё до перелогина.
 * Чистая функция от (ops, executor) — покрыта юнит-тестами.
 */
export async function flushOps(ops: PendingOp[], exec: FlushExecutor): Promise<FlushResult> {
  const idMap: Record<string, string> = {};
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    try {
      if (op.kind === "create") {
        const saved = await exec.create(op.project);
        if (saved.id !== op.project.id) idMap[op.project.id] = saved.id;
      } else if (op.kind === "update") {
        const id = idMap[op.id] ?? op.id;
        await exec.update(id, { ...op.project, id });
      } else {
        await exec.remove(idMap[op.id] ?? op.id);
      }
    } catch (error) {
      if (exec.isAuth(error)) return { remaining: ops.slice(i), idMap, authFailed: true };
      if (exec.isPermanent(error)) continue;
      return { remaining: ops.slice(i), idMap, authFailed: false };
    }
  }
  return { remaining: [], idMap, authFailed: false };
}
