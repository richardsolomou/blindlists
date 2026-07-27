# Blind Lists

Blind army list submission for Warhammer 40,000. Every player pastes their list hidden; the moment the last one lands, all of them are revealed at once and locked. Nobody gets to read an opponent's list first and tailor a detachment to beat it.

Paste the text your list builder already exports — the Warhammer 40,000 app, New Recruit, BattleScribe, anything. Blind Lists never parses, validates, or scores a list; it only holds the text you gave it and proves it did not change.

## How it works

You set up a **crew** once — its name and everyone who plays — and get a single link. Send that to the group once; everybody bookmarks it. There is nothing to sign up for and no password anywhere.

1. First visit, the page asks who you are and you tap your name. That device remembers you from then on.
2. Anyone in the crew starts a game and picks who is playing tonight.
3. Each player pastes their army list and seals it. They can replace it as long as anyone is still outstanding, and nobody can see another list while the game is collecting.
4. When the last list is sealed, every list is revealed together and permanently locked.

Everybody opens the same bookmark for every future game — no new links, ever. A crew runs one game at a time, and finished games stay on the page as history.

While a game is still collecting you can change who is in it: join a game you were left out of, add anyone from the crew, or drop a no-show — which reveals the game if everyone else is already in. Someone who has sealed cannot be dropped, and a revealed game can never be edited.

Players come and go from the crew too. Adding one puts them in the roster for future games without touching the game in progress. Removing one takes them off the roster and out of a game still collecting, but leaves their lists in games that already revealed: history stays true. A crew always keeps at least two players.

There are no accounts, no settings, and nothing to administer.

## Storage

A crew is its name, its link token, and a name per member — a few hundred bytes, kept as long as the crew uses it so the bookmark never dies. A member who leaves is flagged rather than deleted, so revealed games keep their name. A game is a number, its players, and their list text: a few KB. Nothing else is kept — no accounts, no email, and no timestamps beyond when a game started and revealed. List text is stored exactly as it will be shown, normalized to LF line endings with trailing whitespace and surrounding blank lines removed.

Whole games are deleted 30 days after they start, taking the lists with them and leaving the crew intact. The sweep runs at boot and hourly after that (`RETENTION_DAYS` in `src/core/game.ts`), so a public instance stays flat rather than growing forever.

## Trust model

The crew link is the only credential. Anyone who has it can open the crew and tap any name on it, including yours, so keep it to the group and do not post it publicly. Tapping your name sets a cookie so the device remembers you; that cookie is a convenience, not authentication, and grants nothing the link does not already grant.

What the design does guarantee is the part that matters at the table: while a game is collecting the server hands nobody another player's list, whatever they tap, and once revealed a list can never be edited. What it cannot guarantee is a hostile operator — lists sit in plain text in the server's SQLite database, so whoever runs the deployment could read one before the reveal. That is fine among friends running their own instance; an escrow that survives a hostile operator needs a client-side commit–reveal scheme, which this deliberately is not.

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
- `src/server/member.ts` — the per-crew cookie that remembers which name you tapped.
- `src/client`, `src/routes` — query definitions, four components, and three pages: create a crew, the crew page everything happens on, and a past game.

## License

AGPL-3.0-only.
