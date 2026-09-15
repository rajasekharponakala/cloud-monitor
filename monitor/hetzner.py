"""Hetzner Cloud (api.hetzner.cloud). Bearer token. Docs: docs.hetzner.cloud."""
from __future__ import annotations

from .base import http_get, mtd_factor, parse_time

API = "https://api.hetzner.cloud/v1"
VOL_GB_MONTH = 0.044


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def collect(account, token):
    h = _headers(token)
    rows = []

    stypes = {t["id"]: t for t in http_get(f"{API}/server_types", h).get("server_types", [])}
    lbtypes = {t["id"]: t for t in http_get(f"{API}/load_balancer_types", h).get("load_balancer_types", [])}

    for s in http_get(f"{API}/servers", h).get("servers", []):
        loc = (s.get("location") or {}).get("name", "")
        monthly = 0.0
        st = stypes.get((s.get("server_type") or {}).get("id", 0), {})
        for p in st.get("prices", []):
            if p.get("location") == loc:
                monthly = float(p.get("price_monthly", {}).get("gross", 0) or 0)
                break
        if not monthly and st.get("prices"):
            monthly = float(st["prices"][0].get("price_monthly", {}).get("gross", 0) or 0)
        rows.append({
            "provider": "hetzner", "account": account, "service": "server",
            "resource_id": str(s["id"]), "name": s.get("name", ""),
            "region": loc, "status": s.get("status", ""),
            "cost_mtd": round(monthly * mtd_factor(parse_time(s.get("created"))), 4),
            "tags": s.get("labels", {}), "raw": {"type": (s.get("server_type") or {}).get("name")},
        })

    for v in http_get(f"{API}/volumes", h).get("volumes", []):
        monthly = float(v.get("size", 0)) * VOL_GB_MONTH
        rows.append({
            "provider": "hetzner", "account": account, "service": "volume",
            "resource_id": str(v["id"]), "name": v.get("name", ""),
            "region": (v.get("location") or {}).get("name", ""),
            "status": v.get("status", ""),
            "cost_mtd": round(monthly * mtd_factor(parse_time(v.get("created"))), 4),
            "tags": v.get("labels", {}), "raw": {"size_gb": v.get("size")},
        })

    for lb in http_get(f"{API}/load_balancers", h).get("load_balancers", []):
        loc = (lb.get("location") or {}).get("name", "")
        monthly = 0.0
        lt = lbtypes.get((lb.get("load_balancer_type") or {}).get("id", 0), {})
        for p in lt.get("prices", []):
            if p.get("location") == loc:
                monthly = float(p.get("price_monthly", {}).get("gross", 0) or 0)
                break
        rows.append({
            "provider": "hetzner", "account": account, "service": "load_balancer",
            "resource_id": str(lb["id"]), "name": lb.get("name", ""),
            "region": loc, "status": "",
            "cost_mtd": round(monthly * mtd_factor(parse_time(lb.get("created"))), 4),
            "tags": lb.get("labels", {}), "raw": {},
        })

    for kind, svc in (("firewalls", "firewall"), ("floating_ips", "floating_ip"), ("networks", "network")):
        for o in http_get(f"{API}/{kind}", h).get(kind, []):
            rows.append({
                "provider": "hetzner", "account": account, "service": svc,
                "resource_id": str(o["id"]), "name": o.get("name") or o.get("ip", str(o["id"])),
                "region": "", "status": "", "cost_mtd": 0.0,
                "tags": o.get("labels", {}), "raw": {},
            })
    return rows
