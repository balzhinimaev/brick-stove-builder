import { useEffect, useState } from "react";
import { loadLocalDraft, saveLocalDraft } from "../storage/draft";
import type { DraftSnapshot } from "../domain/editor";

export type AutosaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 900;

/**
 * Loads a per-user draft on login and debounces saves of the editor snapshot.
 * `onLoadDraft` is invoked once when a draft is found for the active user.
 */
export function useAutosaveDraft(userLogin: string, snapshot: DraftSnapshot, onLoadDraft: (draft: DraftSnapshot) => void): AutosaveState {
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");

  useEffect(() => {
    if (!userLogin) return;
    const draft = loadLocalDraft(userLogin);
    if (!draft) return;
    onLoadDraft(draft);
    setAutosaveState("saved");
    // Intentionally keyed on userLogin only: load happens once per sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLogin]);

  useEffect(() => {
    if (!userLogin) return;
    setAutosaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        saveLocalDraft(userLogin, { ...snapshot, updatedAt: Date.now() });
        setAutosaveState("saved");
      } catch {
        setAutosaveState("error");
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [userLogin, snapshot.parameters, snapshot.rowCount, snapshot.currentRow, snapshot.lockedRows, snapshot.rows]);

  return autosaveState;
}
