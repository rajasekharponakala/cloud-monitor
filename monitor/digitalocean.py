"""DigitalOcean (api.digitalocean.com/v2). Bearer token. Docs: docs.digitalocean.com/reference/api."""
from __future__ import annotations

from .base import http_get, mtd_factor, parse_time

API = "https://api.digitalocean.com/v2"
VOL_GB_MONTH = 0.10
LB_MONTHLY = 12.0


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _paged(url, headers):
    out, next_url = [], url
    while next_url:
        data = http_get(next_url, headers)
        for key in ("droplets", "volumes", "load_balancers", "domains", "snapshots"):
            out.extend([(key, o) for o in data.get(key, [])])
        links = (data.get("links") or {}).get("pages") or {}
        next_url = (links.get("next") or "") or None
    return out


def collect(account, token):
    h = _headers(token)
    rows = []
    for kind, o in _paged(f"{API}/droplets?per_page=200", h):
        if kind != "droplets":
            continue
        monthly = float(((o.get("size") or {}).get("price_monthly") or 0))
        rows.append({
            "provider": "digitalocean", "account": account, "service": "droplet",
            "resource_id": str(o["id"]), "name": o.get("name", ""),
            "region": (o.get("region") or {}).get("slug", ""),
            "status": o.get("status", ""),
            "cost_mtd": round(monthly * mtd_factor(parse_time(o.get("created_at"))), 4),
            "tags": {"tags": o.get("tags", [])}, "raw": {"size": (o.get("size") or {}).get("slug")},
        })
    for kind, o in _paged(f"{API}/volumes?per_page=200", h):
        if kind != "volumes":
            continue
        monthly = float(o.get("size_gigabytes", 0)) * VOL_GB_MONTH
        rows.append({
            "provider": "digitalocean", "account": account, "service": "volume",
            "resource_id": o.get("id", ""), "name": o.get("name", ""),
            "region": (o.get("region") or {}).get("slug", ""),
            "status": "", "cost_mtd": round(monthly, 4),
            "tags": {}, "raw": {"size_gb": o.get("size_gigabytes")},
        })
    for kind, o in _paged(f"{API}/load_balancers?per_page=200", h):
        if kind != "load_balancers":
            continue
        rows.append({
            "provider": "digitalocean", "account": account, "service": "load_balancer",
            "resource_id": o.get("id", ""), "name": o.get("name", ""),
            "region": (o.get("region") or {}).get("slug", ""),
            "status": o.get("status", ""),
            "cost_mtd": round(LB_MONTHLY * mtd_factor(parse_time(o.get("created_at"))), 4),
            "tags": {}, "raw": {},
        })
    return rows
