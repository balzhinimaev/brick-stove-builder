import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    city: { type: String, trim: true, default: "" },
    comment: { type: String, trim: true, default: "" },
    source: { type: String, trim: true, default: "landing" },
    utm: {
      source: { type: String, trim: true, default: "" },
      medium: { type: String, trim: true, default: "" },
      campaign: { type: String, trim: true, default: "" },
      content: { type: String, trim: true, default: "" },
      term: { type: String, trim: true, default: "" }
    },
    userAgent: { type: String, default: "" }
  },
  { timestamps: true }
);

leadSchema.index({ phone: 1, createdAt: -1 });

export const Lead = mongoose.model("Lead", leadSchema);
