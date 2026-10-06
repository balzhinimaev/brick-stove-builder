import { useState } from "react";
import type { LocalWorkspace } from "../hooks/useLocalWorkspace";
import { compareDocuments } from "../domain/projectCompare";
import type { LocalProjectInfo } from "../storage/workspace";
import { ImportProjectButton } from "./ProjectBar";

export function LocalProjectsPanel({ workspace, onContinue }: { workspace: LocalWorkspace; onContinue: () => void }) {
  const [query, setQuery] = useState("");
  const [versions, setVersions] = useState(false);
  const [diff, setDiff] = useState("");
  const searchQuery = query.trim().toLowerCase();
  const visible = workspace.projects.filter(
    (p) => (versions ? p.kind === "checkpoint" : p.kind === "project") && p.title.toLowerCase().includes(searchQuery)
  );
  const compare = async (item: LocalProjectInfo) => {
    try {
      const active = await workspace.flush();
      const past = await workspace.read(item.id);
      if (!past) throw new Error("Контрольная точка не найдена");
      const d = compareDocuments(past.snapshot, active.snapshot);
      setDiff(
        `От «${item.title}» до текущей работы: добавлено ${d.added.length}, удалено ${d.removed.length}, перемещено ${d.moved.length}, изменено ${d.changed.length}. ${d.parametersChanged || d.rowsChanged ? "Параметры или число рядов изменены." : "Параметры и число рядов совпадают."} Это сравнение деталей одной рабочей версии, не оценка прочности.`
      );
    } catch (e) {
      setDiff(e instanceof Error ? e.message : "Сравнение недоступно");
    }
  };
  return (
    <section className="local-library">
      <header>
        <div>
          <h2>На этом устройстве</h2>
          <p>Работа без входа и сети · исходные шаблоны отдельно</p>
        </div>
        <ImportProjectButton workspace={workspace} />
      </header>
      {workspace.info && (
        <button type="button" className="studio-primary" onClick={onContinue}>
          Продолжить: {workspace.info.title}
        </button>
      )}
      <div className="local-library-filters">
        <label>
          Поиск{" "}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Название проекта"
          />
        </label>
        <button type="button" aria-pressed={!versions} onClick={() => setVersions(false)}>
          Мои работы
        </button>
        <button type="button" aria-pressed={versions} onClick={() => setVersions(true)}>
          Восстановление и версии
        </button>
      </div>
      {workspace.error && <p role="alert">{workspace.error}</p>}
      <p className="studio-muted">
        Новые изменения сверху. Перед открытием другой работы сохраняется точка восстановления.
      </p>
      <output aria-live="polite" aria-atomic="true">
        {diff && <span className="local-diff">{diff}</span>}
      </output>
      <output aria-live="polite">
        {!workspace.ready
          ? "Открываю локальную библиотеку…"
          : !visible.length
            ? searchQuery
              ? "По вашему запросу ничего не найдено. Попробуйте другое название."
              : `Пока нет ${versions ? "контрольных точек" : "проектов"}.`
            : searchQuery
              ? `Найдено: ${visible.length}.`
              : ""}
      </output>
      <ul>
        {visible.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <small>
                Рев. {item.revision} · {new Date(item.updatedAt).toLocaleString("ru-RU")}{" "}
                {item.id === workspace.info?.id ? "· открыто" : ""}
              </small>
            </div>
            {item.parentId === workspace.info?.id && (
              <button type="button" aria-label={`Сравнить: ${item.title}`} onClick={() => compare(item)}>
                Сравнить
              </button>
            )}
            <button
              type="button"
              disabled={workspace.busy}
              aria-label={`${item.kind === "checkpoint" ? "Восстановить копию" : "Открыть"}: ${item.title}`}
              onClick={() => (item.id === workspace.info?.id ? onContinue() : workspace.open(item))}
            >
              {item.kind === "checkpoint" ? "Восстановить копию" : "Открыть"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
