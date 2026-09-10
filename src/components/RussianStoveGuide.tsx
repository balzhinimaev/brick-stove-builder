import type { Locale } from "../i18n";
import type { PlacedBrick } from "../domain/types";
import {
  TEPLUSHKA_MODES,
  type TeplushkaDamperIds,
  type TeplushkaInspection,
  type TeplushkaMode,
  type TeplushkaSection
} from "./builder/teplushkaInspection";

const SOURCE = "https://kirpichiki.pro/assets/files/books/podgorodnikov_1992.pdf";

/** Source course groups, not horizontal slices through the vault. */
export const RUSSIAN_COURSES = [
  [1, 1, "Сплошное основание", "Solid base", "Vientisas pagrindas", 41],
  [
    2,
    5,
    "Нижний колпак, опоры, зольники, прочистки и низ трубы",
    "Lower bell, supports, ash boxes, cleanouts and chimney foot",
    "Apatinis gaubtas, atramos, peleninės, valymo angos ir kamino apačia",
    41
  ],
  [
    6,
    9,
    "Сообщающиеся топки дровяного варианта и колосники",
    "Communicating wood-fired combustion spaces and grates",
    "Sujungtos malkų pakuros ir grotelės",
    41
  ],
  [
    10,
    11,
    "Под, плита, шесть параллельных опускных отверстий",
    "Hearth, hob and six parallel downward openings",
    "Padas, viryklė ir šešios lygiagrečios leidimosi angos",
    41
  ],
  [
    12,
    12,
    "Подъём в горнило и летняя задвижка",
    "Riser into cooking bell and summer bypass gate",
    "Pakilimas į virimo kamerą ir vasaros sklendė",
    41
  ],
  [
    13,
    14,
    "Горнило, устье и отделённая труба",
    "Cooking chamber, mouth and separated chimney",
    "Virimo kamera, anga ir atskirtas kaminas",
    42
  ],
  [
    15,
    18,
    "Клинчатый свод горнила и дымосборник над шестком",
    "Voussoir cooking-chamber vault and front fume hood",
    "Pleištinis kameros skliautas ir priekinis dūmų gaubtas",
    42
  ],
  [
    19,
    21,
    "Перекрытие свода и тёплая площадка",
    "Vault covering and warm roof deck",
    "Skliauto uždengimas ir šilta viršutinė aikštelė",
    42
  ],
  [
    22,
    24,
    "Основное закрытие трубы и отдельная вытяжная задвижка",
    "Main chimney closure and independent hood gate",
    "Pagrindinė kamino ir atskira gaubto sklendės",
    42
  ],
  [25, 26, "Сборная часть трубы", "Chimney gathering section", "Kamino surinkimo dalis", 42],
  [
    27,
    33,
    "Переход к верхнему сечению трубы",
    "Transition into the upper chimney throat",
    "Perėjimas į viršutinę kamino angą",
    43
  ]
] as const;

