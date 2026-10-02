import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFile } from "../projectFile";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setup(fail = false) {
  vi.useFakeTimers();
  let attached = false;
  const anchor = {
    href: "",
    download: "",
    click: vi.fn(() => {
      expect(attached).toBe(true);
      if (fail) throw new Error("Download blocked");
    }),
    remove: vi.fn(() => {
      attached = false;
    })
  };
  vi.stubGlobal("document", {
    createElement: () => anchor,
    body: {
      append: () => {
        attached = true;
      }
    }
  });
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:backup");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  return { anchor, create, revoke };
}

describe("project backup download", () => {
  it("clicks an attached link and keeps the backup available while the download starts", async () => {
    const { anchor, create, revoke } = setup();
    downloadFile("my-stove.json", '{"title":"Печь"}');
    expect(anchor.href).toBe("blob:backup");
    expect(anchor.download).toBe("my-stove.json");
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    const blob = create.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(await blob.text()).toBe('{"title":"Печь"}');
    vi.advanceTimersByTime(1500);
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:backup");
  });

  it("cleans up the link and object URL even when starting the download throws", () => {
    const { anchor, revoke } = setup(true);
    expect(() => downloadFile("backup.json", "{}")).toThrow("Download blocked");
    expect(anchor.remove).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:backup");
  });
});
