# Deployment

Target: Hostinger KVM VPS, Ubuntu, behind Nginx, app run under PM2 as a dedicated
non-root user. See `CLAUDE.md` and `docs/BUILD-PLAN.md` §14 for the constraints this
follows (no `proxy.ts`, `TRUST_PROXY_HOPS`, `STORAGE_DIR` outside the repo, etc).

## One-time server setup

Done once per server, as `root`:

```bash
# Dedicated app user — the app never runs as root.
useradd -m -s /bin/bash talatisutra
mkdir -p /home/talatisutra/.ssh
cp /root/.ssh/authorized_keys /home/talatisutra/.ssh/authorized_keys
chown -R talatisutra:talatisutra /home/talatisutra/.ssh
chmod 700 /home/talatisutra/.ssh && chmod 600 /home/talatisutra/.ssh/authorized_keys

# STORAGE_DIR — outside the repo, so a redeploy never touches uploaded files.
mkdir -p /srv/talatisutra-storage
chown talatisutra:talatisutra /srv/talatisutra-storage
chmod 750 /srv/talatisutra-storage

# Packages. Node comes from Ubuntu's own repo (ships a recent LTS) — no nvm,
# no curl-piped install scripts.
apt-get update
apt-get install -y mysql-server nginx certbot python3-certbot-nginx nodejs npm build-essential
npm install -g pm2

# Firewall — allow SSH before enabling, or you lock yourself out.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Database: dedicated app user, not root.
mysql -e "CREATE DATABASE talatisutra_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER 'talatisutra_app'@'localhost' IDENTIFIED BY '<generated>';"
mysql -e "GRANT ALL PRIVILEGES ON talatisutra_prod.* TO 'talatisutra_app'@'localhost';"
```

## Per-deploy (as `talatisutra`)

```bash
cd /home/talatisutra/app
git pull origin master
npm ci
npx prisma migrate deploy
NODE_ENV=production npm run build
pm2 reload ecosystem.config.js   # or: pm2 start ecosystem.config.js  (first time)
pm2 save
```

First time only, so PM2 survives a reboot:

```bash
pm2 startup systemd -u talatisutra --hp /home/talatisutra
# run the one-line sudo command it prints, as root
```

## `.env` on the server

Copy `.env.example`, fill in real values. Notable production-specific ones:

- `DATABASE_URL` — points at `talatisutra_app`@`localhost`/`talatisutra_prod`, not root.
- `STORAGE_DIR="/srv/talatisutra-storage"`
- `APP_URL="https://talatisutra.in"`
- `TRUST_PROXY_HOPS="1"` — one Nginx hop in front of Node.
- `NODE_ENV="production"` — gates `lib/env.ts`'s stricter validation (real SMTP
  creds required) and the seed script's dev-only sample employees.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — only read by `npm run db:seed`, run
  once manually after the first migration.

The seed script (`prisma/seed.ts`) must be run as `npx tsx prisma/seed.ts`, not
`node prisma/seed.ts` — Ubuntu's distro-packaged Node build doesn't include
TypeScript stripping support, unlike the Node version used in local dev.

## Nginx

Server block lives at `/etc/nginx/sites-available/talatisutra.in`, symlinked into
`sites-enabled`. Key points (see CLAUDE.md §14, BUILD-PLAN §4):

- `client_max_body_size 30M` — must exceed the app's own 25 MB upload limit.
- `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` and
  `X-Forwarded-Proto` — the app reads these via `TRUST_PROXY_HOPS`, not the raw
  socket address, to get the real client IP for rate limiting and audit logs.
- Proxies to `127.0.0.1:3000` (Next's default `next start` port).

TLS via `certbot --nginx -d talatisutra.in -d www.talatisutra.in`, once DNS actually
points at the server (certbot's HTTP-01 challenge needs that first).

## Backups

`mysqldump` cron, daily, retained 14 days, stored outside `/home/talatisutra/app`
(a `git pull` never touches it) and ideally copied off-box periodically. Set up via
root's crontab:

```cron
0 2 * * * mysqldump -u root talatisutra_prod | gzip > /var/backups/talatisutra/db-$(date +%F).sql.gz
0 3 * * * find /var/backups/talatisutra -name '*.sql.gz' -mtime +14 -delete
```

`STORAGE_DIR` (`/srv/talatisutra-storage`) holds uploaded files and should be backed
up the same way (e.g. `rsync` or a periodic tar), since it lives outside the repo and
outside the database.

## Rotating a secret

`SESSION_SECRET` and the DB password were generated server-side during initial setup
and never committed. To rotate either: update `/home/talatisutra/app/.env`, then
`pm2 reload ecosystem.config.js` (rotating `SESSION_SECRET` invalidates all existing
sessions — everyone is logged out).
