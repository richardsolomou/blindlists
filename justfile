set dotenv-load

default:
    @just --list

install:
    corepack enable
    pnpm install

dev:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p data-dev
    cleanup() {
        docker rm --force sealed-lists-realtime >/dev/null 2>&1 || true
    }
    trap cleanup EXIT INT TERM
    cleanup
    just realtime
    CENTRIFUGO_API_KEY=dev-api CENTRIFUGO_PROXY_SECRET=dev-proxy APP_URL=http://localhost:3000 DATA_DIR=./data-dev pnpm dev --host 0.0.0.0

realtime:
    docker run --rm -d --name sealed-lists-realtime --add-host host.docker.internal:host-gateway -e CENTRIFUGO_CLIENT_ALLOWED_ORIGINS=http://localhost:3000 -e CENTRIFUGO_CLIENT_PROXY_CONNECT_ENDPOINT=http://host.docker.internal:3000/api/centrifugo/connect -e CENTRIFUGO_HTTP_API_KEY=dev-api -e CENTRIFUGO_VAR_PROXY_SECRET=dev-proxy -v "$PWD/centrifugo.json:/centrifugo/config.json:ro" -p 127.0.0.1:8000:8000 centrifugo/centrifugo:v6.9.1 centrifugo --config=/centrifugo/config.json

format:
    pnpm format

lint:
    pnpm lint

build:
    pnpm build

typecheck:
    pnpm typecheck

test *args:
    pnpm exec vitest run {{ args }}

db-generate:
    pnpm db:generate

ui *args:
    pnpm exec shadcn {{ args }}

check:
    pnpm check

image:
    docker build -t sealed-lists .
