#!/bin/sh
set -eu

: "${CENTRIFUGO_API_KEY:?CENTRIFUGO_API_KEY is required}"
: "${CENTRIFUGO_PROXY_SECRET:?CENTRIFUGO_PROXY_SECRET is required}"
: "${APP_URL:?APP_URL is required}"

export CENTRIFUGO_CLIENT_ALLOWED_ORIGINS="${CENTRIFUGO_CLIENT_ALLOWED_ORIGINS:-$APP_URL}"
export CENTRIFUGO_HTTP_API_KEY="${CENTRIFUGO_HTTP_API_KEY:-$CENTRIFUGO_API_KEY}"
export CENTRIFUGO_VAR_PROXY_SECRET="${CENTRIFUGO_VAR_PROXY_SECRET:-$CENTRIFUGO_PROXY_SECRET}"

node /app/.output/server/index.mjs &
app_pid=$!
unset CENTRIFUGO_API_KEY CENTRIFUGO_PROXY_SECRET
centrifugo --config=/app/centrifugo.json &
centrifugo_pid=$!

stop() {
  trap - TERM INT
  kill -TERM "$app_pid" "$centrifugo_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
  wait "$centrifugo_pid" 2>/dev/null || true
}

trap 'stop; exit 0' TERM INT

while kill -0 "$app_pid" 2>/dev/null && kill -0 "$centrifugo_pid" 2>/dev/null; do
  sleep 1
done

set +e
if ! kill -0 "$app_pid" 2>/dev/null; then
  wait "$app_pid"
  status=$?
else
  wait "$centrifugo_pid"
  status=$?
fi
set -e
stop
exit "$status"
