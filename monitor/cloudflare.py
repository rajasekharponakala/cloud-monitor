"""Cloudflare (api.cloudflare.com/client/v4). Bearer API token. Docs: developers.cloudflare.com/api."""
from __future__ import annotations

from .base import http_get

API = "https://api.cloudflare.com/client/v4"


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def collect(account, token):
    h = _headers(token)
    rows = []
    page = 1
    while True:
        data = http_get(f"{API}/zones?per_page=50&page={page}", h)
        zones = data.get("result", [])
        for z in zones:
            rows.append({
                "provider": "cloudflare", "account": account, "service": "zone",
                "resource_id": z.get("id", ""), "name": z.get("name", ""),
                "region": "", "status": z.get("status", ""),
                "cost_mtd": 0.0, "tags": {"plan": (z.get("plan") or {}).get("name", "")},
                "raw": {"type": z.get("type")},
            })
        info = data.get("result_info", {})
        if page >= int(info.get("total_pages", 1) or 1):
            break
        page += 1
    return rows
