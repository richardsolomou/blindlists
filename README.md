# Blind Lists

Blind army list submission for Warhammer 40,000. Every player pastes their list hidden; the moment the last one lands, all of them are revealed at once and locked. Nobody gets to read an opponent's list first and tailor a detachment to beat it.

Paste the text your list builder already exports — the Warhammer 40,000 app, New Recruit, BattleScribe, anything. Blind Lists never parses, validates, or scores a list; it only holds the text you gave it and proves it did not change.

## How a game runs

1. The host creates a game with a name and the players' names, and gets one private invite link per player plus their own host link.
2. Each player opens their link, pastes their army list, and seals it. They can replace it as long as anyone is still outstanding.
3. Nobody — including the host — can see another player's list while the game is collecting.
4. When the last list is sealed, every list is revealed together, fingerprinted with SHA-256, and permanently locked.

A no-show can be dropped by the host while a game is collecting, which reveals the game if everyone else is already in. A player who has sealed a list cannot be dropped, and a revealed game can never be edited.

There are no accounts, no settings, and nothing to administer.

## Storage

A game is its name, one name and invite token per player, and the list text — a few KB in total. Nothing else is kept: no accounts, no timestamps beyond when the game was created and revealed, and no stored fingerprints (they are recomputed from the list on every read, so a list and its fingerprint can never disagree).

Whole games are deleted 30 days after creation. The sweep runs at boot and hourly after that (`RETENTION_DAYS` in `src/core/game.ts`), so a public instance stays flat rather than growing forever.

### Verifying a list was not changed

The fingerprint shown next to each revealed list is the SHA-256 of that exact text. Copy the list and check it yourself:

```sh
pbpaste | shasum -a 256
```

The text is normalized before hashing: LF line endings, no trailing whitespace on any line, and no leading or trailing blank lines.

## Trust model

Invite links are the only credential — anyone holding one is that player, so send them privately and treat them like a password. Lists are stored in plain text in the server's SQLite database, so whoever operates the deployment could read a sealed list out of the database before the reveal. That is fine among friends running their own instance; if you need an escrow that survives a hostile operator, you want a client-side commit–reveal scheme instead, which this is deliberately not.

## Running it

Requires Node 24 and pnpm 11.

```sh
pnpm install
mkdir -p data-dev
DATA_DIR=./data-dev pnpm dev
```

`pnpm check` runs the full gate: format, lint, migration check, build, typecheck, and tests.

## Deploying

Compose builds the image from this repo. The only state is `/data`, which holds the SQLite database and must be a persistent volume.

```sh
cp .env.example .env
docker compose up -d
```

Put it behind a reverse proxy that forwards `X-Forwarded-Host` and `X-Forwarded-Proto`; set `APP_URL` when it cannot. Health check: `GET /api/health`.

## Layout

- `src/core/game.ts` — the whole domain in one file: limits, retention, list normalization, and every visibility decision (`gameView`).
- `src/db` — Drizzle schema, migrations, and the repository that owns the reveal transaction.
- `src/server` — service, server functions, and the same-origin guard for mutations.
- `src/client`, `src/routes` — query definitions, four components, and the three pages: create, host, player.

## License

AGPL-3.0-only.
