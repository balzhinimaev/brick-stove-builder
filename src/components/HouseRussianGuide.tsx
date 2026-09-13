import { useMemo } from "react";
import {
  HOUSE_COURSES,
  HOUSE_HEAT,
  houseMassAndFoundation,
  rhsCheck,
  stackBuoyancyPa
} from "../domain/houseRussianDesign";
import { HOUSE_RUSSIAN_STOVE } from "../domain/houseRussianStove";
import type { ReadyProject } from "../domain/types";
import type { TeplushkaInspection } from "./builder/teplushkaInspection";

export type HouseGuideControls = {
  currentRow: number;
  house: boolean;
  inspection: TeplushkaInspection;
  onHouse: (value: boolean) => void;
  onCourse: (row: number) => void;
  onInspection: (value: TeplushkaInspection) => void;
  onGates: (openings: Record<string, number>) => void;
};
export function HouseRussianGuide({
  controls,
  project = HOUSE_RUSSIAN_STOVE
}: {
  controls?: HouseGuideControls;
  project?: Pick<ReadyProject, "rows" | "parameters" | "title">;
}) {
  const mass = useMemo(() => houseMassAndFoundation(project), [project]);
  const roof = rhsCheck(100, 50, 5, 940, 6),
    frame = rhsCheck(90, 50, 5, 1070, 12);
  return (
    <section className="house-design-guide" aria-label="Русская печь для дома 6 на 9">
      <header>
        <strong>{project.title.ru}</strong>
        <span>Корпус 2,025 м · потолок 2,50 м · труба 6,225 м</span>
      </header>
      <p>
        Новая низкая компоновка с плитой. Это проектная 3D-модель, не утверждённая порядовка для кладки. Высота и
        дымовые пути проверяются геометрически; мощность и работа при топке ещё не подтверждены.
      </p>
      {controls && (
        <div className="house-design-controls">
          <button type="button" aria-pressed={controls.house} onClick={() => controls.onHouse(!controls.house)}>
            Дом и фундамент · 3D
          </button>
          <label>
            Узел{" "}
            <select
              aria-label="Узел русской печи"
              value={HOUSE_COURSES.some((c) => c.row === controls.currentRow) ? controls.currentRow : ""}
              onChange={(e) => controls.onCourse(Number(e.target.value))}
            >
              <option value="" disabled>
                Ряд {controls.currentRow}
              </option>
              {HOUSE_COURSES.map((c) => (
                <option key={c.row} value={c.row}>
                  {c.row} · {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Разрез{" "}
            <select
              aria-label="Разрез русской печи"
              value={controls.inspection.section}
              onChange={(e) =>
                controls.onInspection({
                  section: e.target.value as TeplushkaInspection["section"],
                  fraction: controls.inspection.fraction,
                  courseOnly: true
                })
              }
            >
              <option value="whole">Без разреза</option>
              <option value="front">Поперёк</option>
              <option value="side">Вдоль</option>
            </select>
          </label>
          {controls.inspection.section !== "whole" && (
            <input
              aria-label="Глубина разреза"
              type="range"
              min="0.05"
              max="0.95"
              step="0.05"
              value={controls.inspection.fraction}
              onChange={(e) => controls.onInspection({ ...controls.inspection, fraction: Number(e.target.value) })}
            />
          )}
          <details>
            <summary>Задвижки в модели</summary>
            <p>
              Кнопки изменяют физические затворы и сохраняются в истории. Это просмотр схемы, не инструкция по топке.
            </p>
            <button
              type="button"
              onClick={() => controls.onGates({ "rp54-hob-gate": 0, "rp54-direct-gate": 0, "rp54-upper-loop-gate": 1 })}
            >
              Горнило → верхний дымооборот
            </button>
            <button
              type="button"
              onClick={() => controls.onGates({ "rp54-hob-gate": 0, "rp54-direct-gate": 1, "rp54-upper-loop-gate": 0 })}
            >
              Прямой ход
            </button>
            <button
              type="button"
              onClick={() => controls.onGates({ "rp54-hob-gate": 1, "rp54-direct-gate": 0, "rp54-upper-loop-gate": 0 })}
            >
              Отдельная топка плиты
            </button>
          </details>
        </div>
      )}
      <details>
        <summary>Дом, расчёты и границы проекта</summary>
        <h4>Принятый дом</h4>
        <p>
          6×9 м — внутренний размер, один открытый объём 54 м²; кухня и спальная зона без закрытых комнат. Печь в
          середине. Дрова, +20/−30 °C. Стены и потолок деревянные; толщина дерева 250 мм, четыре окна общей площадью 8
          м² и крыша 35° выбраны для расчёта, а не измерены.
        </p>
        <h4>Дымовой тракт</h4>
        <p>
          Это обычная русская печь: холодные подпечья, горнило и отдельная топка плиты. Нижнего отопительного колпака
          нет. Из горнила газы идут через устье в перетрубье, затем по правому, заднему и левому участкам верхнего
          П-образного канала в коренную трубу. Отдельные затворы показывают прямой обход и выход топки плиты.
        </p>
        <h4>Тепло</h4>
        <p>
          По сумме U·A и воздухообмену, с резервом 10%: {HOUSE_HEAT.proposed.designKw.toFixed(1)} кВт при принятом
          улучшении ограждений; {HOUSE_HEAT.uncertain.designKw.toFixed(1)}–{HOUSE_HEAT.weak.designKw.toFixed(1)} кВт в
          сценариях больших потерь. Это потребность дома, НЕ мощность этой печи.
        </p>
        <p>
          Первый сценарий требует негорючего утепления перекрытия до U≤0,20 Вт/(м²·К), пола до U≤0,35, окон до U≤1,2 и
          герметизации щелей. Нынешним мешкам с опилками и углём эти свойства не приписаны. Их в зоне трубы быть не
          должно.
        </p>
        <h4>Основание</h4>
        <p>
          Отдельное от дома основание: верхняя плита 2000×2300×350 мм, тумба 1900×2200×1500 мм и нижняя плита
          2000×2300×350 мм. Подошва −2,20 м. Для обеих плит предварительно выбраны бетон B25, две сетки A500C Ø12/150,
          защитный слой 50 мм; это не расчёт армирования и трещиностойкости.
        </p>
        <p>
          Модель кладки и металла с запасом на раствор ≈{(mass.modelKg / 1000).toFixed(1)} т; бетон ≈
          {mass.foundationM3.toFixed(2)} м³. Суммарно ≈{(mass.totalKg / 1000).toFixed(1)} т. Упрощённое давление с
          эксцентриситетом {mass.minKpa.toFixed(0)}–{mass.maxKpa.toFixed(0)} кПа против принятого R=150 кПа. Глубина
          промерзания ≤2,0 м, вода ниже 3,0 м и несущая способность — допущения. Осадка, пучение и грунт на участке не
          проверены.
        </p>
        <h4>Труба и потолок</h4>
        <p>
          Коренная кирпичная труба: канал 260×380 мм, наружный контур 500×620 мм, прочистка внизу и две прочистки
          верхнего дымооборота сзади. От колосника до оголовка ≈5,81 м. При газах +150 °C и воздухе −30 °C располагаемый
          гравитационный напор ≈{stackBuoyancyPa(150).toFixed(0)} Па ДО вычета сопротивлений. Холодный пуск, расход и
          температура газов не подтверждены — положительный баланс тяги не заявлен.
        </p>
        <p>
          Над корпусом 475 мм. В доме показана зона без горючих материалов 1260×1380 мм, отсчитанная по 500 мм от
          внутреннего канала. Это габарит для разработки разделки, не готовое решение креплений, балок, кровельного
          примыкания или проходного узла.
        </p>
        <h4>Опоры и сталь</h4>
        <p>
          Рама перетрубья RHS 90×50×5, четыре балки перекрыши RHS 100×50×5, стойки 40×40 на плитах 100×100×10. Для
          условных нагрузок 12 кН на раму и 6 кН на балку: напряжения ≈{frame.stressMpa.toFixed(0)}/
          {roof.stressMpa.toFixed(0)} МПа; прогибы ≈{frame.deflectionMm.toFixed(2)}/{roof.deflectionMm.toFixed(2)} мм
          при +20 °C. Нужны проверка нагретого состояния, расширения, сварных узлов и кладки; комнатный расчёт этого не
          заменяет.
        </p>
        <p>
          Источники принципов:{" "}
          <a
            href="https://sam-stroy.info/tmp/pechi/pechnoe-otoplenie-maloetagnyh-zdanij.pdf#page=113"
            target="_blank"
            rel="noreferrer"
          >
            Школьник, §63
          </a>
          ;{" "}
          <a href="https://29.mchs.gov.ru/deyatelnost/press-centr/novosti/2177683" target="_blank" rel="noreferrer">
            МЧС: печи и деревянные перекрытия
          </a>
          . Новые высоты, дымооборот и стальная рама — изменения R1, не авторская порядовка из книги.
        </p>
        <p>
          Расчёты относятся к исходной R1. Редактируемая копия не наследует их автоматически. Дом, глубокая часть
          фундамента и зона разделки — отдельная схема размещения, не кирпичи ведомости.
        </p>
      </details>
    </section>
  );
}
