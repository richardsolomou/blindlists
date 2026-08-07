<div align="center">
  <img src="public/favicon.svg" width="80" alt="Sealed Lists logo" />

# Sealed Lists

**Reveal every Warhammer 40,000 army list at the same time.**

[sealed-lists.ras.sh](https://sealed-lists.ras.sh)

[![Build](https://img.shields.io/github/actions/workflow/status/richardsolomou/sealed-lists/ci.yml?branch=main)](https://github.com/richardsolomou/sealed-lists/actions/workflows/ci.yml) [![License](https://img.shields.io/github/license/richardsolomou/sealed-lists)](LICENSE)

Nobody gets to read an opponent's list first and tailor their own to beat it. Players submit in private; the final submission reveals and locks every list together.
</div>

## How it works ✨

1. **Create a group** and share its permanent invite link.
2. **Choose the players** for the next game.
3. **Paste and seal lists** exported by any list-building app.
4. **Edit safely** by unsealing before the reveal, with drafts saved automatically.
5. **Reveal together** when the final player seals their list.

The group page updates live across every device through the bundled Centrifugo service and shows who is present or typing. Finished games remain as history, and optional email notifications tell players when a list is due or the reveal is ready.

## Designed for one job 🎯

Sealed Lists stores opaque text. It does not parse lists, validate rules, calculate points, understand factions, or build armies.

- One reusable link per group, with no owner or administrator role.
- Email and password accounts, with optional Google and Discord sign-in.
- Player changes while a game is collecting, including joining late or dropping a no-show.
- Immutable revealed games, with group-controlled deletion when history is no longer wanted.
- No analytics, list-access logs, scheduled expiry, or hidden retention policy.

## Trust model 🔒

The group link is an invitation, not a login. Anyone holding it can see the group name and members and can join, but only members can see games. Before a reveal, a player receives only their own list and draft; after the reveal, participating players receive the locked lists.

The server stores list text in plain text. A deployment operator with database access can read it before the reveal, so Sealed Lists is suitable for friends who trust whoever hosts their instance. Protecting lists from the operator would require a client-side commit–reveal system and is outside this project's scope.

## Self-hosting 🐳

The only persistent state is `/data`, which contains the SQLite database and generated session secret.

```sh
cp .env.example .env
docker build -t sealed-lists .
docker volume create sealed-lists-data
docker run -d --name sealed-lists --restart unless-stopped --env-file .env -p 3020:3000 -v sealed-lists-data:/data sealed-lists
```

Put the app behind a reverse proxy, keep `/data` on a persistent volume, and back it up regularly. See the [deployment guide](docs/deployment.md) for proxy headers, canonical URLs, authentication providers, email, health checks, and backups.

## Development 🛠️

Development requires Node 24.x and pnpm 11.15.0.

```sh
pnpm install
mkdir -p data-dev
docker run --rm -d --name sealed-lists-realtime --add-host host.docker.internal:host-gateway -e CENTRIFUGO_CLIENT_ALLOWED_ORIGINS=http://localhost:3000 -e CENTRIFUGO_CLIENT_PROXY_CONNECT_ENDPOINT=http://host.docker.internal:3000/api/centrifugo/connect -e CENTRIFUGO_HTTP_API_KEY=dev-api -e CENTRIFUGO_VAR_PROXY_SECRET=dev-proxy -v "$PWD/centrifugo.json:/centrifugo/config.json:ro" -p 127.0.0.1:8000:8000 centrifugo/centrifugo:v6.9.1 centrifugo --config=/centrifugo/config.json
CENTRIFUGO_API_KEY=dev-api CENTRIFUGO_PROXY_SECRET=dev-proxy APP_URL=http://localhost:3000 DATA_DIR=./data-dev pnpm dev --host 0.0.0.0
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture and checks. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

[GNU Affero General Public License v3.0](LICENSE)