const COPY = {
  ru: {
    title: "Теплушка-15 · устройство и осмотр",
    intro:
      "И. С. Подгородников, 129×129 см, дровяной вариант с трубой слева у шестка. Два колпака: верхнее горнило → нижняя отопительная камера. Шесть отверстий в поду работают параллельно — это не шесть последовательных оборотов.",
    scope:
      "Реконструкция для осмотра в редакторе, не проект строительства. Тёплая верхняя площадка не является полноразмерной лежанкой. Модель не рассчитывает тягу, нагрев и прочность.",
    source: "Авторская порядовка: рис. 30–33, страницы PDF 39–43",
    modes: "Положение задвижек в копии",
    winter: "Зимний ход",
    summer: "Летний ход",
    ventilation: "Вытяжка · без огня",
    custom: "Свой режим",
    missing: "Набор задвижек изменён: готовые режимы недоступны. Кладка и ваши правки сохранены.",
    edited:
      "Показаны фактические положения задвижек этой копии. После редактирования схема путей может не соответствовать кладке.",
    changes:
      "Переключение меняет задвижки в проекте; его можно отменить через ↶. Это не инструкция по эксплуатации реальной печи.",
    winterPath:
      "Общие топки → подъём справа спереди → верхнее горнило → 6 параллельных опусков → нижний колпак → нижние входы в трубу слева спереди.",
    summerPath:
      "Общие топки → верхнее горнило → открытый летний обход → труба. Нижний колпак не обязателен для этого пути; модель не вычисляет распределение потока.",
    ventilationPath:
      "Устье и пространство над шестком → вытяжная задвижка → труба выше основного закрытия. Это отдельная ветвь вытяжки, не третий отопительный колпак.",
    route: "Путь по авторской схеме, не симуляция дыма",
    main: "Основная",
    bypass: "Летняя",
    hood: "Вытяжная",
    mouth: "Устье",
    opened: "открыта",
    closed: "закрыта",
    section: "Разрез модели",
    whole: "Целиком",
    front: "От передней стенки",
    side: "Сбоку",
    depth: "Глубина разреза",
    cutHint:
      "Разрез только скрывает геометрию на экране, не удаляя кирпичи. Орбитой осмотрите камеры; номера рядов относятся к кладке, а не к высоте среза свода.",
    courses: "Ряды по источнику",
    course: "Показать ряд",
    page: "стр. PDF"
  },
  en: {
    title: "Teplushka-15 · layout and inspection",
    intro:
      "I. S. Podgorodnikov, 129×129 cm, wood-fired version with the chimney at the front left. Two bells: upper cooking chamber → lower heating chamber. Six hearth openings run in parallel, not six consecutive smoke turns.",
    scope:
      "An editor reconstruction for inspection, not a construction design. The warm roof is not a full-length sleeping bench. The model does not calculate draft, heat transfer or structural strength.",
    source: "Original course drawings: Figures 30–33, PDF pages 39–43",
    modes: "Damper positions in this copy",
    winter: "Winter route",
    summer: "Summer bypass",
    ventilation: "Ventilation · no fire",
    custom: "Custom setting",
    missing: "The damper set has changed: presets are unavailable. Your masonry and edits are preserved.",
    edited:
      "These are this copy’s actual damper positions. After editing, explanatory routes may no longer match the masonry.",
    changes:
      "Switching changes stored dampers and can be undone with ↶. These controls are not operating instructions for a real stove.",
    winterPath:
      "Shared fireboxes → front-right riser → upper cooking bell → 6 parallel descents → lower bell → low chimney inlets at the front left.",
    summerPath:
      "Shared fireboxes → upper cooking bell → open summer bypass → chimney. This route does not require the lower bell; the model does not calculate flow distribution.",
    ventilationPath:
      "Oven mouth and front hood → ventilation gate → chimney above the main closure. A separate ventilation branch, not a third heating bell.",
    route: "Source design route, not a smoke simulation",
    main: "Main",
    bypass: "Summer",
    hood: "Hood",
    mouth: "Mouth",
    opened: "open",
    closed: "closed",
    section: "Model cutaway",
    whole: "Whole",
    front: "From front wall",
    side: "From side",
    depth: "Cutaway depth",
    cutHint:
      "Cutaway only hides rendered geometry; no bricks are removed. Orbit to inspect the chambers. Course numbers describe masonry, not the vault’s horizontal slice height.",
    courses: "Source course guide",
    course: "Show course",
    page: "PDF p."
  },
  lt: {
    title: "Tepluška-15 · sandara ir apžiūra",
    intro:
      "I. S. Podgorodnikovo 129×129 cm malkinė versija su kaminu priekyje kairėje. Du gaubtai: viršutinė virimo kamera → apatinė šildymo kamera. Šešios pado angos veikia lygiagrečiai, tai ne šeši nuoseklūs dūmų posūkiai.",
    scope:
      "Redaktoriaus rekonstrukcija apžiūrai, ne statybos projektas. Šilta viršutinė aikštelė nėra viso ilgio gultas. Modelis neskaičiuoja traukos, šilumos ar konstrukcijos stiprumo.",
    source: "Originalios eilės: 30–33 pav., PDF 39–43 psl.",
    modes: "Šios kopijos sklendės",
    winter: "Žiemos kelias",
    summer: "Vasaros apėjimas",
    ventilation: "Vėdinimas · be ugnies",
    custom: "Kita padėtis",
    missing: "Sklendžių rinkinys pakeistas: režimai nepasiekiami. Mūras ir pakeitimai išsaugoti.",
    edited: "Rodomos tikros šios kopijos sklendžių padėtys. Po redagavimo paaiškinimo keliai gali nebeatitikti mūro.",
    changes:
      "Režimas pakeičia projekto sklendes; veiksmą galima atšaukti su ↶. Tai nėra tikros krosnies naudojimo instrukcija.",
    winterPath:
      "Sujungtos pakuros → pakilimas priekyje dešinėje → viršutinis gaubtas → 6 lygiagretūs nusileidimai → apatinis gaubtas → žemos kamino angos priekyje kairėje.",
    summerPath:
      "Sujungtos pakuros → viršutinis gaubtas → atviras vasaros apėjimas → kaminas. Šiam keliui apatinis gaubtas nebūtinas; srautų pasiskirstymas neskaičiuojamas.",
    ventilationPath:
      "Krosnies anga ir priekinis gaubtas → vėdinimo sklendė → kaminas virš pagrindinės sklendės. Atskira vėdinimo šaka, ne trečias šildymo gaubtas.",
    route: "Kelias pagal šaltinį, ne dūmų simuliacija",
    main: "Pagrindinė",
    bypass: "Vasaros",
    hood: "Gaubto",
    mouth: "Angos",
    opened: "atidaryta",
    closed: "uždaryta",
    section: "Modelio pjūvis",
    whole: "Visas",
    front: "Nuo priekinės sienos",
    side: "Iš šono",
    depth: "Pjūvio gylis",
    cutHint:
      "Pjūvis tik paslepia vaizdo geometriją, nepašalina plytų. Sukite kamerą ertmėms apžiūrėti. Eilių numeriai nėra skliauto horizontalaus pjūvio aukštis.",
    courses: "Eilės pagal šaltinį",
    course: "Rodyti eilę",
    page: "PDF p."
  }
};

