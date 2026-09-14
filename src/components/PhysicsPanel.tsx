import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_PHYSICS, type BearingIssue, type PhysicsSettings } from "../domain/physics/model";
import { usePhysics } from "../hooks/usePhysics";
import type { PhysicsReviewProps } from "./PhysicsReview";

const PhysicsScene = lazy(() => import("./three/PhysicsScene").then((module) => ({ default: module.PhysicsScene })));
export const BEARING_LABELS: Record<BearingIssue, string> = {
  disconnected: "Нет связи с основанием",
  inclined: "Наклонные контакты / свод",
  "no-bed": "Нет горизонтальной опоры",
  eccentric: "Нагрузка вне контура опоры",
  "small-bed": "Малая площадь опирания",
  overlap: "Пересечение деталей",
  "blocked-joint": "Зазор под шов занят геометрией"
};
const n = (value: number, digits = 1) => value.toLocaleString("ru-RU", { maximumFractionDigits: digits });

export function PhysicsPanel({ bricks, grid, rowCount, onSelect, active = true }: PhysicsReviewProps) {
  const [settings, setSettings] = useState<PhysicsSettings>(() => ({
    ...DEFAULT_PHYSICS,
    throughRow: Math.min(5, rowCount),
    heldIds: []
  }));
  const [applied, setApplied] = useState(settings);
  const pending = JSON.stringify(settings) !== JSON.stringify(applied);
  // A hidden experiment keeps its paused world; edits invalidate it on reopening, not on every hidden keystroke.
  const retainedInput = useRef({ bricks, grid, settings: applied });
  if (active) retainedInput.current = { bricks, grid, settings: applied };
  const { model, frame, running, status, error, send, elapsedMs } = usePhysics(
    retainedInput.current.bricks,
    retainedInput.current.grid,
    retainedInput.current.settings
  );
  useEffect(() => {
    if (!active) send("pause");
  }, [active, send]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("issues");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [colorMode, setColorMode] = useState<"motion" | "load" | "bearing">("bearing");
  const list = useMemo(
    () =>
      model?.bodies
        .map((b, i) => ({ body: b, bearing: model.bearings[i], i }))
        .filter(({ body, bearing, i }) => {
          const text = `${body.id} ${body.name} ${body.row}`.toLowerCase();
          if (!text.includes(query.toLowerCase())) return false;
          if (filter === "issues") return bearing.issues.some((issue) => issue !== "inclined");
          if (filter === "inclined") return bearing.issues.includes("inclined");
          if (filter === "moved") return (frame?.displacementsMm[i] ?? 0) > 2 || (frame?.rotationsDeg[i] ?? 0) > 1;
          if (filter === "held") return body.held && !frame?.released;
          return true;
        }) ?? [],
    [model, query, filter, frame]
  );
  const index = model?.bodies.findIndex((b) => b.id === selected) ?? -1;
  const body = model?.bodies[index],
    bearing = model?.bearings[index];
  const busy = !!status || !model;
  const choose = (id: string) => {
    setSelected(id);
    const b = model?.bodies.find((b) => b.id === id);
    if (b) onSelect?.([id], b.row);
  };
  const patch = (value: Partial<PhysicsSettings>) => setSettings((s) => ({ ...s, ...value }));
  const exportReport = () => {
    if (!model) return;
    const report = {
      format: "stove-gravity-review-v1",
      settings: model.settings,
      assumptions: [
        "Rigid noncohesive contacts; no tensile strength",
        "Paired mortar half-beds have zero added mass",
        "Density values are editable assumptions",
        "Area-weighted vertical load screening stops at inclined contacts",
        "Foundation fixed; heldIds are fully fixed until released",
        "No temperature, fracture, soil or beam deflection calculation"
      ],
      contactInsetMm: 0.01,
      totalMassKg: model.totalMassKg,
      foundationN: model.foundationN,
      heldN: model.heldN,
      unresolvedN: model.unresolvedN,
      overlaps: model.overlapPairs,
      blockedJoints: model.blockedJoints,
      bearings: model.bearings,
      bodies: model.bodies.map(({ shapes: _shapes, ...body }) => body),
      simulation: frame
        ? {
            time: frame.time,
            released: frame.released,
            maxSpeedMmS: frame.maxSpeedMmS,
            displacementsMm: Array.from(frame.displacementsMm),
            rotationsDeg: Array.from(frame.rotationsDeg),
            supportReactionN: frame.supportReactionN,
            activeContacts: frame.activeContacts,
            mechanicalEnergyChangeJ: frame.mechanicalEnergyChangeJ,
            energyToleranceJ: frame.energyToleranceJ
          }
        : null
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "stove-gravity-review.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="physics-panel">
      <header className="physics-heading">
        <div>
          <span className="physics-eyebrow">ВЕС · ОПОРЫ · ДВИЖЕНИЕ</span>
          <h3>Как кладка держит свой вес</h3>
          <p>Геометрическая проверка и эксперимент с жёсткими телами. Изменения не попадают в проект.</p>
        </div>
        <button type="button" onClick={exportReport} disabled={!model}>
          Отчёт JSON ↗
        </button>
      </header>
      <div className="physics-settings">
        <label>
          Выложено рядов
          <select value={settings.throughRow} onChange={(e) => patch({ throughRow: Number(e.target.value) })}>
            {Array.from({ length: rowCount }, (_, i) => i + 1).map((row) => (
              <option key={row} value={row}>
                {row}
                {row === rowCount ? " · вся модель" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Модель шва
          <select
            value={settings.joints}
            onChange={(e) => patch({ joints: e.target.value as PhysicsSettings["joints"] })}
          >
            <option value="paired">Парные швы без растяжения</option>
            <option value="dry">Пустые швы · просадка зазоров</option>
          </select>
        </label>
        <label>
          Трение μ
          <input
            type="number"
            min="0"
            max="1.5"
            step="0.1"
            value={settings.friction}
            onChange={(e) => {
              if (Number.isFinite(e.target.valueAsNumber)) patch({ friction: e.target.valueAsNumber });
            }}
          />
        </label>
        <label>
          Шов до, мм
          <input
            type="number"
            min="0"
            max="10"
            step="0.5"
            value={settings.jointMm}
            disabled={settings.joints === "dry"}
            onChange={(e) => {
              if (Number.isFinite(e.target.valueAsNumber)) patch({ jointMm: e.target.valueAsNumber });
            }}
          />
        </label>
      </div>
      <div className="physics-apply">
        <button type="button" disabled={!pending || running} onClick={() => setApplied(settings)}>
          Применить настройки и подготовить заново
        </button>
        <p>
          {pending
            ? "Настройки изменены. Результаты ниже относятся к предыдущим настройкам."
            : `Подготовлено рядов: ${applied.throughRow}. Начните с нижних рядов; опоры под ними сохраняются.`}
        </p>
      </div>
      <details className="physics-assumptions">
        <summary>Материалы и допущения расчёта</summary>
        <div className="physics-densities">
          {(
            [
              ["densityBrick", "Кирпич"],
              ["densityFirebrick", "Шамот"],
              ["densityMetal", "Металл"]
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}, кг/м³
              <input
                type="number"
                min="100"
                max="30000"
                step="50"
                value={settings[key]}
                onChange={(e) => {
                  if (Number.isFinite(e.target.valueAsNumber)) patch({ [key]: e.target.valueAsNumber });
                }}
              />
            </label>
          ))}
        </div>
        <p>
          Плотности и трение — начальные предположения, замените их данными материалов. g = 9,81 м/с². Масса раствора и
          основания не включена.
        </p>
        <p>
          Сложные контактные грани имеют внутренний численный отступ 0,01 мм; размеры проекта и расчёт массы не
          меняются. «Малая опора» — менее 30% площади габарита детали: это фильтр для осмотра, не строительная норма.
        </p>
        <p>
          Парные швы — жёсткие контактные прослойки только между гранями кладки на расстоянии до заданного шва.
          Сцепление и растяжение отсутствуют; сминаемость раствора не моделируется. Зазоры у металла не заполняются.
        </p>
        <p>
          Основание неподвижно. Кирпич с вырезами — одно тело; арматура — жёсткие сборки без расчёта крепежа. Временное
          закрепление удерживает деталь во всех направлениях, это не модель деревянного кружала. Блокировка ряда в
          редакторе не закрепляет его в физике.
        </p>
        <p>
          Вертикальные нагрузки распределены по площади горизонтальных контактов. У наклонных контактов расчёт
          останавливается: распор и взаимодействие свода исследуются в динамике. Это не полный статический расчёт.
          Температура, трещины, прочность и прогиб балок, грунт не учитываются.
        </p>
      </details>
      {status && (
        <output className="physics-status">
          {status} · {n(elapsedMs / 1000, 0)} с ожидания
        </output>
      )}
      {error && (
        <p role="alert" className="physics-error">
          {error}
        </p>
      )}
      {model && (
        <>
          <div className="physics-metrics">
            <div>
              <strong>{n(model.totalMassKg)}</strong>
              <span>кг · детали без раствора</span>
            </div>
            <div>
              <strong>{n(model.foundationN / 1000, 2)}</strong>
              <span>кН · прослежено до основания</span>
            </div>
            <div>
              <strong>{n(model.unresolvedN / 1000, 2)}</strong>
              <span>кН · не распределено простой схемой</span>
            </div>
            <div>
              <strong>{model.bearings.filter((b) => b.issues.includes("disconnected")).length}</strong>
              <span>деталей без связи с основанием / закреплениями</span>
            </div>
          </div>
          {model.heldN > 0 && (
            <p className="physics-note">
              Временные закрепления принимают {n(model.heldN / 1000, 2)} кН в исходной вертикальной схеме.
            </p>
          )}
          {!!model.blockedJoints.length && (
            <p className="physics-note">
              Не достроено швов: {model.blockedJoints.length}. Зазор занят арматурой или другой частью кирпича;
              геометрия сохранена, искусственная прослойка не добавлена. Эти узлы отмечены для проверки.
            </p>
          )}
          {model.overlapPairs.length > 0 && (
            <p className="physics-error">
              Пересечений: {model.overlapPairs.length}. Запуск остановлен, чтобы начальное пересечение не вызвало
              искусственный разлёт.
            </p>
          )}
          <div className="physics-toolbar">
            <button
              type="button"
              className="physics-primary"
              disabled={pending || busy || !!error || !!model.overlapPairs.length || (frame?.time ?? 0) >= 10}
              onClick={() => send(running ? "pause" : "run")}
            >
              {running ? "Ⅱ Пауза" : "▶ Гравитация"}
            </button>
            <button
              type="button"
              disabled={
                pending || busy || running || !!error || !!model.overlapPairs.length || (frame?.time ?? 0) >= 10
              }
              onClick={() => send("step")}
            >
              Один шаг
            </button>
            <button type="button" disabled={busy} onClick={() => send("reset")}>
              ↺ Сброс
            </button>
            <button
              type="button"
              disabled={
                pending ||
                busy ||
                !!error ||
                !!model.overlapPairs.length ||
                !model.bodies.some((b) => b.held) ||
                frame?.released
              }
              onClick={() => send("release")}
            >
              Освободить закреплённые
            </button>
            <label>
              Цвет
              <select value={colorMode} onChange={(e) => setColorMode(e.target.value as typeof colorMode)}>
                <option value="bearing">Замечания к опорам</option>
                <option value="load">Оценка вертикальной нагрузки</option>
                <option value="motion">Смещения и повороты</option>
              </select>
            </label>
          </div>
          <div className="physics-live" aria-live="off">
            <span>Вычисления: {n(elapsedMs / 1000, 1)} с реального времени</span>
            <span>{n(frame?.time ?? 0, 2)} / 10 с модели</span>
            <span>Смещение до {n(frame?.maxDisplacementMm ?? 0, 2)} мм</span>
            <span>Движутся: {frame?.moving ?? "—"}</span>
            <span>{frame ? `Скорость до ${n(frame.maxSpeedMmS)} мм/с` : "Исходная геометрия"}</span>
          </div>
          {frame?.supportReactionN != null && (
            <p className="physics-note">
              Общая вертикальная реакция основания и закреплений: {n(frame.supportReactionN / 1000, 2)} кН · по балансу
              движения, среднее до 0,1 с.
            </p>
          )}
          <p className="physics-note">
            {colorMode === "motion"
              ? "Серый — менее 0,5 мм и 0,25°; янтарный — до 2 мм и 1°; красный — больше. Голубой — выбранная деталь."
              : colorMode === "load"
                ? "От светлого к тёмному — рост оценочной вертикальной нагрузки. Наклонные контакты — янтарные: нагрузка не распределена."
                : "Красный — нет связи или есть пересечение; янтарный — требуется проверка; серый — перечисленных замечаний нет. Это не оценка прочности."}
            {frame?.released ? " Временные закрепления сняты." : " Фиолетовый — временно закреплено."}
          </p>
          <p className="physics-note">
            Смещение в эксперименте включает численную податливость контактов: миллиметры не равны реальной осадке. При
            нарушении баланса энергии расчёт останавливается. Полная печь считается медленнее небольшого узла; для
            быстрого опыта начните с нескольких нижних рядов.
          </p>
          <div className="physics-workspace">
            <div className="physics-canvas">
              <Suspense fallback={<output>Загрузка 3D…</output>}>
                <PhysicsScene model={model} frame={frame} selectedId={selected} mode={colorMode} onSelect={choose} />
              </Suspense>
            </div>
            <aside className="physics-detail">
              <h4>{body ? `Ряд ${body.row} · ${body.name}` : "Выберите деталь"}</h4>
              {body && bearing ? (
                <>
                  <p className="physics-id">{body.id}</p>
                  <dl>
                    <div>
                      <dt>Масса</dt>
                      <dd>{n(body.massKg, 3)} кг</dd>
                    </div>
                    <div>
                      <dt>Вес + учтено сверху</dt>
                      <dd>{n(bearing.loadN)} Н</dd>
                    </div>
                    <div>
                      <dt>Горизонтальная опора</dt>
                      <dd>{n(bearing.bedMm2 / 100)} см²</dd>
                    </div>
                    <div>
                      <dt>Среднее давление*</dt>
                      <dd>
                        {bearing.estimatedPressureMPa === null
                          ? "не определено"
                          : `${n(bearing.estimatedPressureMPa, 4)} МПа`}
                      </dd>
                    </div>
                    <div>
                      <dt>Смещение / поворот</dt>
                      <dd>
                        {n(frame?.displacementsMm[index] ?? 0, 2)} мм / {n(frame?.rotationsDeg[index] ?? 0, 2)}°
                      </dd>
                    </div>
                  </dl>
                  <p className="physics-note">
                    *Оценка по площади, не проверка прочности. Данные опор относятся к исходному положению.
                  </p>
                  {bearing.issues.map((issue) => (
                    <p className="physics-issue" key={issue}>
                      {BEARING_LABELS[issue]}
                    </p>
                  ))}
                  <button
                    type="button"
                    disabled={running || busy}
                    onClick={() =>
                      patch({
                        heldIds: settings.heldIds.includes(body.id)
                          ? settings.heldIds.filter((id) => id !== body.id)
                          : [...settings.heldIds, body.id]
                      })
                    }
                  >
                    {settings.heldIds.includes(body.id) ? "Убрать временное закрепление" : "Временно закрепить деталь"}
                  </button>
                  <h5>Опирается на</h5>
                  <div className="physics-links">
                    {bearing.supportIds.length ? (
                      bearing.supportIds.map((id) =>
                        id === "foundation" ? (
                          <span key={id}>Основание</span>
                        ) : (
                          <button type="button" key={id} onClick={() => choose(id)}>
                            {id}
                          </button>
                        )
                      )
                    ) : (
                      <span>Нет горизонтальной опоры</span>
                    )}
                  </div>
                  <h5>Держит сверху</h5>
                  <div className="physics-links">
                    {bearing.aboveIds.length ? (
                      bearing.aboveIds.map((id) => (
                        <button type="button" key={id} onClick={() => choose(id)}>
                          {id}
                        </button>
                      ))
                    ) : (
                      <span>Нет горизонтальных контактов сверху</span>
                    )}
                  </div>
                  <h5>Все соседи по контакту</h5>
                  <div className="physics-links">
                    {bearing.contactIds.map((id) => (
                      <button type="button" key={id} onClick={() => choose(id)}>
                        {id}
                      </button>
                    ))}
                  </div>
                  {frame && (
                    <>
                      <h5>Контакты в текущем положении</h5>
                      <p className="physics-note">
                        Соседи, взаимодействующие в симуляции. Силы отдельных контактов не оцениваются.
                      </p>
                      <ul>
                        {frame.activeContacts
                          .filter((c) => c.a === body.id || c.b === body.id)
                          .slice(0, 12)
                          .map((c) => (
                            <li key={`${c.a}/${c.b}`}>{c.a === body.id ? c.b : c.a}</li>
                          ))}
                      </ul>
                    </>
                  )}
                </>
              ) : (
                <p>Нажмите на деталь в 3D или в списке. Здесь появятся опоры, соседи, вес и результаты движения.</p>
              )}
            </aside>
          </div>
          <div className="physics-listbar">
            <label>
              Показать
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="issues">Замечания к опорам</option>
                <option value="inclined">Своды / наклонные контакты</option>
                <option value="moved">Сместившиеся детали</option>
                <option value="held">Временно закреплённые</option>
                <option value="all">Все детали</option>
              </select>
            </label>
            <label>
              Поиск по номеру, ряду или названию
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <span>{list.length} деталей</span>
          </div>
          <div className="physics-parts">
            {list
              .slice(
                Math.min(page, Math.max(0, Math.ceil(list.length / 40) - 1)) * 40,
                (Math.min(page, Math.max(0, Math.ceil(list.length / 40) - 1)) + 1) * 40
              )
              .map(({ body, bearing }) => (
                <button type="button" key={body.id} aria-pressed={selected === body.id} onClick={() => choose(body.id)}>
                  <strong>
                    Р{body.row} · {body.id}
                  </strong>
                  <span>{body.name}</span>
                  <small>
                    {bearing.issues.map((issue) => BEARING_LABELS[issue]).join(" · ") || "Нет перечисленных замечаний"}
                  </small>
                </button>
              ))}
            {!list.length && <p>В этой группе деталей нет.</p>}
          </div>
          {list.length > 40 && (
            <div className="physics-pagination">
              <button type="button" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
                ← Назад
              </button>
              <span>
                Страница {Math.min(page + 1, Math.ceil(list.length / 40))} / {Math.ceil(list.length / 40)}
              </span>
              <button type="button" disabled={(page + 1) * 40 >= list.length} onClick={() => setPage((p) => p + 1)}>
                Далее →
              </button>
            </div>
          )}
          <footer>
            Эксперимент ограничен 10 секундами модельного времени; тяжёлая модель может считаться медленнее. Пауза и
            сброс доступны. Отсутствие движения не подтверждает надёжность печи. Геометрия и сохранения не изменяются.
          </footer>
        </>
      )}
    </div>
  );
}
