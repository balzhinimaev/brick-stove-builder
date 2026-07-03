import { useEffect, useRef, useState } from "react";
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
 *
 * Пока первичная загрузка не завершилась, автосохранение молчит: иначе
 * дефолтный пустой редактор со свежей меткой времени затёр бы настоящий
 * черновик и локально, и на сервере (медленная сеть > дебаунс). Сервер со
 * своей стороны отбрасывает устаревшие пуши (409 stale) — это не ошибка.
 */
export function useAutosaveDraft(session: Session | null, snapshot: DraftSnapshot, onLoadDraft: (draft: DraftSnapshot) => boolean): AutosaveState {
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const hydrated = useRef(false);
  // Свежий колбэк для отложенного ответа сервера (замыкание эффекта успевает
  // устареть, а решение «заменять ли редактор» зависит от текущего состояния).
  const onLoadDraftRef = useRef(onLoadDraft);
  onLoadDraftRef.current = onLoadDraft;

  useEffect(() => {
    hydrated.current = false;
    if (!session) return;
    const local = loadLocalDraft(session.login);
    if (local && onLoadDraftRef.current(local)) {
      setAutosaveState("saved");
    }

    let active = true;
    fetchRemoteDraft(session.token)
      .then((remote) => {
        // Автосейв до гидратации молчит, так что local не мог измениться.
        if (!active || !remote) return;
        // Отказ пользователя = черновик не принят: локальную копию не трогаем,
        // текущая работа перепишет её со свежей меткой.
        if ((!local || remote.updatedAt > local.updatedAt) && onLoadDraftRef.current(remote)) {
          saveLocalDraft(session.login, remote);
          setAutosaveState("saved");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) hydrated.current = true;
      });
    return () => {
      active = false;
    };
    // Intentionally keyed on the login only: load happens once per sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.login]);

  useEffect(() => {
    if (!session || !hydrated.current) return;
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
      // stale-ответ игнорируем: значит, другое устройство успело записать новее.
      void pushRemoteDraft(draft, session.token).catch(() => {});
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, snapshot.parameters, snapshot.rowCount, snapshot.currentRow, snapshot.lockedRows, snapshot.rows]);

  return autosaveState;
}
