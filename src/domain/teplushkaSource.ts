import { TEPLUSHKA_DAMPERS } from "./teplushkaControls";
/** Podgorodnikov 1992, Fig.30/31/33; small wood-fired LEFT chimney variant only. */
export const TEPLUSHKA_SOURCE = {
  url: "https://kirpichiki.pro/assets/files/books/podgorodnikov_1992.pdf",
  sha256: "daf94fb36e619dffeefa3bfd1a78e27eaf642d95985467d5cb627987266c9c4d",
  bodyMm: [1290, 1290],
  hobMm: [710, 410],
  chimneyTopMm: [140, 260],
  bells: ["upper-cooking", "lower-heating"],
  downports: [
    { id: "rear-1", x: 130, y: 1040, w: 130, h: 130 },
    { id: "rear-2", x: 390, y: 1040, w: 130, h: 130 },
    { id: "rear-3", x: 650, y: 1040, w: 130, h: 130 },
    { id: "rear-4", x: 910, y: 1040, w: 130, h: 130 },
    { id: "left", x: 130, y: 770, w: 130, h: 130 },
    { id: "right", x: 1040, y: 910, w: 130, h: 130 }
  ],
  rows: Array.from({ length: 33 }, (_, i) => ({ row: i + 1, pdfPage: i < 12 ? 41 : i < 26 ? 42 : 43, figure: 33 })),
  /** Coordinates other than printed dimensions are drawing transcriptions, not surveyed measurements. */
  uncertainties: [
    "Radial brick joint angles are reconstructed from the published R880 vault section; individual cuts are not dimensioned in the scan.",
    "Mortar is represented by 70 mm construction pitch and 65 mm brick bodies; it is not an independently editable material volume."
  ]
} as const;

/** Stable model IDs for guide/editor integration. */
export const TEPLUSHKA_DAMPER_IDS = TEPLUSHKA_DAMPERS;
export type TeplushkaMode = "winter" | "summer" | "ventilation";
export const TEPLUSHKA_MODE_SETTINGS = {
  winter: { summer: 0, main: 1, hood: 0, mouth: 0 },
  summer: { summer: 1, main: 1, hood: 0, mouth: 0 },
  ventilation: { summer: 0, main: 0, hood: 1, mouth: 1 }
} as const;
export const TEPLUSHKA_OPENINGS = {
  downports: TEPLUSHKA_SOURCE.downports,
  mainThroat: { x: 840, y: 530, w: 260, h: 260, rows: [10, 11, 12] },
  lowAdmissions: [
    { x: 120, y: 380, w: 220, h: 130, rows: [2, 3, 4] },
    { x: 340, y: 210, w: 120, h: 130, rows: [2, 3, 4] }
  ],
  cleanouts: [
    { id: "cleanout-left-1", x: 0, y: 770, w: 120, h: 130, row: 2 },
    { id: "cleanout-left-2", x: 0, y: 1040, w: 120, h: 130, row: 2 }
  ],
  mouth: { id: TEPLUSHKA_DAMPER_IDS.mouth, x: 440, y: 480, w: 350, h: 120, row: 12, height: 345 },
  offsetMm: 125
} as const;
/** Explanatory branches, not simulated flow or guaranteed direction/draft. */
export const TEPLUSHKA_ROUTES = {
  winter: [
    "main-firebox/hob-firebox",
    "common-firing-node",
    "front-right-riser",
    "upper-cooking",
    "six-parallel-downports",
    "lower-heating",
    "two-low-admissions",
    "front-left-chimney"
  ],
  summer: [
    "main-firebox/hob-firebox",
    "common-firing-node",
    "front-right-riser",
    "upper-cooking",
    "teplushka-summer-damper",
    "front-left-chimney"
  ],
  ventilation: ["mouth/hood", "teplushka-hood-damper", "chimney-above-teplushka-main-damper"]
} as const;

/** Millimetre polylines for an explanatory overlay; +125 X/Y to editor origin.
 * Branches are parallel. Their direction comes from the book, not a CFD solve.
 */
export const TEPLUSHKA_ROUTE_POINTS_MM = {
  mainFeed: [
    [970, 650, 500],
    [970, 650, 600],
    [970, 660, 735],
    [970, 660, 900],
    [650, 900, 950]
  ],
  hobFeed: [
    [590, 300, 450],
    [590, 300, 550],
    [970, 500, 550],
    [970, 660, 735],
    [970, 660, 900],
    [650, 900, 950]
  ],
  descents: TEPLUSHKA_SOURCE.downports.map((p) => [
    [650, 900, 950],
    [p.x + 65, p.y + 65, 950],
    [p.x + 65, p.y + 65, 350],
    [p.x + 65, 1100, 350],
    [650, 1100, 350]
  ]),
  lowerCollection: [
    [650, 1100, 350],
    [180, 1100, 350],
    [180, 600, 350],
    [180, 600, 175],
    [180, 430, 175],
    [200, 200, 175],
    [200, 200, 1400],
    [200, 200, 1900],
    [200, 200, 2280]
  ],
  summer: [
    [650, 900, 950],
    [185, 800, 800],
    [185, 565, 800],
    [185, 565, 880],
    [185, 200, 880],
    [200, 200, 1400],
    [200, 200, 1900],
    [200, 200, 2280]
  ],
  ventilation: [
    [650, 250, 1000],
    [510, 250, 1640],
    [510, 250, 1700],
    [200, 250, 1900],
    [200, 200, 2280]
  ]
} as const;
