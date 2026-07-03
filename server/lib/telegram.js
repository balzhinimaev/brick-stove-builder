const API_TIMEOUT_MS = 10_000;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Fire-and-forget notification to Telegram admins.
 * Disabled unless TG_BOT_TOKEN and TG_CHAT_IDS (comma-separated) are set.
 * Never throws: a Telegram outage must not fail lead submission.
 */
export async function notifyTelegram(text) {
  const token = process.env.TG_BOT_TOKEN;
  const chatIds = (process.env.TG_CHAT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!token || chatIds.length === 0) return;

  for (const chatId of chatIds) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS)
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(`[telegram] sendMessage to ${chatId} failed: ${response.status} ${body.slice(0, 200)}`);
      }
    } catch (error) {
      console.error(`[telegram] sendMessage to ${chatId} failed:`, error.message);
    }
  }
}

export function formatLeadMessage(lead) {
  const lines = [
    "🔥 <b>Новая заявка — печи</b>",
    "",
    `👤 ${escapeHtml(lead.name) || "—"}`,
    `📞 <code>${escapeHtml(lead.phone)}</code>`
  ];
  if (lead.email) lines.push(`✉️ ${escapeHtml(lead.email)}`);
  if (lead.city) lines.push(`📍 ${escapeHtml(lead.city)}`);
  if (lead.comment) lines.push(`💬 ${escapeHtml(lead.comment)}`);
  lines.push("", `Форма: ${escapeHtml(lead.source)}`);
  const utm = Object.entries(lead.utm ?? {})
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${escapeHtml(value)}`)
    .join(", ");
  if (utm) lines.push(`UTM: ${utm}`);
  return lines.join("\n");
}
