#!/usr/bin/env bash
# Мониторинг доступности редактора печей: раз в 5 минут (cron) дёргает /api/health.
# Падение и восстановление — по одному сообщению в Telegram (без спама): состояние
# хранится в STATE_FILE. Токен и chat_id берутся из .env проекта (те же, что для лидов).
set -u

URL="https://arcanabot.ru/brick-stove-builder/api/health"
STATE_FILE="${HOME}/.brick-stove-uptime-state"
ENV_FILE="${HOME}/brick-stove-builder/.env"

TG_BOT_TOKEN=$(grep -E "^TG_BOT_TOKEN=" "$ENV_FILE" | cut -d= -f2-)
TG_CHAT_IDS=$(grep -E "^TG_CHAT_IDS=" "$ENV_FILE" | cut -d= -f2-)

notify() {
  [ -z "$TG_BOT_TOKEN" ] && return 0
  IFS=',' read -ra chats <<< "$TG_CHAT_IDS"
  for chat in "${chats[@]}"; do
    curl -s -m 10 -o /dev/null "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
      -d chat_id="$chat" -d text="$1" || true
  done
}

body=$(curl -s -m 15 "$URL" 2>/dev/null)
if echo "$body" | grep -q '"ok":true' && echo "$body" | grep -q '"mongoConnected":true'; then
  current="up"
else
  current="down"
fi

previous=$(cat "$STATE_FILE" 2>/dev/null || echo "up")
if [ "$current" != "$previous" ]; then
  if [ "$current" = "down" ]; then
    notify "🔴 Печи: редактор недоступен или Mongo отвалилась ($URL). Ответ: ${body:-нет ответа}"
  else
    notify "🟢 Печи: редактор снова работает."
  fi
  echo "$current" > "$STATE_FILE"
fi