export type RussianStoveInspectionProps = {
  mode: TeplushkaMode | null;
  gates: Record<keyof TeplushkaDamperIds, PlacedBrick | undefined>;
  complete: boolean;
  onMode: (mode: TeplushkaMode) => void;
  inspection: TeplushkaInspection;
  onInspection: (value: TeplushkaInspection) => void;
  currentRow: number;
  onCourse: (row: number) => void;
};

export function RussianStoveGuide({ locale, controls }: { locale: Locale; controls?: RussianStoveInspectionProps }) {
  const copy = COPY[locale];
  const column = locale === "ru" ? 2 : locale === "en" ? 3 : 4;
  return (
    <details
      data-testid="teplushka-guide"
      className="teplushka-guide max-h-[34dvh] shrink-0 overflow-y-auto rounded-xl border border-[#A6472A]/20 bg-[#FFF7E8] p-3 text-xs text-[#3D2B1F]"
    >
      <summary className="sticky top-0 z-10 cursor-pointer bg-[#FFF7E8] font-bold">{copy.title}</summary>
      <p className="my-2 font-semibold" data-testid="teplushka-source-badge">
        {copy.intro}
      </p>
      {controls && (
        <>
          <fieldset className="teplushka-controls" aria-label={copy.modes}>
            <legend>{copy.modes}</legend>
            <div className="teplushka-buttons">
              {TEPLUSHKA_MODES.map((mode) => (
                <button
                  key={mode}
                  data-testid={`teplushka-mode-${mode}`}
                  type="button"
                  disabled={!controls.complete}
                  aria-pressed={controls.mode === mode}
                  onClick={() => controls.onMode(mode)}
                >
                  {copy[mode]}
                </button>
              ))}
            </div>
            <output className="teplushka-gates" aria-live="polite" data-testid="teplushka-damper-states">
              {!controls.complete ? copy.missing : !controls.mode ? `${copy.custom} · ` : ""}
              {controls.complete &&
                (["main", "summer", "hood", "mouth"] as const).map((role) => {
                  const value = controls.gates[role]?.damperOpen ?? 0;
                  return (
                    <span key={role} data-damper-role={role} data-opening={value}>
                      {copy[role === "summer" ? "bypass" : role]}:{" "}
                      {value === 1 ? copy.opened : value === 0 ? copy.closed : `${Math.round(value * 100)}%`}
                    </span>
                  );
                })}
            </output>
          </fieldset>
          {controls.mode && (
            <p className="teplushka-route">
              <strong>{copy.route}</strong>
              <br />
              {copy[`${controls.mode}Path`]}
            </p>
          )}
          <fieldset className="teplushka-controls">
            <label className="teplushka-depth">
              {copy.section}
              <select
                data-testid="teplushka-section"
                aria-label={copy.section}
                value={controls.inspection.section}
                onChange={(event) =>
                  controls.onInspection({
                    ...controls.inspection,
                    section: event.currentTarget.value as TeplushkaSection
                  })
                }
              >
                {(["whole", "front", "side"] as TeplushkaSection[]).map((section) => (
                  <option key={section} value={section}>
                    {copy[section]}
                  </option>
                ))}
              </select>
            </label>
            {controls.inspection.section !== "whole" && (
              <label className="teplushka-depth">
                {copy.depth}
                <input
                  aria-label={copy.depth}
                  type="range"
                  min="0.05"
                  max="0.95"
                  step="0.01"
                  value={controls.inspection.fraction}
                  onChange={(event) =>
                    controls.onInspection({ ...controls.inspection, fraction: event.currentTarget.valueAsNumber })
                  }
                />
                <output>{Math.round(controls.inspection.fraction * 100)}%</output>
              </label>
            )}
          </fieldset>
          <p className="my-2">{copy.cutHint}</p>
          <p className="my-2">
            {copy.changes} {copy.edited}
          </p>
        </>
      )}
      <p className="my-2">{copy.scope}</p>
      <a className="font-semibold underline" href={`${SOURCE}#page=39`} target="_blank" rel="noreferrer">
        {copy.source}
      </a>
      <h4 className="my-2 font-bold">{copy.courses}</h4>
      <ol className="space-y-1">
        {RUSSIAN_COURSES.map((course) => (
          <li key={course[0]} className="teplushka-course">
            {controls ? (
              <button
                type="button"
                aria-label={`${copy.course} ${course[1]}`}
                aria-pressed={controls.currentRow >= course[0] && controls.currentRow <= course[1]}
                onClick={() => controls.onCourse(course[1])}
              >
                {course[0]}
                {course[1] !== course[0] ? `–${course[1]}` : ""}
              </button>
            ) : (
              <strong>
                {course[0]}
                {course[1] !== course[0] ? `–${course[1]}` : ""}
              </strong>
            )}
            <span>
              {course[column]}{" "}
              <a href={`${SOURCE}#page=${course[5]}`} target="_blank" rel="noreferrer" className="underline">
                {copy.page} {course[5]}
              </a>
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
