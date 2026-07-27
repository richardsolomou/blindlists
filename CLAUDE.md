# Blind Lists — Agent Guide

Read [README.md](README.md) first for what the product does and its trust model. This file covers what is easy to break.

## Commands

- `pnpm check` — the full gate (format, lint, `db:check`, build, typecheck, tests). Build runs before typecheck because it generates `src/routeTree.gen.ts`; on a fresh clone typecheck fails until you build.
- Dev server: `DATA_DIR=./data-dev pnpm dev` (create the directory first).
- Lint and format are oxlint + oxfmt, not ESLint/Prettier. Warnings are denied.

## Load-bearing rules

- **`gameView` in `src/core/game.ts` is the only place visibility is decided.** A list, its fingerprint, and an invite token each reach exactly one audience: the owner, everyone after the reveal, and the host respectively. Route components and server functions must not reassemble a view by hand.
- **The reveal happens inside the repository transaction** (`Repository.sealList`, `Repository.dropPlayer`). Deciding "was that the last list?" outside the transaction races two simultaneous submissions.
- **Revealed games are immutable**: sealing and dropping both check `revealedAt` first. Every new mutation must too.
- **Nothing derived is stored.** Fingerprints are recomputed from the list text on read, which is why `gameView` takes a `fingerprint` function rather than importing crypto. Adding a stored column that duplicates the list is a regression.
- **Storage is bounded by the retention sweep** in `src/server/app.ts`, driven by `RETENTION_DAYS`. Any new table must cascade from `games` so it disappears with the game.
- **Server functions wrap handlers in `rpc()`** — a thrown `Response` otherwise reaches the client as a successful result — and every mutation calls `requireMutationOrigin()` first. CSRF protection is per-function, not middleware.
- **Invite tokens are the only credential.** Never log them, never put them in an error message, and never widen who a view hands them to.
- Migrations are generated (`pnpm db:generate`), never hand-edited once applied. `drizzle/` is copied into `.output/server/drizzle` by the build so the production server can run them.

## Tests

`src/core/game.test.ts` pins the visibility rules and `src/server/service.test.ts` drives the whole flow against an in-memory SQLite database. A change to who can see what, or to when a game reveals, belongs in those files first.
