import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
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
  remapPendingOps,
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
export type SyncIssue = "syncRejected" | "syncCheckpointFailed" | null;

function makeExecutor(token: string): FlushExecutor {
  return {
    create: (project) => createSavedProject(project, token),
    update: (id, project) => updateSavedProject(id, project, token),
    remove: (id) => deleteSavedProject(id, token),
    isPermanent: isPermanentError,
    isAuth: isAuthError,
    isNotFound: (error) => error instanceof ApiError && error.status === 404
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
  const [syncIssue, setSyncIssue] = useState<SyncIssue>(null);
  const revision = useRef(0);
  const callbacks = useRef({ onIdRemap, onAuthFailure });
  callbacks.current = { onIdRemap, onAuthFailure };
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
    const isCurrent = () => active.login === sessionRef.current?.login && active.token === sessionRef.current?.token;
    flushing.current = true;
    try {
      const ops = loadPendingOps(active.login);
      // Retry an earlier failed checkpoint even when its in-memory queue is empty.
      if (!savePendingOps(active.login, ops)) {
        if (isCurrent()) setSyncIssue("syncCheckpointFailed");
        scheduleRetry();
        return;
      }
      if (isCurrent()) {
        setSyncIssue(null);
        setPendingCount(ops.length);
      }
      if (ops.length) {
        const { remaining, idMap, authFailed, permanentFailure } = await flushOps(ops, makeExecutor(active.token));
        // Пока шла прокачка, пользователь мог насохранять ещё — сливаем хвосты,
        // а не перезаписываем очередь снапшотом.
        const addedMeanwhile = loadPendingOps(active.login).slice(ops.length);
        const nextOps = [...remaining, ...remapPendingOps(addedMeanwhile, idMap)];
        const checkpointSaved = savePendingOps(active.login, nextOps);
        if (isCurrent()) {
          setPendingCount(nextOps.length);
          setSyncIssue(!checkpointSaved ? "syncCheckpointFailed" : permanentFailure ? "syncRejected" : null);
        }
        if (Object.keys(idMap).length) {
          if (isCurrent())
            persistList(active.login, (current) =>
              current.map((item) => (idMap[item.id] ? { ...item, id: idMap[item.id] } : item))
            );
          if (isCurrent()) callbacks.current.onIdRemap?.(idMap);
        }
        if (authFailed) {
          if (isCurrent()) callbacks.current.onAuthFailure?.();
          return;
        }
        if (!checkpointSaved) {
          scheduleRetry();
          return;
        }
        if (permanentFailure && isCurrent()) {
          // Keep the rejected data, but stop automatic retries until a new user/online signal.
          if (retryTimer.current !== null) {
            window.clearTimeout(retryTimer.current);
            retryTimer.current = null;
          }
          rerunAfterFlush.current = false;
          return;
        }
        if (nextOps.length) {
          scheduleRetry();
          return;
        }
      }
      // Очередь пуста — серверный список авторитетен, в том числе пустой
      // (проект могли удалить с другого устройства).
      if (!isCurrent()) return;
      const requestedRevision = revision.current;
      const fresh = await fetchSavedProjects(active.token);
      if (isCurrent() && requestedRevision === revision.current && !loadPendingOps(active.login).length)
        persistList(active.login, () => fresh);
    } catch (error) {
      if (isAuthError(error)) {
        if (isCurrent()) callbacks.current.onAuthFailure?.();
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
  }, [persistList, scheduleRetry]);
  flushRef.current = flushPending;

  useEffect(() => {
    setSyncIssue(null);
    if (!currentLogin || !session?.token) {
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
  }, [currentLogin, session?.token]);

  // Every mutation joins the same writer, including when the network is online.
  const queue = useCallback((op: PendingOp, token: string) => {
    const active = sessionRef.current;
    if (!active || active.token !== token) return false;
    try {
      const ops = enqueuePendingOp(active.login, op);
      revision.current++;
      setPendingCount(ops.length);
      return true;
    } catch {
      window.alert(
        "Не удалось сохранить очередь синхронизации. Освободите место в хранилище браузера. Локальный проект остаётся в библиотеке."
      );
      return false;
    }
  }, []);

  const saveProject = useCallback(
    async (project: ReadyProject, token: string) => {
      if (!queue({ kind: "create", project, queuedAt: Date.now() }, token)) return null;
      persistList(loginRef.current, (current) => [project, ...current.filter((item) => item.id !== project.id)]);
      void flushRef.current();
      return project;
    },
    [persistList, queue]
  );

  const updateProject = useCallback(
    async (id: string, project: ReadyProject, token: string) => {
      if (!queue({ kind: "update", id, project, queuedAt: Date.now() }, token)) return null;
      persistList(loginRef.current, (current) => current.map((item) => (item.id === id ? { ...project, id } : item)));
      void flushRef.current();
      return { ...project, id };
    },
    [persistList, queue]
  );

  const removeProject = useCallback(
    async (id: string, token: string) => {
      if (!queue({ kind: "delete", id, queuedAt: Date.now() }, token)) return false;
      persistList(loginRef.current, (current) => current.filter((item) => item.id !== id));
      void flushRef.current();
      return true;
    },
    [persistList, queue]
  );

  const replaceProject = useCallback(
    (project: ReadyProject) => {
      revision.current++;
      persistList(loginRef.current, (current) => current.map((item) => (item.id === project.id ? project : item)));
    },
    [persistList]
  );

  return {
    savedProjects,
    pendingCount,
    syncIssue,
    saveProject,
    updateProject,
    removeProject,
    replaceProject,
    flushPending
  };
}
