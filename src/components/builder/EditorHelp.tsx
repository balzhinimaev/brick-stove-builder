import type { Translate } from "../../i18n";

export function EditorHelp({ t }: { t: Translate }) {
  return (
    <details className="editor-help">
      <summary>{t("editorHelp")}</summary>
      <div className="editor-help-content">
        <strong>{t("editorHelpTitle")}</strong>
        <p>{t("editorHelpIntro")}</p>
        <dl>
          {(
            [
              ["V", "selectPartMode"],
              ["B", "standard"],
              ["E", "eraser"],
              ["R", "rotateBrick"],
              ["Esc", "editorEscapeHint"],
              ["PageUp / PageDown", "editorChangeRow"],
              ["Ctrl / ⌘ + Z", "undo"],
              ["Ctrl / ⌘ + Shift + Z", "redo"],
              ["Ctrl / ⌘ + S", "saveProject"]
            ] as const
          ).map(([keys, label]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{t(label)}</dd>
            </div>
          ))}
        </dl>
        <p>{t("editorKeyboardHint")}</p>
      </div>
    </details>
  );
}
