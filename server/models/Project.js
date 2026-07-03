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
    kind: { type: String, enum: ["standard", "cut", "trim", "firebrick", "vent", "cleanout", "grate", "rebate", "plate"], required: true },
    orientation: { type: String, enum: ["h", "v"], required: true },
    // Кирпич с четвертью: угол или грань, где выбрана посадочная четверть.
    notchCorner: { type: String, enum: ["nw", "ne", "sw", "se", "n", "e", "s", "w"], required: false }
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
    rowCount: { type: Number, required: true, min: 1 },
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
