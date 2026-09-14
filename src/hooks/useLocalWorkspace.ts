import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftSnapshot } from "../domain/editor";
import { loadLocalDraft } from "../storage/draft";
import { downloadFile, parseProjectFile, PROJECT_FILE_FORMAT, validateSnapshot } from "../storage/projectFile";
import {
  checkpoint,
  indexedWorkspace,
  newLocalProject,
  type LocalProject,
  type LocalProjectInfo,
  type WorkspaceStore
} from "../storage/workspace";

/** A single ordered writer. Switching waits for recovery persistence; failures never replace the document. */
export function useLocalWorkspace(
  login: string,
  snapshot: DraftSnapshot,
  onLoad: (snapshot: DraftSnapshot, navigate?: boolean) => void
) {
  const namespace = login || "guest";
  const [info, setInfo] = useState<LocalProjectInfo | null>(null);
  const [projects, setProjects] = useState<LocalProjectInfo[]>([]);
  const [state, setState] = useState<"loading" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const switching = useRef(false);
  const store = useRef<WorkspaceStore | null>(null);
  const current = useRef<LocalProject | null>(null);
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const loadRef = useRef(onLoad);
  loadRef.current = onLoad;
  const scope = useRef(namespace);
  scope.current = namespace;
  const hydrated = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const schedule = useCallback(<T>(action: () => Promise<T>): Promise<T> => {
    const task = queue.current.then(action);
    queue.current = task.catch(() => {});
    return task;
  }, []);
  const fail = useCallback((e: unknown) => {
    setState("error");
    setError(
      `${e instanceof Error ? e.message : "Хранилище недоступно"}. Работа остаётся в редакторе; можно выгрузить файл проекта.`
    );
  }, []);
  const getStore = useCallback(() => {
    if (!store.current) store.current = indexedWorkspace();
    return store.current;
  }, []);
  const refresh = useCallback(
    async (ns: string) => {
      const list = await getStore().list(ns);
      if (scope.current === ns) setProjects(list);
    },
    [getStore]
  );

  useEffect(() => {
    let alive = true;
    hydrated.current = false;
    setReady(false);
    setState("loading");
    setInfo(null);
    setProjects([]);
    const outgoing = current.current;
    const outgoingSnapshot = latest.current;
    current.current = null;
    void schedule(async () => {
      store.current ??= indexedWorkspace();
      if (outgoing && outgoing.namespace !== namespace)
        await store.current.write(checkpoint({ ...outgoing, snapshot: outgoingSnapshot }, "Перед сменой аккаунта"));
      const id = await store.current.active(namespace);
      let doc = id ? await store.current.read(id) : null;
      if (doc?.namespace !== namespace) doc = null;
      if (!doc) {
        const legacy = loadLocalDraft(login);
        if (legacy) {
          validateSnapshot(legacy);
          doc = newLocalProject(namespace, "Восстановленный черновик", legacy);
          // Old localStorage key remains untouched, even after a successful migration.
          await store.current.write(doc, true);
        }
      }
      if (!alive) return;
      if (doc) {
        validateSnapshot(doc.snapshot);
        current.current = doc;
        latest.current = doc.snapshot;
        setInfo(doc);
        loadRef.current(doc.snapshot, false);
      }
      await refresh(namespace);
      if (alive) {
        hydrated.current = true;
        setReady(true);
        setState("saved");
        setError("");
      }
    }).catch((e) => {
      if (alive) {
        fail(e);
        setReady(true);
      }
    });
    return () => {
      alive = false;
      clearTimeout(timer.current);
    };
  }, [namespace, login, schedule, refresh, fail]);

  const sameDocument = (a: DraftSnapshot, b: DraftSnapshot) => {
    if (
      a.rows === b.rows &&
      a.parameters === b.parameters &&
      a.rowCount === b.rowCount &&
      a.lockedRows === b.lockedRows
    )
      return true;
    return (
      JSON.stringify([a.parameters, a.rowCount, a.lockedRows, a.rows]) ===
      JSON.stringify([b.parameters, b.rowCount, b.lockedRows, b.rows])
    );
  };
  const write = async (ns: string, data: DraftSnapshot, force = false, expectedId?: string): Promise<LocalProject> => {
    if (scope.current !== ns) throw new Error("Аккаунт изменился");
    store.current ??= indexedWorkspace();
    const previous = current.current;
    if (expectedId && previous?.id !== expectedId) {
      if (!previous) throw new Error("Проект сменился");
      setState("saved");
      return previous;
    }
    const unchanged = previous ? sameDocument(previous.snapshot, data) : false;
    if (!force && previous && unchanged && previous.snapshot.currentRow === data.currentRow) {
      setState("saved");
      return previous;
    }
    const doc = previous
      ? {
          ...previous,
          snapshot: data,
          updatedAt: Math.max(Date.now(), previous.updatedAt + 1),
          revision: previous.revision + (unchanged ? 0 : 1)
        }
      : newLocalProject(ns, "Новая печь", data);
    await store.current.write(doc, true, previous?.updatedAt, !!unchanged);
    if (scope.current === ns) {
      current.current = doc;
      setInfo(doc);
      setState("saved");
      setError("");
    }
    return doc;
  };
  const flush = (force = false) => {
    clearTimeout(timer.current);
    const data = latest.current,
      ns = namespace,
      expectedId = current.current?.id;
    setState("saving");
    return schedule(async () => {
      const doc = await write(ns, data, force, expectedId);
      await refresh(ns);
      return doc;
    }).catch((e) => {
      if (scope.current === ns) fail(e);
      throw e;
    });
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  // biome-ignore lint/correctness/useExhaustiveDependencies: schedule autosave on document/view changes; read its latest snapshot only when the debounce fires.
  useEffect(() => {
    if (!ready || !hydrated.current) return;
    setState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flushRef.current().catch(fail);
    }, 500);
    return () => clearTimeout(timer.current);
  }, [snapshot.rows, snapshot.parameters, snapshot.rowCount, snapshot.lockedRows, snapshot.currentRow, ready, fail]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden && hydrated.current) void flushRef.current().catch(fail);
    };
    const before = (event: BeforeUnloadEvent) => {
      if (state === "saving" || state === "error") event.preventDefault();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("beforeunload", before);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("beforeunload", before);
    };
  }, [state, fail]);

  const replace = async (next: LocalProject) => {
    if (switching.current || !ready) return false;
    switching.current = true;
    setBusy(true);
    try {
      await flush();
      await schedule(async () => {
        if (scope.current !== namespace) throw new Error("Аккаунт изменился");
        if (current.current && Object.values(current.current.snapshot.rows).some((r) => r.length))
          await getStore().write(checkpoint(current.current));
        await getStore().write(next, true);
        if (scope.current !== namespace) return;
        current.current = next;
        latest.current = next.snapshot;
        setInfo(next);
        loadRef.current(next.snapshot, true);
        await refresh(namespace);
        setState("saved");
        setError("");
        hydrated.current = true;
      });
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      switching.current = false;
      setBusy(false);
    }
  };
  const save = async () => {
    try {
      await flush(true);
      hydrated.current = true;
    } catch (e) {
      fail(e);
    }
  };
  const saveCopy = async () => {
    const title = window.prompt("Название копии", `${info?.title ?? "Новая печь"} · копия`)?.trim();
    if (!title) return;
    // This also works after a cross-tab conflict: preserve the editor in a new ID without touching the other tab.
    clearTimeout(timer.current);
    const next = newLocalProject(namespace, title.slice(0, 200), latest.current, info?.sourceId);
    try {
      await schedule(async () => {
        store.current ??= indexedWorkspace();
        await store.current.write(next, true);
        if (scope.current !== namespace) return;
        current.current = next;
        setInfo(next);
        setState("saved");
        setError("");
        hydrated.current = true;
        await refresh(namespace);
      });
    } catch (e) {
      fail(e);
    }
  };
  const saveVersion = async () => {
    const title = window.prompt("Название контрольной точки", "Перед правкой")?.trim();
    if (!title) return;
    try {
      const doc = await flush();
      await schedule(async () => {
        await getStore().write(checkpoint(doc, title.slice(0, 200)));
        await refresh(namespace);
      });
    } catch (e) {
      fail(e);
    }
  };
  const rename = async () => {
    const title = window.prompt("Название проекта", info?.title ?? "Новая печь")?.trim();
    if (!title) return;
    try {
      await flush();
      await schedule(async () => {
        const previous = current.current;
        if (!previous) throw new Error("Нет открытого проекта");
        const next = {
          ...previous,
          title: title.slice(0, 200),
          updatedAt: Math.max(Date.now(), previous.updatedAt + 1)
        };
        await getStore().write(next, true, previous.updatedAt);
        current.current = next;
        setInfo(next);
        await refresh(namespace);
      });
    } catch (e) {
      fail(e);
    }
  };
  const open = async (item: LocalProjectInfo) => {
    try {
      const doc = await getStore().read(item.id);
      if (!doc || doc.namespace !== namespace) throw new Error("Проект не найден");
      validateSnapshot(doc.snapshot);
      await replace(
        doc.kind === "checkpoint"
          ? newLocalProject(namespace, `${doc.title} · восстановлено`, doc.snapshot, doc.sourceId)
          : doc
      );
    } catch (e) {
      fail(e);
    }
  };
  const exportProject = () =>
    downloadFile(
      `${(info?.title ?? "Новая печь").replace(/[^\p{L}\p{N} _.-]/gu, "_")}.stove.json`,
      JSON.stringify(
        {
          format: PROJECT_FILE_FORMAT,
          title: info?.title ?? "Новая печь",
          revision: current.current
            ? current.current.revision + (sameDocument(current.current.snapshot, latest.current) ? 0 : 1)
            : 1,
          sourceId: info?.sourceId,
          snapshot: latest.current
        },
        null,
        2
      )
    );
  const importProject = async (raw: string) => {
    try {
      const file = parseProjectFile(raw);
      return await replace(newLocalProject(namespace, file.title, file.snapshot, file.sourceId));
    } catch (e) {
      fail(e);
      return false;
    }
  };
  const linkRemote = (localId: string, remoteId: string) =>
    schedule(async () => {
      const doc = await getStore().read(localId);
      if (!doc || doc.namespace !== namespace) return;
      const next = { ...doc, remoteId, updatedAt: Math.max(Date.now(), doc.updatedAt + 1) };
      await getStore().write(next, false, doc.updatedAt, true);
      if (current.current?.id === localId) {
        current.current = next;
        setInfo(next);
      }
      await refresh(namespace);
    });
  return {
    info,
    projects,
    state,
    error,
    ready,
    busy,
    save,
    saveCopy,
    saveVersion,
    rename,
    open,
    exportProject,
    importProject,
    create: (title: string, data: DraftSnapshot, sourceId?: string, remoteId?: string) =>
      replace({ ...newLocalProject(namespace, title, data, sourceId), remoteId }),
    linkRemote,
    read: (id: string) => getStore().read(id),
    flush
  };
}

export type LocalWorkspace = ReturnType<typeof useLocalWorkspace>;
