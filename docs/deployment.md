# Deployment

The Sealed Lists image contains both the application and Centrifugo. They run as separate supervised processes in one container and share no persistent state: only `/data` needs a volume. Before starting, copy the example environment, set `APP_URL` to the public HTTPS origin, and generate separate secrets for publishing and connection authorization. Paste them into `CENTRIFUGO_API_KEY` and `CENTRIFUGO_PROXY_SECRET` in `.env`.

```sh
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
just image
docker volume create sealed-lists-data
docker run -d --name sealed-lists --restart unless-stopped --env-file .env -p 3020:3000 -v sealed-lists-data:/data sealed-lists
```

The image health check reaches the application through the bundled Caddy proxy. The supervisor monitors Caddy, the application, and Centrifugo; if any process exits, it stops the others so the container restarts under the configured policy.

## Dokploy

Create an Application from the repository and select Dockerfile as the build type. Mount a persistent volume at `/data`, then set `APP_URL`, `AUTH_SECRET`, `CENTRIFUGO_API_KEY`, and `CENTRIFUGO_PROXY_SECRET`. Generate a different random value for each secret.

Add one domain for the application on container port `3000`. The image routes `/connection/*` to Centrifugo and all other traffic to the application, so Dokploy does not need path-specific routes or a separate Centrifugo service.

## Persistent data

`/data` contains the SQLite database and the generated `auth.secret` used to sign sessions. Back up both together. Set `AUTH_SECRET` explicitly if the deployment manages secrets elsewhere; changing it signs every account out.

Lists and games do not expire. Deleting a game or group through the application is the only automatic removal of its list data.

## Reverse proxy

The reverse proxy must forward `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto`. Set `APP_URL` when it cannot represent the public origin through those headers.

Forward all traffic to port 3020. The bundled Caddy proxy handles WebSocket upgrades and sends `/connection/*` to Centrifugo without exposing its private HTTP API.

For example, an nginx proxy is:

```nginx
location / {
    proxy_pass http://127.0.0.1:3020;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`APP_URL` also restricts Centrifugo's accepted browser origins and acts as the canonical host. Requests arriving on another hostname are redirected with their path and query intact. Keep the old hostname pointed at the application for previously shared links to continue working.

The application health endpoint is `GET /api/health`. It and the internal Centrifugo authorization endpoint are exempt from canonical-host redirects.

## Optional email

Set `SMTP_HOST` and `EMAIL_FROM` to enable email. `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASSWORD` configure the connection.

Without email configuration, the application sends no messages and does not offer password reset or email preferences. When configured, players can receive one message when a game starts and another when every list is sealed.

## Optional sign-in providers

A provider appears only when both its client ID and client secret are configured.

- Google callback: `/api/auth/callback/google`
- Discord callback: `/api/auth/callback/discord`

The complete environment variable reference and safe defaults are in [.env.example](../.env.example).
