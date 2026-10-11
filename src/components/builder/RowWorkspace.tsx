import { useEffect, useId, useRef, useState } from "react";
import type { BuilderScreenProps } from "../BuilderScreen";
import type { TranslationKey } from "../../i18n";
import { RowMap } from "../RowMap";
import { openRowDialog, confirmationValid, rowPage, type PendingRowAction, type RowAction } from "./rowWorkflow";

export function RowWorkspace(props: BuilderScreenProps & { busy: boolean }) {
  const { t, rows, currentRow, rowCount, lockedRows, busy } = props;
  const [filter, setFilter] = useState("all");
  const [pending, setPending] = useState<PendingRowAction | null>(null);
  const [feedback, setFeedback] = useState<{ context: typeof props; key: TranslationKey } | null>(null);
  const locked = lockedRows.includes(currentRow);
  const bricks = rows[currentRow] ?? [];
  const page = rowPage(rows, rowCount, currentRow, lockedRows, filter);
  const valid = pending && confirmationValid(pending, props);
  useEffect(() => {
    if (pending && !valid) setPending(null);
  }, [pending, valid]);
  const perform = (action: RowAction | "fillCurrentRow") => {
    if (busy || locked) return;
    const result = props[action]();
    setFeedback(result ? { context: props, key: result } : null);
  };
  const request = (action: RowAction, trigger: HTMLElement) => {
    if (busy || locked) return;
    if (action === "deleteCurrentRow" || bricks.length) setPending({ action, context: props, trigger });
    else perform(action);
  };
  const actions = { copyPreviousRow: "copyPrev", clearCurrentRow: "clearRow", deleteCurrentRow: "deleteRow" } as const;
  return (
    <section className="row-workspace" aria-label={t("rowWorkspace")}>
      <h3>
        {t("currentRow")} {currentRow} / {rowCount}
      </h3>
      <p>
        {t(locked ? "rowLockedStatus" : bricks.length ? "rowDraftStatus" : "rowEmptyStatus")} · {t("rowElements")}:{" "}
        {bricks.length}
      </p>
      <figure className="row-workspace-map">
        <RowMap grid={props.grid} bricks={bricks} variant="screen" title={`${t("currentRow")} ${currentRow}`} />
        <figcaption>{t("rowPreviewHint")}</figcaption>
      </figure>
      <label>
        {t("rowFilter")}{" "}
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">{t("rowAll")}</option>
          <option value="nonempty">{t("rowNonempty")}</option>
          <option value="unfinished">{t("rowUnfinished")}</option>
        </select>
      </label>
      <p className="studio-muted">
        {t("rowNavigationHint")} · {page.total}
      </p>
      <div className="studio-row-list">
        {page.visible.map((row) => (
          <button
            type="button"
            key={row}
            disabled={busy}
            aria-current={row === currentRow ? "step" : undefined}
            aria-pressed={row === currentRow}
            onClick={() => props.setCurrentRow(row)}
          >
            <span>
              {t("currentRow")} {row} ·{" "}
              {t(
                lockedRows.includes(row) ? "rowLockedStatus" : rows[row]?.length ? "rowDraftStatus" : "rowEmptyStatus"
              )}
            </span>
            <span>
              {t("rowElements")}: {rows[row]?.length ?? 0}
            </span>
          </button>
        ))}
      </div>
      <div className="studio-row-actions">
        <button
          type="button"
          disabled={busy || page.previous === undefined}
          onClick={() => props.setCurrentRow(page.previous ?? currentRow)}
        >
          {t("rowPreviousPage")}
        </button>
        <button
          type="button"
          disabled={busy || page.next === undefined}
          onClick={() => props.setCurrentRow(page.next ?? currentRow)}
        >
          {t("rowNextPage")}
        </button>
      </div>
      <div className="studio-row-actions">
        {Object.entries(actions).map(([action, label]) => (
          <button
            type="button"
            key={action}
            disabled={
              busy ||
              locked ||
              (action === "copyPreviousRow" && currentRow === 1) ||
              (action === "deleteCurrentRow" && rowCount === 1) ||
              (action === "clearCurrentRow" && !bricks.length)
            }
            onClick={(e) => request(action as RowAction, e.currentTarget)}
          >
            {t(label)}
          </button>
        ))}
        <button type="button" disabled={busy || locked} onClick={() => perform("fillCurrentRow")}>
          {t("fillRow")}
        </button>
      </div>
      <p className="studio-muted">{t("rowFillHint")}</p>
      {feedback &&
        confirmationValid({ action: "clearCurrentRow", context: feedback.context, trigger: null }, props) && (
          <output>{t(feedback.key)}</output>
        )}
      {valid && (
        <RowConfirmation
          pending={pending}
          t={t}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            if (!confirmationValid(pending, props)) return;
            setPending(null);
            perform(pending.action);
          }}
        />
      )}
    </section>
  );
}

function RowConfirmation({
  pending,
  t,
  onCancel,
  onConfirm
}: {
  pending: PendingRowAction;
  t: BuilderScreenProps["t"];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const title = useId();
  const description = useId();
  useEffect(() => {
    if (!dialog.current || !cancel.current) return;
    return openRowDialog(dialog.current, cancel.current, pending.trigger);
  }, [pending]);
  const { currentRow, rows, rowCount } = pending.context;
  return (
    <dialog
      ref={dialog}
      className="row-confirmation"
      aria-labelledby={title}
      aria-describedby={description}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id={title}>
        {t("rowConfirmTitle")} · {t("currentRow")} {currentRow}
      </h2>
      <div id={description}>
        <p>
          {t(
            pending.action === "deleteCurrentRow"
              ? "rowDeleteWarning"
              : pending.action === "copyPreviousRow"
                ? "rowCopyWarning"
                : "rowClearWarning"
          )}
        </p>
        <p>
          {t("rowElements")}: {rows[currentRow]?.length ?? 0}
        </p>
        {pending.action === "copyPreviousRow" && (
          <p>
            {t("copyPrev")}: {currentRow - 1} · {t("rowElements")}: {rows[currentRow - 1]?.length ?? 0}
          </p>
        )}
        {pending.action === "deleteCurrentRow" && (
          <p>
            {t("rowShiftWarning")}: {rowCount - currentRow}
          </p>
        )}
        <p>{t("rowUndoHint")}</p>
      </div>
      <div className="studio-row-actions">
        <button ref={cancel} type="button" onClick={onCancel}>
          {t("rowCancel")}
        </button>
        <button type="button" onClick={onConfirm}>
          {t("rowConfirm")}
        </button>
      </div>
    </dialog>
  );
}
