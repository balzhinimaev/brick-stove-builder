import type { Locale } from "../i18n";

export const RUSSIAN_COURSES = [
  [1, 2, "Сплошное основание", "Solid base", "Pagrindas"],
  [
    3,
    3,
    "Сплошная опора пода и основание топки плиты",
    "Solid hearth support and hob firebox base",
    "Pado atrama ir pakuros pagrindas"
  ],
  [4, 5, "Зольник, поддувальная дверца и колосник", "Ash chamber, ash door and grate", "Peleninė ir grotelės"],
  [6, 9, "Отдельная топка плиты и топочная дверца", "Separate hob firebox and fire door", "Atskira viryklės pakura"],
  [
    10,
    11,
    "Выход топки в боковой дымовой канал; опора пода",
    "Firebox outlet into side flue; hearth support",
    "Pakuros išėjimas į šoninį dūmtakį"
  ],
  [12, 12, "Шамотный под и плита в четвертях", "Firebrick hearth and rebated hob", "Šamotinis padas ir viryklė"],
  [
    13,
    18,
    "Горнило, открытое устье и боковой канал плиты",
    "Cooking chamber, open mouth and separate hob flue",
    "Kamera, anga ir atskiras viryklės dūmtakis"
  ],
  [
    19,
    20,
    "Ступенчатое перекрытие устья и опоры дымосборника",
    "Corbelled mouth head and hood supports",
    "Laiptuotas angos viršus ir gaubto atramos"
  ],
  [21, 25, "Условный ступенчатый свод и дымосборник", "Schematic stepped vault and smoke hood", "Sąlyginis skliautas"],
  [26, 36, "Труба; условная задвижка в ряду 29", "Chimney; schematic damper at course 29", "Kaminas; sklendė 29 eilėje"]
] as const;

export function RussianStoveGuide({ locale }: { locale: Locale }) {
  const column = locale === "ru" ? 2 : locale === "en" ? 3 : 4;
  return (
    <details className="max-h-[30dvh] shrink-0 overflow-y-auto rounded-xl border border-[#A6472A]/20 bg-[#FFF7E8] p-3 text-xs text-[#3D2B1F]">
      <summary className="cursor-pointer font-bold">
        {locale === "ru"
          ? "Демо · Русская печь: устройство и ряды"
          : locale === "en"
            ? "Demo · Russian stove: course guide"
            : "Demo · Krosnies eilės"}
      </summary>
      <p className="my-2 font-semibold">
        {locale === "ru"
          ? "Модель 150×200 см; 36 рядов × 70 мм ≈ 252 см без основания. Плита 625×375 мм. Не строительная порядовка: свод условный, газовый тракт и опоры не рассчитаны. Нужен проект печника для строительства."
          : locale === "en"
            ? "Model: 150×200 cm; 36 courses × 70 mm ≈ 252 cm excluding base. Hob: 625×375 mm. Not a construction plan: schematic vault, uncalculated flues and supports. A professional construction design is required."
            : "Modelis: 150×200 cm, 36 eilės, apie 252 cm be pagrindo. Viryklė: 625×375 mm. Ne statybos planas: sąlyginis skliautas, neapskaičiuoti dūmtakiai ir atramos."}
      </p>
      <ol className="space-y-1">
        {RUSSIAN_COURSES.map((course) => (
          <li key={course[0]}>
            <strong>
              {course[0]}
              {course[1] !== course[0] ? `–${course[1]}` : ""}
            </strong>{" "}
            · {course[column]}
          </li>
        ))}
      </ol>
    </details>
  );
}
