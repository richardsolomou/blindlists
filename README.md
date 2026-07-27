# Sealed Lists

Sealed army list submission for Warhammer 40,000. Every player pastes their list hidden; the moment the last one lands, all of them are revealed at once and locked. Nobody gets to read an opponent's list first and tailor a detachment to beat it.

Paste the text your list builder already exports — the Warhammer 40,000 app, New Recruit, BattleScribe, anything. Sealed Lists never parses, validates, or scores a list; it only holds the text you gave it and proves it did not change.

## How it works

Everyone makes an account, which is an email and a password and nothing else. You set up a **crew** — its name — and get a single link. Send that to the group once; they sign in and join, and every game after that is waiting at the same place for all of you.

1. Sign in. Your name is what the rest of the crew sees, and your lists follow the account onto any device.
2. Anyone in the crew starts a game and picks who is playing tonight.
3. Each player pastes their army list and seals it. They can replace it as long as anyone is still outstanding, and nobody can see another list while the game is collecting.
4. When the last list is sealed, every list is revealed together and permanently locked.

Everybody opens the same link for every future game — no new links, ever. A crew runs one game at a time, and finished games stay on the page as history. Your home page lists your crews and flags any that are waiting on a list from you.

While a game is still collecting you can change who is in it: join a game you were left out of, add anyone from the crew, or drop a no-show — which reveals the game if everyone else is already in. Someone who has sealed cannot be dropped, and a revealed game can never be edited.

Players come and go from the crew too. Anyone with the link can join; anyone in the crew can remove a member or leave themselves. Removal takes them off the roster and out of a game still collecting, but leaves their lists in games that already revealed: history stays true. A crew always keeps at least two players.

There are no accounts, no settings, and nothing to administer.

## Storage

An account is a name, an email and a password hash. A crew is its name, its link token and a row per member. A game is a number, its players, and their list text.

It is all text, so it all stays. A season of games for a crew of six is a few hundred KB, which is not worth expiring, and a list you sealed two years ago is still there to argue about. A game is a number, its players, and their list text: a few KB. Nothing else is kept — no analytics, no logs of who looked at what. List text is stored exactly as it will be shown, normalized to LF line endings with trailing whitespace and surrounding blank lines removed.

## Trust model

Accounts are real: [better-auth](https://better-auth.com) with email and password, argon-grade hashing, sessions in an httpOnly cookie, and rate limits on the sign-in and sign-up routes. You are only ever one player, and only your own account can seal your list.

The crew link is an invitation, not a credential. Anyone holding it can see the crew's name and who is in it, and can join — so keep it to the group. Joining is all it grants: a link holder who has not joined sees no game, no roster status and no lists, and cannot open a game by its id. While a game is collecting the server hands nobody another player's list, and once revealed a list can never be edited. What it cannot guarantee is a hostile operator — lists sit in plain text in the server's SQLite database, so whoever runs the deployment could read one before the reveal. That is fine among friends running their own instance; an escrow that survives a hostile operator needs a client-side commit–reveal scheme, which this deliberately is not.

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

Put it behind a reverse proxy that forwards `X-Forwarded-Host` and `X-Forwarded-Proto`; set `APP_URL` when it cannot. Sessions are signed with a secret generated into `/data/auth.secret` on first boot — back that file up with the database, or set `AUTH_SECRET` yourself. Health check: `GET /api/health`.

## Layout

- `src/core/game.ts` — the whole domain in one file: limits, retention, list normalization, and every visibility decision (`gameView`).
- `src/db` — Drizzle schema, migrations, and the repository that owns the reveal transaction.
- `src/server` — service, server functions, and the same-origin guard for mutations.
- `src/server/auth.ts` — the better-auth instance, and the secret it keeps beside the database.
- `src/server/session.ts` — reads the signed-in user for server functions.
- `src/client`, `src/routes` — query definitions, four components, and four pages: sign in, your crews, the crew page everything happens on, and a past game.

## License

AGPL-3.0-only.
