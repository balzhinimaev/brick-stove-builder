import type { Locale } from "../i18n";

const text = {
  title: ["Калькулятор-генератор порядовок", "Stove order calculator", "Krosnies eilių skaičiuoklė"],
  intro: [
    "Подбор из исходных схем без растягивания топки и каналов. Сейчас доступны две учебные реконструкции, не строительные проекты.",
    "Select a source layout without stretching its firebox or flues. Two reference reconstructions are available, not construction designs.",
    "Pasirinkite schemą nekeisdami pakuros ar kanalų. Galimos dvi mokomosios rekonstrukcijos, ne statybos projektai."
  ],
  examples: [
    "В полях — пример. Замените значениями своего дома.",
    "Fields contain example data. Enter your building data.",
    "Laukuose pateiktas pavyzdys. Įveskite savo namo duomenis."
  ],
  dimensions: ["1. Место установки", "1. Available space", "1. Montavimo vieta"],
  heat: ["2. Предварительные теплопотери", "2. Preliminary heat loss", "2. Preliminarūs šilumos nuostoliai"],
  ceilingHeightMm: ["Пол → потолок, мм", "Floor → ceiling, mm", "Grindys → lubos, mm"],
  firstCourseAboveFloorMm: [
    "Низ первого ряда над полом, мм",
    "First course above floor, mm",
    "Pirma eilė virš grindų, mm"
  ],
  requiredTopGapMm: ["Требуемый отступ сверху, мм", "Required top clearance, mm", "Reikalingas tarpas viršuje, mm"],
  availableWidthMm: ["Доступная ширина, мм", "Available width, mm", "Galimas plotis, mm"],
  availableDepthMm: ["Доступная глубина, мм", "Available depth, mm", "Galimas gylis, mm"],
  areaM2: ["Отапливаемая площадь, м²", "Heated floor area, m²", "Šildomas plotas, m²"],
  indoorC: ["Температура внутри, °C", "Indoor temperature, °C", "Vidaus temperatūra, °C"],
  outdoorC: [
    "Расчётная температура снаружи, °C",
    "Outdoor design temperature, °C",
    "Skaičiuojama lauko temperatūra, °C"
  ],
  transmissionWK: [
    "Теплопередача здания Hт = Σ(U×A), Вт/К",
    "Building transmission H = Σ(U×A), W/K",
    "Pastato šilumos perdavimas H = Σ(U×A), W/K"
  ],
  airChangesPerHour: ["Воздухообмен, 1/ч", "Air changes per hour", "Oro kaita per valandą"],
  heatHint: [
    "Hт берётся из расчёта стен, окон, пола, крыши и мостиков холода — без вентиляции. Вентиляция добавляется отдельно: 0,33 × n × V × ΔT. Это оценка нагрузки, не мощности выбранной модели.",
    "H comes from walls, windows, floor, roof and thermal bridges, excluding ventilation. Ventilation adds 0.33 × n × V × ΔT. This estimates demand, not this model's output.",
    "H apskaičiuojamas iš sienų, langų, grindų, stogo ir šilumos tiltelių be vėdinimo. Vėdinimas prideda 0,33 × n × V × ΔT. Tai poreikis, ne modelio galia."
  ],
  clearanceHint: [
    "Отступ задаётся по проекту установки. 350 мм — только пример для периодической топки, трёхрядной перекрыши и незащищённого горючего потолка (СП 7.13130, п.5.18). Это НЕ разделка трубы. Габарит модели включает показанный участок трубы; проверка консервативная.",
    "Clearance must come from the site design. 350 mm is only an example for periodic firing, a three-course cap and an unprotected combustible ceiling (SP 7.13130, 5.18); it is NOT the chimney penetration clearance. The model envelope includes its pipe stub: this is conservative screening.",
    "Tarpas nustatomas pagal montavimo projektą. 350 mm yra tik periodinio kūrenimo, trijų eilių perdangos ir neapsaugotų degių lubų pavyzdys (SP 7.13130, 5.18), ne dūmtraukio pravedimo tarpas. Modelio matmenys apima vamzdį; patikra konservatyvi."
  ],
  load: ["Расчётная нагрузка", "Estimated heating demand", "Apskaičiuotas šilumos poreikis"],
  kw: ["кВт", "kW", "kW"],
  schemes: ["3. Исходные схемы", "3. Source layouts", "3. Pradinės schemos"],
  excluded: [
    "ПОВ-3500 исключена: обнаружены ошибки газового тракта.",
    "POV-3500 is excluded: its gas-path reconstruction is defective.",
    "POV-3500 neįtraukta: nustatyti dujų kanalų trūkumai."
  ],
  size: ["Габарит модели", "Model envelope", "Modelio matmenys"],
  gap: ["Остаётся сверху", "Remaining top space", "Liekantis tarpas viršuje"],
  compatible: ["Вписывается по введённым размерам", "Fits the entered dimensions", "Atitinka įvestus matmenis"],
  incompatible: ["Не вписывается / неверные данные", "Does not fit / invalid input", "Netelpa / neteisingi duomenys"],
  construction: [
    "Утверждённых строительных схем в генераторе пока нет. Тепловая мощность, тяга, основание и привязка к дому требуют отдельной проверки. Подбор не подтверждает пригодность для кладки.",
    "No construction-approved recipes are registered yet. Heat output, draft, foundation and site layout need separate verification. Selection does not approve construction.",
    "Patvirtintų statybos schemų dar nėra. Galia, trauka, pamatas ir montavimas tikrinami atskirai. Parinkimas nepatvirtina tinkamumo statybai."
  ],
  download: [
    "Скачать расчёт и порядовку (JSON)",
    "Download calculation and order (JSON)",
    "Atsisiųsti skaičiavimą ir eiles (JSON)"
  ],
  csv: ["Ведомость деталей (CSV)", "Parts schedule (CSV)", "Detalių sąrašas (CSV)"],
  sheet: [
    "Чертежи сечений для печати / PDF (HTML)",
    "Printable sections / PDF (HTML)",
    "Pjūvių brėžiniai spausdinimui / PDF (HTML)"
  ],
  open: ["Открыть учебную копию в 3D", "Open reference copy in 3D", "Atidaryti mokomąją 3D kopiją"],
  replace: [
    "Открыть расчётную копию вместо текущего черновика? Сначала сохраните нужные изменения.",
    "Replace the current draft with the calculator copy? Save any needed changes first.",
    "Pakeisti dabartinį juodraštį skaičiuoklės kopija? Pirmiausia išsaugokite pakeitimus."
  ],
  rows: ["рядов", "courses", "eilių"],
  pieces: ["деталей модели", "model parts", "modelio detalių"],
  preserved: [
    "Каналы, кирпичи, ряды и арматура не масштабируются. Открытие — отдельная копия; исходные примеры не изменяются.",
    "Flues, bricks, courses and hardware are not scaled. Opening creates a copy; original examples remain unchanged.",
    "Kanalai, plytos, eilės ir armatūra nekeičiami. Atidaroma kopija, originalai lieka nepakitę."
  ],
  "invalid-input": [
    "Заполните числовые поля в допустимых пределах.",
    "Enter finite numbers within the allowed ranges.",
    "Įveskite skaičius leistinose ribose."
  ],
  "invalid-temperature": [
    "Наружная температура должна быть ниже внутренней.",
    "Outdoor temperature must be below indoor temperature.",
    "Lauko temperatūra turi būti žemesnė už vidaus."
  ],
  width: ["Недостаточная ширина площадки.", "Insufficient width.", "Nepakankamas plotis."],
  depth: ["Недостаточная глубина площадки.", "Insufficient depth.", "Nepakankamas gylis."],
  ceiling: [
    "Недостаточно места над моделью для заданного отступа.",
    "Insufficient space above the model for the entered clearance.",
    "Nepakanka vietos virš modelio nurodytam tarpui."
  ],
  "output-unverified": [
    "Мощность реконструкции не подтверждена; соответствие теплопотерям не установлено.",
    "Reconstruction output is unverified; a heating-demand match is not established.",
    "Rekonstrukcijos galia nepatvirtinta; atitiktis šilumos poreikiui nenustatyta."
  ],
  "site-design-required": [
    "Основание, дымоход и противопожарная привязка не рассчитаны.",
    "Foundation, chimney and site fire clearances are not designed.",
    "Pamatas, dūmtraukis ir priešgaisriniai atstumai neapskaičiuoti."
  ],
  "reference-only": ["Только учебная реконструкция.", "Reference reconstruction only.", "Tik mokomoji rekonstrukcija."],
  fail: [
    "Не удалось сформировать копию. Проверьте параметры.",
    "Could not generate a copy. Check the parameters.",
    "Nepavyko sukurti kopijos. Patikrinkite parametrus."
  ]
} as const;

export function calculatorText(locale: Locale) {
  const index = locale === "ru" ? 0 : locale === "en" ? 1 : 2;
  return (key: keyof typeof text) => text[key][index];
}
