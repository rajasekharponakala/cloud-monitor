# Cloud Monitor

![ci](https://github.com/rajasekharponakala/cloud-monitor/actions/workflows/ci.yml/badge.svg)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

Multi-provider cloud inventory + cost estimates for the hosts Komiser-style
tools don't cover: **Hetzner, DigitalOcean, Cloudflare, DreamHost, GoDaddy, AWS, GCP**.

- Backend: stdlib-only Python collectors → SQLite (`monitor/`)
- Frontend: Next.js 14 dashboard (`dashboard/`)
- License: AGPL-3.0-or-later

## Layout

```
monitor/            # backend collectors (one file per provider) + scheduler + JSON API
  base.py           # HTTP helpers, MTD prorating, SQLite upserts
  hetzner.py digitalocean.py cloudflare.py dreamhost.py godaddy.py aws.py gcp.py
  scheduler.py      # cron/loop runner  |  server.py  # :4000 API + fallback UI
dashboard/          # Next.js 14 frontend (reads the :4000 API)
tests/              # offline backend unit tests
.github/workflows/  # CI (pytest + npm build), dependabot
Dockerfile.backend Dockerfile.dashboard docker-compose.yml
```

## Quick start

```bash
cp config.example.toml config.toml   # fill tokens; never commit this file
make test && make collect
make api                               # JSON API + fallback UI on 127.0.0.1:4000
cd dashboard && npm install && npm run dev   # framework UI on :3000
```

Docker:

```bash
cp config.example.toml config.toml
docker compose up --build
```

Caddy:

```
monitor.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

## Provider auth

| Provider | `token =` |
|---|---|
| hetzner | hcloud API token |
| digitalocean | `dop_v1_...` |
| cloudflare | API token (Zone:Read) |
| dreamhost | `api.dreamhost.com` key |
| godaddy | `KEY:SECRET` |
| aws | `ACCESS_KEY:SECRET[:REGION]` (SigV4, default us-east-1) |
| gcp | `PROJECT_ID:ACCESS_TOKEN` (`gcloud auth print-access-token`) |

## Cost model (estimates, not invoices)

- Hetzner servers/LBs: `server-types` / `load-balancer-types` monthly Gross, prorated MTD.
- Hetzner volumes: €0.044/GB-month. Firewalls/networks/floating IPs: 0.
- DigitalOcean: droplet `size.price_monthly` prorated MTD; volumes $0.10/GB-month; LBs $12/mo prorated.
- AWS: Cost Explorer MTD UnblendedCost total + per-service `billing` rows; EC2/RDS inventory rows cost 0.
- GCP: inventory only (GCE/SQL/GCS), cost 0 — needs billing export for MTD spend.
- Cloudflare/DreamHost/GoDaddy (domains/DNS): 0 — inventory/expiry tracking only.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).
