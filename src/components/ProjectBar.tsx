import { useRef } from "react";
import type { LocalWorkspace } from "../hooks/useLocalWorkspace";
import { MAX_PROJECT_BYTES } from "../storage/projectFile";

export function ImportProjectButton({ workspace }: { workspace: LocalWorkspace }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" disabled={workspace.busy || !workspace.ready} onClick={() => input.current?.click()}>
        Открыть файл…
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Файл полного проекта"
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (!file) return;
          if (file.size > MAX_PROJECT_BYTES) {
            window.alert("Файл больше 20 МБ");
            return;
          }
          try {
            await workspace.importProject(await file.text());
          } catch {
            window.alert("Не удалось прочитать файл. Текущий проект не заменён.");
          }
        }}
      />
    </>
  );
}

export function ProjectBar({ workspace, onServerSave }: { workspace: LocalWorkspace; onServerSave?: () => void }) {
  const { info, state } = workspace;
  return (
    <header className="project-bar">
      <div className="project-identity">
        <button type="button" className="project-title" onClick={workspace.rename} title="Переименовать">
          {info?.title ?? "Новая печь"} <span aria-hidden="true">✎</span>
        </button>
        <output aria-live="polite" className={state === "error" ? "project-error" : "studio-muted"}>
          {state === "loading"
            ? "Открываю локальную библиотеку…"
            : state === "saving"
              ? "Сохраняю на устройстве…"
              : state === "error"
                ? "Не сохранено — выгрузите файл"
                : `На устройстве · рев. ${info?.revision ?? 1}${info ? ` · ${new Date(info.updatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : ""}`}
        </output>
      </div>
      <button
        className="studio-primary"
        type="button"
        disabled={!workspace.ready || workspace.busy}
        onClick={workspace.save}
      >
        Сохранить
      </button>
      <details className="project-actions">
        <summary>Файл и версии</summary>
        <div>
          <button type="button" onClick={workspace.saveCopy} disabled={workspace.busy}>
            Сохранить копию…
          </button>
          <button type="button" onClick={workspace.saveVersion} disabled={workspace.busy}>
            Контрольная точка…
          </button>
          <button type="button" onClick={workspace.exportProject}>
            Скачать полный проект
          </button>
          <ImportProjectButton workspace={workspace} />
          {onServerSave && (
            <button type="button" onClick={onServerSave}>
              Сохранить в аккаунте
            </button>
          )}
          <p>Локальные проекты находятся на этом устройстве. Файл проекта — переносимая резервная копия.</p>
        </div>
      </details>
      {workspace.error && (
        <p role="alert" className="project-error">
          {workspace.error}
        </p>
      )}
    </header>
  );
}
