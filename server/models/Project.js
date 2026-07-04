import mongoose from "mongoose";

const localizedTextSchema = new mongoose.Schema(
  {
    ru: { type: String, default: "" },
    en: { type: String, default: "" },
    lt: { type: String, default: "" }
  },
  { _id: false }
);

export const parametersSchema = new mongoose.Schema(
  {
    foundationWidth: { type: Number, required: true, min: 1 },
    foundationLength: { type: Number, required: true, min: 1 },
    foundationThickness: { type: Number, required: true, min: 1 },
    roomHeight: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

export const brickSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
    row: { type: Number, required: true, min: 1 },
    kind: { type: String, enum: ["standard", "cut", "trim", "firebrick", "vent", "cleanout", "grate", "rebate", "plate", "damper", "custom"], required: true },
    orientation: { type: String, enum: ["h", "v"], required: true },
    // Кирпич с четвертью: угол или грань, где выбрана посадочная четверть.
    notchCorner: { type: String, enum: ["nw", "ne", "sw", "se", "n", "e", "s", "w"], required: false },
    // Задвижка: степень выдвижения полотна (0 — закрыта, 1 — открыта).
    damperOpen: { type: Number, min: 0, max: 1, required: false },
    // Кирпич из резака: форма в ячейках (описана для горизонтальной ориентации).
    custom: {
      type: new mongoose.Schema(
        {
          name: { type: String, default: "" },
          w: { type: Number, required: true, min: 0.1 },
          h: { type: Number, required: true, min: 0.1 },
          notch: {
            type: new mongoose.Schema(
              { x1: Number, y1: Number, x2: Number, y2: Number },
              { _id: false }
            ),
            required: false
          },
          ledge: { type: Boolean, default: true },
          // глубина выреза по высоте кирпича, мм (65 = насквозь)
          notchDepthMm: { type: Number, min: 0, required: false },
          // высота проёма дверцы, мм (вертикальный размер)
          heightMm: { type: Number, min: 0, required: false },
          // толщина плиты, мм; flush — утоплена заподлицо в вырезы
          thicknessMm: { type: Number, min: 0, required: false },
          flush: { type: Boolean, required: false },
          // посадка flush-плиты: низ плиты от низа ряда, мм (из полок вырезов)
          seatZMm: { type: Number, min: 0, required: false },
          // исходный кирпич автоподреза (шамот остаётся шамотом в смете)
          cutFrom: { type: String, enum: ["standard", "cut", "firebrick"], required: false }
        },
        { _id: false }
      ),
      required: false
    }
  },
  { _id: false }
);

const showcaseSchema = new mongoose.Schema(
  {
    published: { type: Boolean, default: false },
    description: { type: String, trim: true, default: "", maxlength: 1000 },
    price: { type: Number, min: 0, default: null },
    region: { type: String, trim: true, default: "", maxlength: 100 },
    publishedAt: { type: Date, default: null }
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true, sparse: true, trim: true },
    title: { type: localizedTextSchema, required: true },
    subtitle: { type: localizedTextSchema, default: () => ({}) },
    parameters: { type: parametersSchema, required: true },
    rowCount: { type: Number, required: true, min: 1, max: 200 },
    lockedRows: { type: [Number], default: [] },
    rows: { type: Map, of: [brickSchema], default: {} },
    accent: { type: String, default: "#C1440E" },
    ownerLogin: { type: String, required: true, trim: true, index: true },
    showcase: { type: showcaseSchema, default: () => ({}) }
  },
  { timestamps: true }
);

projectSchema.index({ updatedAt: -1 });
projectSchema.index({ "showcase.published": 1, "showcase.publishedAt": -1 });

export const Project = mongoose.model("Project", projectSchema);
