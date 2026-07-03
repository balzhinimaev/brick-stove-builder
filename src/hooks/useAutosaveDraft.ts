import { useEffect, useState } from "react";
import { loadLocalDraft, saveLocalDraft, type LocalDraft } from "../storage/draft";
import { fetchRemoteDraft, pushRemoteDraft, type Session } from "../api/client";
import type { DraftSnapshot } from "../domain/editor";

export type AutosaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 900;

/**
 * Черновик в два слоя: localStorage (мгновенно, оффлайн) + сервер (синк между
 * устройствами). При входе сначала грузится локальный, затем, если серверный
 * свежее по updatedAt (клиентская метка), — он заменяет локальный. Ошибки
 * сервера черновик не ломают: локальный слой самодостаточен.
 */
export function useAutosaveDraft(session: Session | null, snapshot: DraftSnapshot, onLoadDraft: (draft: DraftSnapshot) => void): AutosaveState {
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");

  useEffect(() => {
    if (!session) return;
    const local = loadLocalDraft(session.login);
    if (local) {
      onLoadDraft(local);
      setAutosaveState("saved");
    }

    let active = true;
    fetchRemoteDraft(session.token)
      .then((remote) => {
        if (!active || !remote) return;
        // Локальный мог обновиться, пока летел запрос, — перечитываем.
        const freshLocal = loadLocalDraft(session.login);
        if (!freshLocal || remote.updatedAt > freshLocal.updatedAt) {
          onLoadDraft(remote);
          saveLocalDraft(session.login, remote);
          setAutosaveState("saved");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // Intentionally keyed on the login only: load happens once per sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.login]);

  useEffect(() => {
    if (!session) return;
    setAutosaveState("saving");
    const timer = window.setTimeout(() => {
      const draft: LocalDraft = { ...snapshot, updatedAt: Date.now() };
      try {
        saveLocalDraft(session.login, draft);
        setAutosaveState("saved");
      } catch {
        setAutosaveState("error");
        return;
      }
      // Сервер — фоном; его недоступность не мешает локальному автосохранению.
      void pushRemoteDraft(draft, session.token).catch(() => {});
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, snapshot.parameters, snapshot.rowCount, snapshot.currentRow, snapshot.lockedRows, snapshot.rows]);

  return autosaveState;
}
