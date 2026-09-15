"""DreamHost (api.dreamhost.com). Key-based cmd API. Docs: api.dreamhost.com."""
from __future__ import annotations

import urllib.parse
import urllib.request
import json

API = "https://api.dreamhost.com/"


def _call(key, cmd, args=None):
    params = {"key": key, "cmd": cmd, "format": "json"}
    params.update(args or {})
    url = API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=25) as r:
        return json.loads(r.read().decode())


def collect(account, token):
    rows = []
    # Each cmd is best-effort: DreamHost returns {result: ok/error}.
    for cmd, svc, idkey, namekey in (
        ("domain-list_domains", "domain", "domain", "domain"),
        ("dns-list_records", "dns_record", "record", "record"),
    ):
        try:
            data = _call(token, cmd)
        except Exception as e:
            rows.append({
                "provider": "dreamhost", "account": account, "service": "api_error",
                "resource_id": cmd, "name": cmd, "region": "", "status": "error",
                "cost_mtd": 0.0, "tags": {"error": str(e)[:200]}, "raw": {},
            })
            continue
        items = data.get("data", [])
        if isinstance(items, dict):
            items = [items]
        for o in items:
            if not isinstance(o, dict):
                continue
            rid = str(o.get(idkey, o.get("domain", o.get("record", "?"))))
            rows.append({
                "provider": "dreamhost", "account": account, "service": svc,
                "resource_id": f"{cmd}:{rid}", "name": str(o.get(namekey, rid)),
                "region": "", "status": "", "cost_mtd": 0.0,
                "tags": {}, "raw": {k: o.get(k) for k in list(o)[:8]},
            })
    return rows
