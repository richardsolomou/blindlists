# Deployment

Sealed Lists runs as one container with one persistent `/data` volume. Compose builds the image from this repository:

```sh
cp .env.example .env
docker compose up -d
```

## Persistent data

`/data` contains the SQLite database and the generated `auth.secret` used to sign sessions. Back up both together. Set `AUTH_SECRET` explicitly if the deployment manages secrets elsewhere; changing it signs every account out.

Lists and games do not expire. Deleting a game or group through the application is the only automatic removal of its list data.

## Reverse proxy

The reverse proxy must forward `X-Forwarded-Host` and `X-Forwarded-Proto`. Set `APP_URL` when it cannot represent the public origin through those headers.

When set, `APP_URL` is also the canonical host. Requests arriving on another hostname are redirected with their path and query intact, allowing previously shared group links to survive a hostname change. Keep the old hostname pointed at the application for the redirect to work.

The health endpoint is `GET /api/health`. It is exempt from canonical-host redirects so the container can check itself over `127.0.0.1`.

## Optional email

Set `SMTP_HOST` and `EMAIL_FROM` to enable email. `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASSWORD` configure the connection.

Without email configuration, the application sends no messages and does not offer password reset or email preferences. When configured, players can receive one message when a game starts and another when every list is sealed.

## Optional sign-in providers

A provider appears only when both its client ID and client secret are configured.

- Google callback: `/api/auth/callback/google`
- Discord callback: `/api/auth/callback/discord`

The complete environment variable reference and safe defaults are in [.env.example](../.env.example).
