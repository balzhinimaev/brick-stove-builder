import type { DraftSnapshot } from "../domain/editor";
import { uniqueId } from "../lib/id";

export type LocalProjectInfo = {
  id: string;
  namespace: string;
  title: string;
  revision: number;
  updatedAt: number;
  sourceId?: string;
  remoteId?: string;
  parentId?: string;
  kind: "project" | "checkpoint";
  viewRow?: number;
};
export type LocalProject = LocalProjectInfo & { snapshot: DraftSnapshot };
export type WorkspaceStore = {
  list(namespace: string): Promise<LocalProjectInfo[]>;
  read(id: string): Promise<LocalProject | null>;
  active(namespace: string): Promise<string | null>;
  write(project: LocalProject, activate?: boolean, expectedUpdatedAt?: number, viewOnly?: boolean): Promise<void>;
};

/** Headers and geometry live separately; opening the library never decodes every stove. */
export function indexedWorkspace(factory: IDBFactory = indexedDB): WorkspaceStore {
  let database: Promise<IDBDatabase> | undefined;
  const open = () => {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open("stove-workspace", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("headers", { keyPath: "id" }).createIndex("namespace", "namespace");
        db.createObjectStore("bodies");
        db.createObjectStore("active");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Закройте другую вкладку редактора и повторите сохранение"));
    }).catch((error) => {
      database = undefined;
      throw error;
    });
    return database;
  };
  const readOne = async <T>(store: string, key: string): Promise<T | null> => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  };
  return {
    async list(namespace) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const request = db.transaction("headers").objectStore("headers").index("namespace").getAll(namespace);
        request.onsuccess = () =>
          resolve((request.result as LocalProjectInfo[]).sort((a, b) => b.updatedAt - a.updatedAt));
        request.onerror = () => reject(request.error);
      });
    },
    async read(id) {
      // One transaction observes the matching header and body, even across tabs.
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(["headers", "bodies"]);
        const h = tx.objectStore("headers").get(id),
          b = tx.objectStore("bodies").get(id);
        tx.oncomplete = () =>
          resolve(
            h.result && b.result
              ? { ...h.result, snapshot: { ...b.result, currentRow: h.result.viewRow ?? b.result.currentRow } }
              : null
          );
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    },
    active: (namespace) => readOne<string>("active", namespace),
    async write(project, activate = false, expectedUpdatedAt, viewOnly = false) {
      const db = await open();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["headers", "bodies", "active"], "readwrite");
        const { snapshot, ...info } = project;
        let conflict = false;
        const previous = tx.objectStore("headers").get(info.id);
        previous.onsuccess = () => {
          if (
            (expectedUpdatedAt !== undefined && previous.result?.updatedAt !== expectedUpdatedAt) ||
            (previous.result && previous.result.updatedAt > info.updatedAt)
          ) {
            conflict = true;
            tx.abort();
            return;
          }
          tx.objectStore("headers").put({ ...info, viewRow: snapshot.currentRow });
          if (!viewOnly || !previous.result) tx.objectStore("bodies").put(snapshot, info.id);
          if (activate) tx.objectStore("active").put(info.id, info.namespace);
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () =>
          reject(
            conflict
              ? new Error(
                  "Этот проект изменён в другой вкладке. Скачайте текущую работу в файл или сохраните отдельную копию"
                )
              : (tx.error ?? new Error("Не удалось сохранить проект"))
          );
        tx.onerror = () => reject(tx.error);
      });
    }
  };
}

export function newLocalProject(
  namespace: string,
  title: string,
  snapshot: DraftSnapshot,
  sourceId?: string
): LocalProject {
  return {
    id: uniqueId("local"),
    namespace,
    title,
    revision: 1,
    updatedAt: Date.now(),
    kind: "project",
    snapshot,
    sourceId
  };
}

export function checkpoint(project: LocalProject, title = "Перед открытием другого проекта"): LocalProject {
  return {
    ...project,
    id: uniqueId("checkpoint"),
    parentId: project.id,
    kind: "checkpoint",
    title: `${project.title} · ${title}`,
    updatedAt: Date.now()
  };
}
