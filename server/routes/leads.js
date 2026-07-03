import { Router } from "express";
import { Lead } from "../models/Lead.js";
import { requireMongo } from "../middleware/requireMongo.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { formatLeadMessage, notifyTelegram } from "../lib/telegram.js";

const PHONE_DIGITS_MIN = 10;
const PHONE_DIGITS_MAX = 15;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanStr(value, maxLength = 200) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export const leadsRouter = Router();

leadsRouter.post("/", rateLimit({ windowMs: 60_000, max: 3 }), requireMongo, async (req, res, next) => {
  try {
    const body = req.body ?? {};

    // Honeypot: bots fill every field; real users never see this one.
    if (cleanStr(body.website)) return res.status(201).json({ ok: true });

    const phoneDigits = cleanStr(body.phone, 30).replace(/\D/g, "");
    if (phoneDigits.length < PHONE_DIGITS_MIN || phoneDigits.length > PHONE_DIGITS_MAX) {
      return res.status(400).json({ error: "Укажите корректный номер телефона" });
    }

    const email = cleanStr(body.email);
    if (email && !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Укажите корректный email" });
    }

    const lead = await Lead.create({
      name: cleanStr(body.name, 100),
      phone: cleanStr(body.phone, 30),
      email,
      city: cleanStr(body.city, 100),
      comment: cleanStr(body.comment, 500),
      source: cleanStr(body.source, 100) || "landing",
      utm: {
        source: cleanStr(body.utm?.source, 100),
        medium: cleanStr(body.utm?.medium, 100),
        campaign: cleanStr(body.utm?.campaign, 100),
        content: cleanStr(body.utm?.content, 100),
        term: cleanStr(body.utm?.term, 100)
      },
      userAgent: cleanStr(req.headers["user-agent"], 300)
    });

    console.log(`[lead] ${lead.phone} ${lead.email || "-"} (${lead.name || "-"}) utm=${lead.utm.source || "-"}`);
    // Не ждём Telegram: заявка уже сохранена, уведомление — фоновое.
    void notifyTelegram(formatLeadMessage(lead));
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/** Export leads. Protected by LEADS_KEY env (route disabled when unset). */
leadsRouter.get("/", requireMongo, async (req, res, next) => {
  try {
    const key = process.env.LEADS_KEY;
    if (!key || req.headers["x-leads-key"] !== key) {
      return res.status(404).json({ error: "Not found" });
    }
    const leads = await Lead.find().sort({ createdAt: -1 }).limit(1000).lean();
    res.json({ ok: true, count: leads.length, leads });
  } catch (error) {
    next(error);
  }
});
