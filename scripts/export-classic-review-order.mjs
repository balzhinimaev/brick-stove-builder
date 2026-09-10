/** Dimensioned review sheets of the CURRENT model. Never a construction export. */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(root, process.argv[2] ?? "artifacts/classic-review-order");
const audit = JSON.parse(readFileSync(resolve(root, "docs/classic-construction/audit/measurements.json")));
const house = JSON.parse(readFileSync(resolve(root, "docs/classic-construction/house-input.json")));
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const number = (n) => Math.round(n * 100) / 100;
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const csv = (rows) =>
  `\uFEFF${rows.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n")}\n`;
const sourceUrl = "https://sam-stroy.info/tmp/pechi/pechnoe-otoplenie-maloetagnyh-zdanij.pdf#page=114";
const notice = "ЧЕРНОВИК ДЛЯ РАЗБОРА · НЕ ДЛЯ КЛАДКИ";
const server = await createServer({
  root,
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, watch: null, preTransformRequests: false },
  appType: "custom"
});

try {
  const { CLASSIC_RUSSIAN_STOVE: project } = await server.ssrLoadModule("/src/domain/classicRussianStove.ts");
  const { RUSSIAN_STOVE: teplushka } = await server.ssrLoadModule("/src/domain/russianStove.ts");
  const { brickPhysicalSolids, solidPolyhedron, COURSE_MM } = await server.ssrLoadModule(
    "/src/domain/geometry/index.ts"
  );
  const { horizontalSection } = await server.ssrLoadModule("/src/domain/orderReferenceHtml.ts");
  if (hash(project) !== audit.projectJsonSha256 || hash(teplushka) !== audit.teplushkaJsonSha256) {
    throw new Error("Model differs from the reviewed snapshot. Update the audit before exporting.");
  }
  const bricks = Object.values(project.rows).flat();
  if (new Set(bricks.map((b) => b.id)).size !== bricks.length) throw new Error("Duplicate model IDs");
  const parts = bricks.map((b, i) => {
    const solids = brickPhysicalSolids(b);
    const shapes = solids.map((s) => solidPolyhedron(s, (b.row - 1) * COURSE_MM));
    const vertices = shapes.flatMap((s) => s.vertices);
    const bounds = Object.fromEntries(
      ["x", "y", "z"].map((a) => [a, [Math.min(...vertices.map((p) => p[a])), Math.max(...vertices.map((p) => p[a]))]])
    );
    const dims = ["x", "y", "z"].map((a) => bounds[a][1] - bounds[a][0]);
    const metal = b.custom?.material === "steel" || ["plate", "grate", "damper", "cleanout"].includes(b.kind);
    const rectangular =
      !metal &&
      !b.custom?.profileXZ &&
      b.custom?.cutFrom === "standard" &&
      solids.length === 1 &&
      !solids[0].polyhedron;
    const oversize = rectangular && [...dims].sort((a, c) => a - c).some((v, k) => v > [65, 120, 250][k] + 1e-6);
    const narrow = rectangular && Math.min(...dims.slice(0, 2)) < 25 - 1e-6;
    return { b, no: i + 1, shapes, bounds, dims, metal, oversize, narrow };
  });
  const oversize = parts.filter((p) => p.oversize).length;
  if (oversize !== audit.orthogonalStockFitFailures) throw new Error("Stock-fit flags no longer match the audit");
  const output = (path, content) => writeFileSync(resolve(destination, path), content);
  mkdirSync(resolve(destination, "rows"), { recursive: true });
  mkdirSync(resolve(destination, "sections"), { recursive: true });
  const modelNotes = [
    "Сплошное основание корпуса и коренной трубы.",
    "Стенки большого и малого холодного подпечья.",
    "Начало зольника и поддувальная дверца; холодные ниши.",
    "Начало малого свода. В трубе модели отсутствует исходная прочистка.",
    "Перемычка зольника; продолжение малого свода.",
    "Колосниковая решётка; начало большого свода подпечья.",
    "Начало отдельной топочной дверцы плиты и её дымового канала.",
    "Топливник плиты, канал к трубе, свод большого подпечья.",
    "Продолжение топливника и канала; перекрытия холодных ниш.",
    "Варочная плита, перекрытие топочной дверцы и канала. Стальной узел не рассчитан.",
    "Под горнила; условная стойка шестка. Уклон пода не восстановлен.",
    "Стенки горнила и устья.",
    "Продолжение стенок горнила и устья.",
    "Продолжение стенок горнила и устья.",
    "Продолжение стенок горнила и устья.",
    "Пяты и начала профилей арки устья / свода горнила. Номер ряда не этап замыкания свода.",
    "Сечение арки и свода; клинья не следует делить по горизонтальным рядам.",
    "Арка, свод и условные стальные полосы перетрубья.",
    "Продолжение сводов; начало щёк перетрубья.",
    "Пазухи сводов, щёки перетрубья.",
    "Пазухи сводов, щёки перетрубья.",
    "Завершение массива над сводами в текущей интерполяции.",
    "Массив над горнилом и стенки перетрубья.",
    "Массив над горнилом и стенки перетрубья.",
    "Начало прямого выхода перетрубья в трубу и его затвора.",
    "Прямой выход; условная опора возвратного канала.",
    "Прямой выход, основание верхнего оборота.",
    "Начало верхнего П-образного дымооборота и его затвора. Сечение отличается от книги.",
    "Верхний дымооборот. Образец просвета 200×215 мм вместо исходных 200×250 мм.",
    "Верхний дымооборот и возврат в трубу.",
    "Первый слой перекрытия дымооборота, перетрубья и возврата. Опоры требуют переработки.",
    "Второй слой перекрыши корпуса; паз затвора.",
    "Третий слой перекрыши. Верх корпуса модели Z=2305 мм.",
    "Только показанный отрезок коренной трубы, не потолочная разделка.",
    "Конец отрезка трубы модели Z=2445 мм. Дымоход до кровли не разработан."
  ];
  const color = (p, inherited = false) =>
    p.oversize ? "#ef9b96" : p.narrow ? "#ffd67b" : p.metal ? "#8d9aa4" : inherited ? "#c9c2e2" : "#e6c4a0";
  const polygon = (p, points, inherited = false) => {
    if (points.length < 3) return "";
    const cx = points.reduce((s, q) => s + q.x, 0) / points.length;
    const cy = points.reduce((s, q) => s + q.y, 0) / points.length;
    const dx = Math.max(...points.map((q) => q.x)) - Math.min(...points.map((q) => q.x));
    const dy = Math.max(...points.map((q) => q.y)) - Math.min(...points.map((q) => q.y));
    const label =
      dx >= 65 && dy >= 35
        ? `<text x="${number(cx)}" y="${number(cy + 6)}" text-anchor="middle" font-size="18">${p.no}</text>`
        : "";
    return `<g><title>№${p.no} · ${esc(p.b.id)} · ${esc(p.b.custom?.name ?? p.b.kind)}${p.oversize ? " · НЕ ВПИСЫВАЕТСЯ В ЗАГОТОВКУ" : ""}</title><polygon points="${points.map((q) => `${number(q.x)},${number(q.y)}`).join(" ")}" fill="${color(p, inherited)}" stroke="#43352c" stroke-width="1.1"/>${label}</g>`;
  };
  const dim = (x1, y1, x2, y2, label) =>
    `<g stroke="#39434d" stroke-width="2"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><path d="M${x1 - 8},${y1 - 8}l16,16 M${x2 - 8},${y2 - 8}l16,16"/></g><text x="${(x1 + x2) / 2 + (x1 === x2 ? -12 : 0)}" y="${(y1 + y2) / 2 - 12}" font-size="30" text-anchor="${x1 === x2 ? "end" : "middle"}">${label}</text>`;
  const svg = (title, body, box) =>
    `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}" viewBox="${box}" style="font-family:Arial,sans-serif"><rect x="${box.split(" ")[0]}" y="${box.split(" ")[1]}" width="${box.split(" ")[2]}" height="${box.split(" ")[3]}" fill="white"/>${body}</svg>`;
  const rows = [];
  const cards = [];
  for (let row = 1; row <= project.rowCount; row++) {
    const z = (row - 1) * COURSE_MM + 32.5;
    const cuts = parts
      .flatMap((p) =>
        p.shapes
          .filter((s) => s.vertices.some((v) => v.z < z) && s.vertices.some((v) => v.z > z))
          .map((s) => ({ p, points: horizontalSection(s, z) }))
      )
      .filter((s) => s.points.length >= 3);
    const assigned = parts.filter((p) => p.b.row === row);
    const cutIds = new Set(cuts.map((s) => s.p.b.id));
    const offPlane = assigned.filter((p) => !cutIds.has(p.b.id));
    const graphics = cuts.map(({ p, points }) => polygon(p, points, p.b.row < row)).join("");
    const plan = svg(
      `Ряд ${row}, сечение Z=${z} мм. ${notice}`,
      `${graphics}${dim(125, 50, 1825, 50, "1700 · общий контур модели")}${dim(35, 125, 35, 2125, "2000")}<text x="975" y="2200" text-anchor="middle" font-size="30">ФАСАД · дверцы и шесток со стороны Y=125</text><text x="125" y="2300" fill="#9e251c" font-size="29">РЯД ${row} · Z=${z} мм · ${notice}</text>`,
      "-145 -25 2130 2375"
    );
    const file = `rows/row-${String(row).padStart(2, "0")}.svg`;
    output(file, plan);
    const counts = {
      row,
      planeZMm: z,
      assignedParts: assigned.length,
      visiblePartCount: cutIds.size,
      inheritedPartCount: [...cutIds].filter((id) => parts.find((p) => p.b.id === id).b.row < row).length,
      stockFitFailures: assigned.filter((p) => p.oversize).length,
      narrowParts: assigned.filter((p) => p.narrow).length,
      offPlanePartNumbers: offPlane.map((p) => p.no),
      file
    };
    rows.push(counts);
    const instruments = assigned
      .filter((p) => p.metal)
      .map((p) => `№${p.no}: ${p.b.custom?.name ?? p.b.kind} · Z=${number(p.bounds.z[0])}…${number(p.bounds.z[1])}`)
      .join("; ");
    cards.push(
      `<article class="sheet" id="row-${row}"><h2>Лист Р-${String(row).padStart(2, "0")} · Ряд ${row}</h2><p class="stamp">${notice}</p><p>Сечение Z=${z} мм; низ ряда ${(row - 1) * COURSE_MM} мм. ${esc(modelNotes[row - 1])}</p>${plan}<p>Учётных начал деталей: <b>${assigned.length}</b>; на сечении: ${cutIds.size}; продолжаются из нижних рядов: ${counts.inheritedPartCount}. Ошибок размера заготовки в начинающихся деталях: <b>${counts.stockFitFailures}</b>.</p>${instruments ? `<p><b>Металл / приборы:</b> ${esc(instruments)}</p>` : ""}${offPlane.length ? `<p>Не пересекают эту плоскость, но учтены в ряду: ${offPlane.map((p) => `№${p.no}`).join(", ")}. Их координаты и профиль — в CSV/JSON.</p>` : ""}<p class="small">Номера — сквозные позиции ведомости, не последовательность укладки. Узкие детали могут не иметь видимой подписи; ID есть во всплывающей подписи SVG. Все размеры относятся к текущей модели, не к утверждённой кладке.</p></article>`
    );
  }
  const sections = [
    { name: "А–А · поперёк горнила", axis: "y", at: 1125, file: "sections/section-a.svg" },
    { name: "Б–Б · вдоль горнила и шестка", axis: "x", at: 1225, file: "sections/section-b.svg" },
    { name: "В–В · коренная труба", axis: "x", at: 375, file: "sections/section-c.svg" }
  ];
  for (const section of sections) {
    const graphics = parts
      .flatMap((p) =>
        p.shapes.map((s) => {
          const remapped = {
            faces: s.faces,
            vertices: s.vertices.map((v) => ({ x: section.axis === "x" ? v.y : v.x, y: -v.z, z: v[section.axis] }))
          };
          return polygon(p, horizontalSection(remapped, section.at));
        })
      )
      .join("");
    const roof = `<line x1="0" y1="-2500" x2="2150" y2="-2500" stroke="#ae3226" stroke-width="5"/><text x="50" y="-2540" font-size="32" fill="#ae3226">Деревянный потолок: принято +2500</text><line x1="0" y1="0" x2="2150" y2="0" stroke="#424a4f" stroke-width="3"/><text x="50" y="80" font-size="30">Z=0: низ первого ряда; условно — чистый пол</text><line x1="0" y1="-2150" x2="2150" y2="-2150" stroke="#ae3226" stroke-width="2" stroke-dasharray="20 15"/><text x="50" y="-2190" font-size="25" fill="#ae3226">+2150: предел тела в принятом сценарии зазора 350</text>`;
    const drawing = svg(
      `${section.name}. ${notice}`,
      `${graphics}${roof}<text x="50" y="130" font-size="26" fill="#9e251c">${notice}</text>`,
      "-60 -2640 2330 2790"
    );
    output(section.file, drawing);
    cards.push(
      `<article class="sheet"><h2>${section.name}</h2><p class="stamp">${notice}</p><p>Точная плоскость ${section.axis.toUpperCase()}=${section.at} мм. Не проекция габаритных коробок.</p>${drawing}<p>Корпус +2305 мм; до принятого потолка 195 мм. Для выбранного случая с незащищённым деревянным потолком принято 350 мм. Схема не проходит проверку. Разделка и часть трубы выше +2445 здесь отсутствуют, а не заменены условным зазором.</p></article>`
    );
  }
  const table = [
    [
      "position",
      "id",
      "assigned_row_not_assembly_step",
      "name",
      "kind",
      "x_min_mm",
      "x_max_mm",
      "y_min_mm",
      "y_max_mm",
      "z_min_mm",
      "z_max_mm",
      "bbox_x_mm",
      "bbox_y_mm",
      "bbox_z_mm",
      "orthogonal_stock_failure",
      "narrow_plan_review_flag",
      "profile_local_xz_mm",
      "profile_extrusion_mm",
      "orientation",
      "gate_opening"
    ]
  ];
  for (const p of parts)
    table.push([
      p.no,
      p.b.id,
      p.b.row,
      p.b.custom?.name ?? p.b.kind,
      p.b.kind,
      ...["x", "y", "z"].flatMap((a) => p.bounds[a].map(number)),
      ...p.dims.map(number),
      p.oversize,
      p.narrow,
      p.b.custom?.profileXZ ? JSON.stringify(p.b.custom.profileXZ) : "",
      p.b.custom?.profileXZ ? number(p.b.custom.h * 125) : "",
      p.b.orientation,
      p.b.damperOpen ?? ""
    ]);
  output("parts.csv", csv(table));
  output(
    "rows.csv",
    csv([
      [
        "row",
        "section_z_mm",
        "assigned_parts",
        "visible_parts",
        "inherited_parts",
        "stock_fit_failures",
        "narrow_review_flags"
      ],
      ...rows.map((r) => [
        r.row,
        r.planeZMm,
        r.assignedParts,
        r.visiblePartCount,
        r.inheritedPartCount,
        r.stockFitFailures,
        r.narrowParts
      ])
    ])
  );
  output(
    "model-review.json",
    `${JSON.stringify({ format: "classic-order-review", version: 1, constructionApproved: false, intendedHouseCompatibility: "failed-height-and-unverified-output", projectJsonSha256: hash(project), project, house, audit }, null, 2)}\n`
  );
  const manifest = {
    format: "classic-order-review",
    version: 1,
    constructionApproved: false,
    redesigned: false,
    courses: project.rowCount,
    totalParts: parts.length,
    projectJsonSha256: hash(project),
    teplushkaJsonSha256: hash(teplushka),
    sourceUrl,
    rows,
    sections,
    partsCsvRecords: table.length - 1,
    stockFitFailures: oversize,
    narrowParts: parts.filter((p) => p.narrow).length,
    sectionsAreNotAssemblyInstructions: true
  };
  output("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  const categories = [
    ["Керамика, прямоугольные детали", parts.filter((p) => !p.metal && !p.b.custom?.profileXZ).length],
    ["Керамика, профили / подрезки / клинья", parts.filter((p) => !p.metal && p.b.custom?.profileXZ).length],
    ["Стальные модельные элементы", parts.filter((p) => p.b.custom?.material === "steel").length],
    [
      "Приборы: дверцы, плита, решётка, затворы",
      parts.filter((p) => p.metal && p.b.custom?.material !== "steel").length
    ]
  ];
  const front = `<header class="sheet"><p class="kicker">КЛАССИЧЕСКАЯ РУССКАЯ ПЕЧЬ С ПЛИТОЙ · D01</p><h1>Черновые листы рядов<br>и разрезы текущей модели</h1><p class="stamp">${notice}</p><p><b>Это не новая низкая печь и не исправленная строительная порядовка.</b> Собраны 35 размерных листов исходной цифровой реконструкции, 3 разреза и сквозная ведомость 4506 деталей. Найденные ошибки не скрыты: красные детали не проходят проверку стандартной заготовки.</p><h2>Привязка к запросу</h2><p>Дом 60 м², +20/−30 °C, дрова; стены и потолок деревянные. Над потолком — мешки, опилка с углём. Фундамент и дымоход требуются новые. Потолок 2500 мм и низ первого ряда на чистом полу приняты для сценария, не измерены.</p><p><b>Не подходит по высоте:</b> корпус 2305 мм; свободно 195 мм вместо принятых для данного случая 350 мм. Удаление рядов перекрыши не является исправлением. Расчётный ориентир 6,93 кВт относится к условному дому, не к подтверждённой мощности этой печи.</p><h2>Как читать</h2><p>Все координаты в мм от начала сетки редактора; первый ряд Z=0. План корпуса X=625…1825, Y=125…2125; труба слева. На листах указаны горизонтальные сечения через середину ряда. Длинный клин может пересекать несколько листов и сохраняет один номер: разрезать его по горизонтальным слоям нельзя. Зазоры без окраски не доказывают наличия газового хода: в арках они могут соответствовать растворным швам.</p><p>Цвета: <span style="background:#ef9b96">красный — ошибка размера заготовки</span>; <span style="background:#ffd67b">жёлтый — узкая деталь для проверки</span>; <span style="background:#c9c2e2">сиреневый — продолжение детали снизу</span>; серый — металл/приборы. Неокрашенная как дефект деталь ещё не считается проверенной на прочность.</p><p><a href="parts.csv">Все детали: CSV</a> · <a href="rows.csv">Сводка рядов</a> · <a href="model-review.json">Полная геометрия JSON</a> · <a href="manifest.json">Состав и контрольные хеши</a></p><p class="small">HTML автономный: можно открыть локально и распечатать в PDF. Листы SVG в папках rows и sections открываются отдельно. Размеры физической печи не равны масштабу на бумаге.</p></header><section class="sheet"><h2>Ведомость состава модели</h2><table><tr><th>Группа</th><th>Деталей</th></tr>${categories.map(([name, count]) => `<tr><td>${name}</td><td>${count}</td></tr>`).join("")}</table><p><b>Не спецификация закупки:</b> 4506 частей не равны 4506 целым кирпичам. Для профилей CSV содержит ограничивающий габарит и реальные точки XZ; габарит нельзя использовать как размер прямоугольного реза. Ортогональная проверка заготовки не применялась к клиньям.</p><h2>Открытые ошибки и узлы</h2><ul><li>${oversize} прямоугольных частей не вписываются по осям в 250×120×65 мм; ${audit.zeroPlanJointPairs} пар имеют нулевой вертикальный шов.</li><li>Верхний канал имеет проверенное сечение 200×215 вместо 200×250 мм источника.</li><li>Перевал топливника, прочистка трубы, уклоны пода и свода не восстановлены полностью; стальные опоры условные.</li><li>Режимы топки, теплоотдача, тяга и устойчивость кладки не рассчитаны. Показанное положение затворов не инструкция по эксплуатации.</li><li>Фундамент, дымоход выше модели, отступы от деревянных стен и потолочная разделка пока не имеют рабочих чертежей.</li></ul><h2>Арки и своды</h2><p>Порядок рассмотрения узла: пяты → кружало → кладка свода с перевязкой → замковые кирпичи → выдержка раствора → снятие кружала → последующие работы по принятому проекту. Сборка свода не совпадает с нумерацией горизонтальных сечений. Прочность, распор, пятовые опоры и сроки распалубки этим комплектом не назначены.</p><p>Первоисточник: <a href="${sourceUrl}">А. Е. Школьник, 1991, §63, печ. с.112–117, рис.123–125</a>. Конкретная геометрия листов — интерполированная модель редактора, <b>не точная копия авторских чертежей</b>. Требование принятого потолочного зазора: <a href="https://www.consultant.ru/document/cons_doc_LAW_144507/c6083c1f48a22a20f4d865f2bc5b8fbddfa3aa59/">СП 7.13130.2013, п.5.18</a>.</p><p>Полные исходные данные и концепция новых узлов включены в папку basis. «Теплушка» и существующая модель не изменены.</p><nav>${rows.map((r) => `<a href="#row-${r.row}">${r.row}</a>`).join(" · ")}</nav></section>`;
  output(
    "order.html",
    `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Черновик порядовки D01 — не для кладки</title><style>*{box-sizing:border-box}body{font:16px/1.5 system-ui,sans-serif;color:#25282b;background:#efede7;margin:0}.sheet{background:white;max-width:1050px;padding:30px 44px;margin:24px auto;border:1px solid #d4d0c7}.kicker{font-size:12px;letter-spacing:2px}h1{font-size:34px;line-height:1.2}h2{font-size:22px}a{color:#23536c}.stamp{color:#9e251c;border:2px solid #9e251c;padding:10px;font-weight:700}.sheet svg{display:block;width:100%;max-height:750px}.small{font-size:12px}table{border-collapse:collapse;width:100%}td,th{padding:10px;border:1px solid #ccc;text-align:left}nav{line-height:2}@media(max-width:600px){.sheet{margin:10px;padding:18px}h1{font-size:25px}.sheet svg{max-height:none}}@page{size:A3 portrait;margin:14mm}@media print{body{background:white;font-size:10pt}.sheet{border:0;margin:0;padding:0;max-width:none;break-after:page}.sheet:last-child{break-after:auto}.sheet svg{max-height:285mm}.small{font-size:8pt}h1{font-size:26pt}h2{font-size:17pt}nav{display:none}a{color:inherit}}</style></head><body>${front}${cards.join("\n")}</body></html>`
  );
  mkdirSync(resolve(destination, "basis"), { recursive: true });
  for (const file of [
    "README.md",
    "house-input.json",
    "thermal-design.md",
    "thermal-scenarios.json",
    "foundation-chimney-concept.md"
  ])
    copyFileSync(resolve(root, "docs/classic-construction", file), resolve(destination, "basis", file));
  mkdirSync(resolve(destination, "basis/audit"), { recursive: true });
  for (const file of ["measurements.json", "part-findings.csv"])
    copyFileSync(resolve(root, "docs/classic-construction/audit", file), resolve(destination, "basis/audit", file));
  output(
    "READ-ME.txt",
    `ЧЕРНОВИК ДЛЯ РАЗБОРА — НЕ ДЛЯ КЛАДКИ\n\nОткройте order.html. 35 листов рядов + 3 разреза. SVG открываются отдельно.\nparts.csv — 4506 позиций модели, НЕ заказ кирпича.\nПолный профиль каждой детали: model-review.json.\nНовая низкая печь этим экспортом НЕ создана.\nМодель имеет известные дефекты и не подходит под принятый деревянный потолок 2500 мм.\nРабочих узлов фундамента/трубы и подтверждения мощности нет.\n\nИсточник модели: Школьник, 1991, §63, рис.123–125; значительная интерполяция.\nХеш модели: ${hash(project)}\nВоспроизведение: node scripts/export-classic-review-order.mjs <output-dir>\n`
  );
  if (hash(project) !== audit.projectJsonSha256 || hash(teplushka) !== audit.teplushkaJsonSha256)
    throw new Error("Exporter mutated a model");
  if (
    rows.length !== 35 ||
    rows.reduce((s, r) => s + r.assignedParts, 0) !== parts.length ||
    !rows.some((r) => r.inheritedPartCount > 0)
  )
    throw new Error("Incomplete row accounting");
  console.log(
    JSON.stringify({
      destination,
      courses: rows.length,
      sections: sections.length,
      parts: parts.length,
      oversize,
      modelsUnchanged: true,
      constructionApproved: false
    })
  );
} finally {
  await server.close();
}
