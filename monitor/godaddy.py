"""GoDaddy (api.godaddy.com/v1). Header sso-key KEY:SECRET."""
from __future__ import annotations

from .base import http_get

API = "https://api.godaddy.com/v1"


def collect(account, token):
    headers = {"Authorization": f"sso-key {token}"}
    rows = []
    try:
        domains = http_get(f"{API}/domains", headers)
    except Exception as e:
        return [{
            "provider": "godaddy", "account": account, "service": "api_error",
            "resource_id": "domains", "name": "domains", "region": "",
            "status": "error", "cost_mtd": 0.0,
            "tags": {"error": str(e)[:200]}, "raw": {},
        }]
    for d in domains:
        rows.append({
            "provider": "godaddy", "account": account, "service": "domain",
            "resource_id": str(d.get("domainId", d.get("domain"))),
            "name": d.get("domain", ""), "region": "",
            "status": d.get("status", ""), "cost_mtd": 0.0,
            "tags": {"expires": str(d.get("expires", ""))},
            "raw": {"renewal": d.get("renewalPrice")},
        })
    return rows
