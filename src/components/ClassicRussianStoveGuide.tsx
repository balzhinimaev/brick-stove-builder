import type { Locale } from "../i18n";
export function ClassicRussianStoveGuide({ locale }: { locale: Locale }) {
  const ru = locale === "ru";
  return (
    <details className="m-3 rounded-[18px] bg-[#FFF7E8] p-3 text-sm">
      <summary className="cursor-pointer font-black">
        {ru ? "Об этой русской печи и источнике" : "About this Russian oven and its source"}
      </summary>
      <p className="mt-2">
        {ru
          ? "А. Е. Школьник, «Печное отопление малоэтажных зданий», 2-е изд., 1991, §63, рис. 123–125 (с. 112–117). ПР-3500В: классическое горнило над холодным подпечьем, отдельная плита в шестке, коренная труба и один верхний дымооборот. Это не «Теплушка»."
          : "A. E. Shkolnik, Stove Heating of Low-rise Buildings, 2nd ed., 1991, §63, figs. 123–125, pp. 112–117. PR-3500V: classical hearth above cold storage, separate hob, rooted chimney and one upper smoke circuit; not a Teplushka."}
      </p>
      <p className="mt-2">
        {ru
          ? "В книге: корпус 1200×2000 мм, плита 710×400 мм. В модели: 35 рядов с трубой; кладка, радиусы сводов, монтажные пазы и часть стальных опор интерполированы под шаг 70 мм. Это учебная реконструкция, не рабочая порядовка для строительства и не расчёт прочности или тяги."
          : "Source: 1200×2000 mm body and 710×400 mm hob. Model: 35 courses including chimney; bonding, vault radii, gate slots and some steel supports interpolated onto 70 mm courses. An educational reconstruction, not construction drawings or a structural/draft calculation."}
      </p>
      <p className="mt-2">
        {ru
          ? "Для сборки выберите «Арки и своды» над 3D-сценой: отдельный узел, опоры, кружало, пары кирпичей и замок. Номера выбирают реальные детали; просмотр не меняет проект. Для общего просмотра: ряды 4–10 — подпечья и плита; 11–22 — горнило; 28–30 — верхний дымооборот."
          : "Use the arch assembly selector above the 3D scene (Russian educational labels): isolated supports, timber centering, paired bricks and locks. Numbers select actual parts without editing the project. Inspect rows 4–10 for underovens and hob, 11–22 for the hearth, 28–30 for the upper circuit."}
      </p>
      <a
        className="mt-2 inline-block underline"
        href="https://sam-stroy.info/tmp/pechi/pechnoe-otoplenie-maloetagnyh-zdanij.pdf#page=113"
        target="_blank"
        rel="noreferrer"
      >
        {ru ? "Оригинальная книга · §63" : "Original book · §63"}
      </a>
    </details>
  );
}
