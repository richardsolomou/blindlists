# Sealed Lists — Agent Guide

Read [README.md](README.md) first for what the product does and its trust model. This file covers what is easy to break.

## Product boundary

Sealed army list submission for Warhammer 40,000, and nothing else. Lists are opaque text: no parsing, no validation, no points totals, no faction or detachment awareness, no list building. Anything that needs to understand the contents of a list belongs in a different tool.

## Commands

- `pnpm check` — the full gate (format, lint, `db:check`, build, typecheck, tests). Build runs before typecheck because it generates `src/routeTree.gen.ts`; on a fresh clone typecheck fails until you build.
- Dev server: `DATA_DIR=./data-dev pnpm dev` (create the directory first).
- Lint and format are oxlint + oxfmt, not ESLint/Prettier. Warnings are denied.

## Load-bearing rules

- **`src/core/game.ts` is the whole domain** — limits, retention, list normalization, types, and `gameView`. It stays free of IO and framework imports.
- **`gameView` is the only place visibility is decided.** A list reaches exactly two audiences: its owner, and everyone once the game reveals. Route components and server functions must not reassemble a view by hand.
- **The crew link is the credential; the member cookie is not.** `src/server/member.ts` only remembers which name a device tapped, and it grants nothing the link does not already grant — anyone with the link can tap any name. So never gate a _visibility_ rule on the cookie; gate it on the reveal, as `gameView` does. Gating a _mutation_ on it (`requireMember`) is fine: it stops accidents, not adversaries.
- **The reveal happens inside the repository transaction** (`Repository.sealList`, `Repository.dropEntry`). Deciding "was that the last list?" outside the transaction races two simultaneous submissions.
- **A crew runs one game at a time**, enforced in `Repository.createGame`'s transaction. `crewView` then shows the collecting game, or the most recently revealed one, so a reveal lands on the page the crew is already looking at instead of vanishing into history.
- **Revealed games are immutable**: sealing, joining and dropping all check `revealedAt` first. Every new mutation must too.
- **Leaving a crew is a flag, not a delete.** `members.removedAt` exists because `entries.member_id` cascades: deleting the row would erase that player's lists from games that already revealed. Removal clears them from a _collecting_ game only. Read rosters through `membersOf`, which filters `removedAt IS NULL`, and note seats come from `highestSeat` so a new member never reuses a departed one's seat.
- **Nothing derived is stored.** A column that can be computed from the list text is a regression.
- **Reads answer `null`, mutations throw.** The view server functions wrap the service in `orNull` so a wrong or expired link becomes `null`, which the route turns into `notFound()` and a real 404. Throwing a `Response(404)` from a loader would surface as a 500 instead.
- **The UI explains nothing about its own mechanics.** No hashes, no jargon, no "how it works" — players get plain statements of what is true now ("Sealed", "Nobody can change a list now"). Technical detail belongs in this file and the README, whose readers are developers.
- **Storage is bounded by the retention sweep** in `src/server/app.ts`, driven by `RETENTION_DAYS`. It deletes games, never crews — a crew's link is a bookmark people keep for years. Anything holding list content must cascade from `games` so it disappears with the game.
- **Server functions wrap handlers in `rpc()`** — a thrown `Response` otherwise reaches the client as a successful result — and every mutation calls `requireMutationOrigin()` first. CSRF protection is per-function, not middleware.
- **Invite tokens are the only credential.** Never log them, never put them in an error message, and never widen who a view hands them to.
- Migrations are generated (`pnpm db:generate`), never hand-edited once applied. `drizzle/` is copied into `.output/server/drizzle` by the build so the production server can run them.

## Tests

`src/core/game.test.ts` pins the visibility rules — including that someone sitting a game out and a visitor who never tapped a name both see nothing — and `src/server/service.test.ts` drives the whole flow against an in-memory SQLite database. A change to who can see what, or to when a game reveals, belongs in those files first.
