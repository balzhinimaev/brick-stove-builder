import { forceCloseDatabase, IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { indexedWorkspace, newLocalProject, checkpoint } from "../workspace";
import { parseProjectFile, PROJECT_FILE_FORMAT, projectSnapshot, validateSnapshot } from "../projectFile";
import { READY_PROJECTS } from "../../domain/projects";
import { initialEditorState } from "../../domain/editor/state";

describe("local project library (Node IndexedDB, no browser)", () => {
  it("retains A and its checkpoint after saving B and reopening the database, without duplicate normal saves", async () => {
    const factory = new IDBFactory();
    const store = indexedWorkspace(factory);
    const a = newLocalProject("guest", "A", initialEditorState());
    await store.write(a, true);
    const edited = {
      ...a,
      updatedAt: a.updatedAt + 1,
      revision: 2,
      snapshot: { ...a.snapshot, lockedRows: [], currentRow: 3 }
    };
    await store.write(edited, true, a.updatedAt);
    const version = checkpoint(edited);
    await store.write(version);
    const b = newLocalProject("guest", "B", {
      ...initialEditorState(),
      rows: {},
      rowCount: 1,
      currentRow: 1,
      lockedRows: []
    });
    await store.write(b, true);
    const restart = indexedWorkspace(factory);
    expect(await restart.active("guest")).toBe(b.id);
    expect((await restart.list("guest")).filter((p) => p.kind === "project")).toHaveLength(2);
    expect((await restart.read(a.id))?.snapshot).toEqual(edited.snapshot);
    expect((await restart.read(version.id))?.snapshot).toEqual(edited.snapshot);
    expect(await restart.list("another-account")).toEqual([]);
    expect(await restart.active("another-account")).toBeNull();
  });

  it("reopens after an unexpected database close and preserves projects and active selection", async () => {
    const factory = new IDBFactory();
    const store = indexedWorkspace(factory);
    const project = newLocalProject("guest", "Saved project", initialEditorState());
    // Capture the connection used by the store without changing its production API.
    const originalOpen = factory.open.bind(factory);
    let connection: IDBDatabase | undefined;
    factory.open = (...args) => {
      const request = originalOpen(...args);
      request.addEventListener("success", () => {
        connection = request.result;
      });
      return request;
    };
    await store.write(project, true);
    const closed = connection!;
    await new Promise<void>((resolve) => {
      closed.addEventListener("close", () => resolve(), { once: true });
      // fake-indexeddb 6.2.5 declares a constructor here but accepts a connection.
      (forceCloseDatabase as unknown as (db: IDBDatabase) => void)(closed);
    });
    expect(await store.active("guest")).toBe(project.id);
    expect(connection).not.toBe(closed);
    expect(await store.read(project.id)).toMatchObject(project);
    const edited = { ...project, title: "Recovered save", updatedAt: project.updatedAt + 1 };
    await store.write(edited, true, project.updatedAt);
    expect((await store.read(project.id))?.title).toBe("Recovered save");
  });

  it("rejects stale writes atomically and preserves the other tab's revision", async () => {
    const store = indexedWorkspace(new IDBFactory());
    const a = newLocalProject("guest", "A", initialEditorState());
    await store.write(a, true);
    const newer = { ...a, title: "Other tab", updatedAt: a.updatedAt + 1 };
    await store.write(newer, true, a.updatedAt);
    await expect(store.write({ ...a, title: "Stale" }, true, a.updatedAt)).rejects.toThrow("другой вкладке");
    expect((await store.read(a.id))?.title).toBe("Other tab");
    expect(await store.active("guest")).toBe(a.id);
  });

  it("round-trips every bundled project including compound bricks, deep profiles and damper states", () => {
    for (const project of READY_PROJECTS) {
      const snapshot = projectSnapshot(project);
      expect(() => validateSnapshot(snapshot), project.id).not.toThrow();
      const file = parseProjectFile(
        JSON.stringify({ format: PROJECT_FILE_FORMAT, title: project.title.ru, revision: 1, snapshot })
      );
      expect(file.snapshot).toEqual(snapshot);
    }
  });

  it("imports backups after revision 100000 without changing their content", () => {
    const backup = {
      format: PROJECT_FILE_FORMAT,
      title: "Долгая работа",
      revision: 100001,
      sourceId: "original-project",
      snapshot: projectSnapshot(READY_PROJECTS[0])
    };
    expect(parseProjectFile(JSON.stringify(backup))).toEqual(backup);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid backup revision %s", (revision) => {
    const backup = {
      format: PROJECT_FILE_FORMAT,
      title: "Import",
      revision,
      snapshot: projectSnapshot(READY_PROJECTS[0])
    };
    expect(() => parseProjectFile(JSON.stringify(backup))).toThrow("полный файл");
  });

  it.each(["kind", "orientation", "notchCorner", "cutFrom"])(
    "rejects array-valued %s in imported JSON instead of coercing it to a valid enum",
    (field) => {
      const snapshot = {
        ...initialEditorState(),
        rows: {
          1: [
            {
              id: "imported-brick",
              row: 1,
              x: 0,
              y: 0,
              kind: "custom",
              orientation: "h",
              notchCorner: "nw",
              custom: { name: "Cut brick", w: 2, h: 1, cutFrom: "standard" }
            }
          ]
        }
      };
      const file = { format: PROJECT_FILE_FORMAT, title: "Import", revision: 1, snapshot };
      expect(parseProjectFile(JSON.stringify(file)).snapshot).toEqual(snapshot);
      const brick = snapshot.rows[1][0];
      const target = (field === "cutFrom" ? brick.custom : brick) as Record<string, unknown>;
      target[field] = [target[field]];
      const raw = JSON.stringify(file);
      expect(() => parseProjectFile(raw)).toThrow("Файл проекта:");
      expect(JSON.stringify(file)).toBe(raw);
    }
  );

  it("rejects report files, malformed geometry, duplicate IDs and nonfinite coordinates without silently repairing", () => {
    expect(() => parseProjectFile('{"format":"masonry-part-schedule-v1"}')).toThrow("полный файл");
    const snapshot = initialEditorState();
    const brick = Object.values(snapshot.rows).flat()[0];
    const single = { ...snapshot, rows: { [brick.row]: [brick] } };
    expect(() => validateSnapshot({ ...single, rows: { [brick.row]: [brick, brick] } })).toThrow("повторный");
    expect(() => validateSnapshot({ ...single, rows: { [brick.row]: [{ ...brick, x: NaN }] } })).toThrow(
      "некорректная деталь"
    );
    expect(() =>
      validateSnapshot({
        ...single,
        rows: {
          [brick.row]: [
            {
              ...brick,
              kind: "custom",
              custom: { name: "Broken", w: 2, h: 1, solidParts: [{ x1: 0, x2: -5, y1: 0, y2: 10, z1: 0, z2: 65 }] }
            }
          ]
        }
      })
    ).toThrow();
  });
});
