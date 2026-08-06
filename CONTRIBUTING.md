# Contributing to Sealed Lists

Thanks for helping with Sealed Lists. We keep the codebase small and the trust model easy to audit. Before starting a substantial change, check for an existing issue. Open one first when the scope or product direction needs discussion. Coding-agent instructions live in [AGENTS.md](AGENTS.md).

## Development setup

Install Node 24.x and pnpm 11.15.0, then run:

```sh
pnpm install
mkdir -p data-dev
docker compose -f compose.dev.yml up -d
CENTRIFUGO_API_KEY=dev-api CENTRIFUGO_PROXY_SECRET=dev-proxy APP_URL=http://localhost:3000 DATA_DIR=./data-dev pnpm dev --host 0.0.0.0
```

Open `http://localhost:3000` and create an account.

## Checks

Run the complete local check suite with:

```sh
pnpm check
```

This checks formatting, lint, generated database migrations, the production build, types, and unit tests. The build comes before type checking because it generates `src/routeTree.gen.ts`.

Live updates are not covered by the unit suite. Changes to realtime connections or presence must also be tested in two browser contexts: act in one and verify that the other updates without interaction. Wait for a visible element rather than network idle because a group page keeps its WebSocket open.

## Layout

- `src/core` — the isomorphic domain: limits, types, normalization, and visibility rules. It has no IO or framework imports.
- `src/adapters` — email delivery and Centrifugo publishing.
- `src/db` — the Drizzle schema, SQLite connection, and transaction-aware repository. Generated migrations live under `drizzle/`.
- `src/server` — application setup, authentication, services, server functions, notifications, and HTTP guards.
- `src/client` — query definitions, components, and hooks.
- `src/components/ui` — shadcn components generated with Base UI.
- `src/routes` — TanStack Start file routes and API handlers; keep them as coordinators.

## Conventions

- Keep Sealed Lists focused on opaque Warhammer 40,000 list submission. Parsing, validation, points totals, and list building belong elsewhere.
- Put business rules in `src/core/game.ts`. In particular, `gameView` is the only place that decides who can see a list or draft.
- Route state changes through `Service`, and keep the final-list reveal inside the repository transaction.
- Wrap server-function reads in `rpc()` and mutations in `mutationRpc()`. Authorization remains in the service; route redirects are only user experience.
- Keep query definitions in `src/client/queries.ts`. Live events only trigger a refetch and never carry list data.
- Generate database migrations with `pnpm db:generate`; never edit one that may already have been applied.
- Add behavior-focused tests for new functionality and security-sensitive refactors.
