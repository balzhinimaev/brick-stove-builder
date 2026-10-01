import type { ReadyProject } from "../domain/types";

/**
 * Офлайн-слой для сохранённых проектов: локальный кэш списка + очередь
 * несинхронизированных операций. Работает в вебе и в Android-приложении:
 * без сети проекты сохраняются локально, при появлении сети очередь
 * выталкивается на сервер (см. useSavedProjects).
 */
export type PendingOp = (
  | { kind: "create"; project: ReadyProject; queuedAt: number }
  | { kind: "update"; id: string; project: ReadyProject; queuedAt: number }
  | { kind: "delete"; id: string; queuedAt: number }
) & { rejected?: { status?: number } };

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

const pendingMemory = new Map<string, PendingOp[]>();

export function loadPendingOps(login: string): PendingOp[] {
  return pendingMemory.get(login) ?? readJson<PendingOp[]>(pendingKey(login), []);
}

export function savePendingOps(login: string, ops: PendingOp[], requireDurable = false): boolean {
  try {
    localStorage.setItem(pendingKey(login), JSON.stringify(ops));
    pendingMemory.delete(login);
    return true;
  } catch {
    if (requireDurable) throw new Error("Pending queue storage unavailable");
    pendingMemory.set(login, ops);
    return false;
  }
}

export function enqueuePendingOp(login: string, op: PendingOp): PendingOp[] {
  const ops = [...loadPendingOps(login), op];
  savePendingOps(login, ops, true);
  return ops;
}

/** Транспорт очереди — подменяется в тестах фейком. */
export type FlushExecutor = {
  create: (project: ReadyProject) => Promise<ReadyProject>;
  update: (id: string, project: ReadyProject) => Promise<ReadyProject>;
  remove: (id: string) => Promise<void>;
  /** Permanent failures remain pending for recovery, never silently acknowledged. */
  isPermanent: (error: unknown) => boolean;
  /** 401: токен недействителен — очередь замирает до перелогина. */
  isAuth: (error: unknown) => boolean;
  isNotFound?: (error: unknown) => boolean;
};

export type FlushResult = {
  /** Невыполненный хвост очереди (порядок сохранён). */
  remaining: PendingOp[];
  /** Временный id офлайн-созданного проекта → серверный id. */
  idMap: Record<string, string>;
  authFailed: boolean;
  permanentFailure?: boolean;
  retryable?: boolean;
};

/**
 * Прокачка очереди. Правила:
 * - операции выполняются строго по порядку;
 * - транзиентная ошибка (сеть/5xx/429) прерывает прокачку — упавшая операция
 *   и ВСЁ после неё остаются в очереди (иначе старый update перегонит новый);
 * - permanent failures retain data and block only same-project dependencies; delete 404 is complete;
 * - 401 останавливает всё до перелогина.
 * Чистая функция от (ops, executor) — покрыта юнит-тестами.
 */
export async function flushOps(ops: PendingOp[], exec: FlushExecutor): Promise<FlushResult> {
  const idMap: Record<string, string> = {};
  const remaining: PendingOp[] = [];
  const work = [...ops];
  const key = (op: PendingOp) => (op.kind === "create" ? op.project.id : op.id);
  // Only explicitly rejected writes may be replaced by a later user correction.
  // Enqueue remains append-only, including while a snapshot is in flight.
  for (let i = 0; i < work.length; i++) {
    const failed = work[i];
    if (!failed.rejected) continue;
    let last = i;
    for (let j = i + 1; j < work.length; j++) if (key(work[j]) === key(failed)) last = j;
    if (last === i) continue;
    const correction = work[last];
    const replacement: PendingOp | null =
      correction.kind === "delete"
        ? failed.kind === "create"
          ? null
          : correction
        : failed.kind === "create"
          ? { kind: "create", project: correction.project, queuedAt: correction.queuedAt }
          : correction;
    for (let j = last; j > i; j--) if (key(work[j]) === key(failed)) work.splice(j, 1);
    if (replacement) work[i] = { ...replacement, rejected: undefined };
    else work.splice(i--, 1);
  }
  const blocked = new Set<string>();
  const result = (tail: PendingOp[] = [], authFailed = false): FlushResult => ({
    remaining: remapPendingOps([...remaining, ...tail], idMap),
    idMap,
    authFailed,
    retryable: tail.length > 0 && !authFailed,
    permanentFailure: remaining.some((op) => !!op.rejected)
  });
  for (let i = 0; i < work.length; i++) {
    const op = work[i];
    if (op.rejected || blocked.has(key(op))) {
      blocked.add(key(op));
      remaining.push(op);
      continue;
    }
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
      if (exec.isAuth(error)) return result(work.slice(i), true);
      if (op.kind === "delete" && exec.isNotFound?.(error)) continue;
      if (exec.isPermanent(error)) {
        const status =
          typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
            ? error.status
            : undefined;
        remaining.push({ ...op, rejected: { status } });
        blocked.add(key(op));
        continue;
      }
      return result(work.slice(i));
    }
  }
  return result();
}

/** Apply successful creates to both failed operations and concurrent additions. */
export function remapPendingOps(ops: PendingOp[], idMap: Record<string, string>): PendingOp[] {
  return ops.map((op) => {
    if (op.kind === "create") return op;
    const id = idMap[op.id] ?? op.id;
    return op.kind === "delete" ? { ...op, id } : { ...op, id, project: { ...op.project, id } };
  });
}
