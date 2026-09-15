# Cloud Monitor

![ci](https://github.com/rajasekharponakala/cloud-monitor/actions/workflows/ci.yml/badge.svg)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

Multi-provider cloud inventory + cost estimates for the hosts Komiser-style
tools don't cover: **Hetzner, DigitalOcean, Cloudflare, DreamHost, GoDaddy, AWS, GCP**.

Single-stack **Next.js 14 + TypeScript**, zero runtime npm dependencies
(`node:sqlite` for storage, `node:crypto` for AWS SigV4). License: AGPL-3.0-or-later.

## Layout

```
dashboard/
  app/
    page.tsx                 # overview UI (provider cards + top costs)
    api/
      collect/route.ts       # POST: run all collectors (Bearer CRON_SECRET if set)
      resources/route.ts     # GET: resources JSON
      summary/route.ts       # GET: cost-by-provider JSON
  lib/monitor/
    config.ts db.ts util.ts collect.ts
    providers/hetzner.ts digitalocean.ts cloudflare.ts dreamhost.ts godaddy.ts aws.ts gcp.ts
  scripts/collect-loop.mjs   # cron sidecar: POSTs /api/collect on an interval
.github/workflows/ci.yml     # lint + build
Dockerfile.dashboard docker-compose.yml
```

## Quick start

```bash
cp config.example.toml config.toml   # fill tokens; never commit this file
cd dashboard && npm install && npm run dev   # :3000, API on same origin
curl -X POST http://127.0.0.1:3000/api/collect   # run collectors
```

Scheduling: `scripts/collect-loop.mjs` (used by compose `collector` service),
Vercel Cron, or host cron hitting `POST /api/collect`. Set `CRON_SECRET` to
guard the endpoint. Env knobs: `CM_CONFIG` (default `../config.toml`),
`CM_DB` (default `../cloud-monitor.db`).

Docker:

```bash
cp config.example.toml config.toml
CRON_SECRET=... docker compose up --build
```

Caddy:

```
monitor.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

## Provider auth (`config.toml` token)

| Provider | `token =` |
|---|---|
| hetzner | hcloud API token |
| digitalocean | `dop_v1_...` |
| cloudflare | API token (Zone:Read) |
| dreamhost | `api.dreamhost.com` key |
| godaddy | `KEY:SECRET` |
| aws | `ACCESS_KEY:SECRET[:REGION]` (SigV4, default us-east-1) |
| gcp | `PROJECT_ID:ACCESS_TOKEN` (`gcloud auth print-access-token`) |

AI usage (OpenAI, Anthropic, OpenRouter, OpenCode, Claude Code) moved to the
sibling project **[ai-monitor](https://github.com/rajasekharponakala/ai-monitor)**.

## Cost model (estimates, not invoices)

- Hetzner servers/LBs: `server-types` / `load-balancer-types` monthly Gross, prorated MTD.
- Hetzner volumes: €0.044/GB-month. Firewalls/networks/floating IPs: 0.
- DigitalOcean: droplet `size.price_monthly` prorated MTD; volumes $0.10/GB-month; LBs $12/mo prorated.
- AWS: Cost Explorer MTD UnblendedCost total + per-service `billing` rows; EC2 inventory rows cost 0.
- GCP: inventory only (GCE/SQL/GCS), cost 0 — needs billing export for MTD spend.
- Cloudflare/DreamHost/GoDaddy (domains/DNS): 0 — inventory/expiry tracking only.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security: [SECURITY.md](SECURITY.md).
