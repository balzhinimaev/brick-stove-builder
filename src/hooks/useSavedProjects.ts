import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSavedProject,
  deleteSavedProject,
  fetchSavedProjects,
  isAuthError,
  isPermanentError,
  updateSavedProject,
  type Session
} from "../api/client";
import {
  enqueuePendingOp,
  flushOps,
  loadPendingOps,
  loadProjectsCache,
  savePendingOps,
  saveProjectsCache,
  type FlushExecutor,
  type PendingOp
} from "../storage/offline";
import type { ReadyProject } from "../domain/types";

/** Пауза перед повтором синка после неудачи (сервер моргнул без потери сети). */
const RETRY_MS = 30_000;

function makeExecutor(token: string): FlushExecutor {
  return {
    create: (project) => createSavedProject(project, token),
    update: (id, project) => updateSavedProject(id, project, token),
    remove: (id) => deleteSavedProject(id, token),
    isPermanent: isPermanentError,
    isAuth: isAuthError
  };
}

/**
 * Офлайн-first проекты: список живёт в localStorage-кэше и обновляется с
 * сервера, операции без сети встают в очередь (см. flushOps в storage/offline)
 * и синхронизируются при появлении соединения, при входе и по ретрай-таймеру.
 * Временные id созданных офлайн проектов после синка заменяются серверными —
 * маппинг применяется к кэшу и отдаётся наружу, чтобы студия поправила
 * «открытый» проект. 401 не маскируется под офлайн: onAuthFailure разлогинивает.
 */
export function useSavedProjects(
  session: Session | null,
  onIdRemap?: (idMap: Record<string, string>) => void,
  onAuthFailure?: () => void
) {
  const [savedProjects, setSavedProjects] = useState<ReadyProject[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const flushing = useRef(false);
  const rerunAfterFlush = useRef(false);
  const retryTimer = useRef<number | null>(null);

  // Актуальные значения для колбэков, живущих дольше рендера (flush, таймеры).
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const currentLogin = session?.login ?? "";
  const loginRef = useRef(currentLogin);
  loginRef.current = currentLogin;

  const persistList = useCallback((login: string, updater: (current: ReadyProject[]) => ReadyProject[]) => {
    // Сессия могла смениться, пока летел запрос, — чужой список не пишем.
    if (login !== loginRef.current) return;
    setSavedProjects((current) => {
      const next = updater(current);
      saveProjectsCache(login, next);
      return next;
    });
  }, []);

  const flushRef = useRef<() => Promise<void>>(async () => {});

  const scheduleRetry = useCallback(() => {
    if (retryTimer.current !== null) return;
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      void flushRef.current();
    }, RETRY_MS);
  }, []);

  const flushPending = useCallback(async () => {
    const active = sessionRef.current;
    if (!active) return;
    if (flushing.current) {
      // «online» пришёл во время прокачки — не теряем сигнал, повторим после.
      rerunAfterFlush.current = true;
      return;
    }
    flushing.current = true;
    try {
      const ops = loadPendingOps(active.login);
      if (ops.length) {
        const { remaining, idMap, authFailed } = await flushOps(ops, makeExecutor(active.token));
        // Пока шла прокачка, пользователь мог насохранять ещё — сливаем хвосты,
        // а не перезаписываем очередь снапшотом.
        const addedMeanwhile = loadPendingOps(active.login).slice(ops.length);
        const nextOps = [...remaining, ...addedMeanwhile];
        savePendingOps(active.login, nextOps);
        if (active.login === loginRef.current) setPendingCount(nextOps.length);
        if (Object.keys(idMap).length) {
          persistList(active.login, (current) =>
            current.map((item) => (idMap[item.id] ? { ...item, id: idMap[item.id] } : item))
          );
          onIdRemap?.(idMap);
        }
        if (authFailed) {
          onAuthFailure?.();
          return;
        }
        if (nextOps.length) {
          scheduleRetry();
          return;
        }
      }
      // Очередь пуста — серверный список авторитетен, в том числе пустой
      // (проект могли удалить с другого устройства).
      const fresh = await fetchSavedProjects(active.token);
      persistList(active.login, () => fresh);
    } catch (error) {
      if (isAuthError(error)) {
        onAuthFailure?.();
        return;
      }
      scheduleRetry();
    } finally {
      flushing.current = false;
      if (rerunAfterFlush.current) {
        rerunAfterFlush.current = false;
        void flushRef.current();
      }
    }
  }, [onIdRemap, onAuthFailure, persistList, scheduleRetry]);
  flushRef.current = flushPending;

  useEffect(() => {
    if (!currentLogin) {
      setSavedProjects([]);
      setPendingCount(0);
      return;
    }
    // мгновенно — из кэша (работает без сети), затем свежее с сервера
    setSavedProjects(loadProjectsCache(currentLogin));
    setPendingCount(loadPendingOps(currentLogin).length);
    void flushRef.current();

    const onOnline = () => void flushRef.current();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (retryTimer.current !== null) {
        window.clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [currentLogin]);

  /**
   * Ошибка прямого сохранения: транзиентную прячем в очередь (и планируем
   * повтор), постоянную — нет: её ретрай не вылечит. Возвращает, встала ли
   * операция в очередь.
   */
  const queueOrReject = useCallback(
    (login: string, op: PendingOp, error: unknown): boolean => {
      if (isAuthError(error)) {
        onAuthFailure?.();
        return false;
      }
      if (isPermanentError(error)) return false;
      setPendingCount(enqueuePendingOp(login, op).length);
      scheduleRetry();
      return true;
    },
    [onAuthFailure, scheduleRetry]
  );

  const saveProject = useCallback(
    async (project: ReadyProject, token: string) => {
      const login = loginRef.current;
      try {
        const saved = await createSavedProject(project, token);
        persistList(login, (current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        return saved;
      } catch (error) {
        // офлайн: сохраняем локально и ставим в очередь
        if (!queueOrReject(login, { kind: "create", project, queuedAt: Date.now() }, error)) return null;
        persistList(login, (current) => [project, ...current.filter((item) => item.id !== project.id)]);
        return project;
      }
    },
    [persistList, queueOrReject]
  );

  const updateProject = useCallback(
    async (id: string, project: ReadyProject, token: string) => {
      const login = loginRef.current;
      try {
        const saved = await updateSavedProject(id, project, token);
        persistList(login, (current) => current.map((item) => (item.id === saved.id ? saved : item)));
        return saved;
      } catch (error) {
        if (!queueOrReject(login, { kind: "update", id, project, queuedAt: Date.now() }, error)) return null;
        persistList(login, (current) => current.map((item) => (item.id === id ? { ...project, id } : item)));
        return { ...project, id };
      }
    },
    [persistList, queueOrReject]
  );

  const removeProject = useCallback(
    async (id: string, token: string) => {
      const login = loginRef.current;
      try {
        await deleteSavedProject(id, token);
      } catch (error) {
        // Постоянная ошибка (404 = уже удалён с другого устройства) — цель
        // достигнута, локально тоже убираем; транзиентная — в очередь.
        queueOrReject(login, { kind: "delete", id, queuedAt: Date.now() }, error);
      }
      persistList(login, (current) => current.filter((item) => item.id !== id));
    },
    [persistList, queueOrReject]
  );

  const replaceProject = useCallback(
    (project: ReadyProject) => {
      persistList(loginRef.current, (current) => current.map((item) => (item.id === project.id ? project : item)));
    },
    [persistList]
  );

  return { savedProjects, pendingCount, saveProject, updateProject, removeProject, replaceProject, flushPending };
}
