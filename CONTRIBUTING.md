# Contributing

## Setup

```bash
cp config.example.toml config.toml   # never commit config.toml (tokens)
cd dashboard && npm install
```

## Workflow

1. Branch from `main`: `feat/<provider>-<thing>`.
2. Backend collectors live in `dashboard/lib/monitor/providers/`, one `collect(account, token)` function returning normalized rows (see `lib/monitor/types.ts`).
3. API routes in `dashboard/app/api/`; shared DB in `lib/monitor/db.ts` (`node:sqlite`, zero deps — keep it that way).
4. Run `npm run lint` and `npm run build` in `dashboard/`, open a PR (template checklist applies).

## Secrets

Never commit `config.toml`, `*.db`, or tokens. CI has no provider credentials; tests must be offline.
