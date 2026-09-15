# Contributing

## Setup

```bash
cp config.example.toml config.toml   # never commit config.toml (tokens)
pip install -e ".[dev]"
cd dashboard && npm install
```

## Workflow

1. Branch from `main`: `feat/<provider>-<thing>`.
2. Backend collectors live in `monitor/<provider>.py`, one `collect(account, token)` function returning normalized rows (see `monitor/base.py`).
3. Add/extend `tests/test_backend.py` (no network in tests).
4. Run `make test` and `make build`, open a PR (template checklist applies).

## Secrets

Never commit `config.toml`, `*.db`, or tokens. CI has no provider credentials; tests must be offline.
