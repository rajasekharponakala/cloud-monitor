# Security Policy

## Reporting

Report vulnerabilities via GitHub private security advisories (preferred) or by opening an issue marked `security` with minimal detail. Do not post tokens or customer data.

## Scope notes

- Collectors store provider API tokens in local `config.toml` only; never commit it.
- The Python API binds `127.0.0.1` by default — put Caddy/basic-auth in front before exposing it.
- Supported Python: 3.11+; dashboard: Node 22.
