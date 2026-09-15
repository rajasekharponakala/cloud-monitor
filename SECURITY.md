# Security Policy

## Reporting

Report vulnerabilities via GitHub private security advisories (preferred) or by opening an issue marked `security` with minimal detail. Do not post tokens or customer data.

## Scope notes

- Collectors store provider API tokens in local `config.toml` only; never commit it.
- Guard `POST /api/collect` with `CRON_SECRET` in any shared deployment.
- The app binds localhost by default — put Caddy/basic-auth in front before exposing it.
- Supported runtimes: Node 22 (`node:sqlite`); dashboard: Node 22.
