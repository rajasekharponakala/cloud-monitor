"""Shared helpers: HTTP GET with Bearer/key auth, MTD prorating, SQLite upserts."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import urllib.request

SCHEMA = """
CREATE TABLE IF NOT EXISTS resources (
  provider TEXT, account TEXT, service TEXT, resource_id TEXT,
  name TEXT, region TEXT, status TEXT, cost_mtd REAL,
  tags TEXT, raw TEXT, fetched_at TEXT,
  PRIMARY KEY (provider, account, service, resource_id)
);
"""


def http_get(url, headers=None, params=None, timeout=25):
    if params:
        qs = urllib.parse.urlencode(params)
        url = f"{url}?{qs}" if "?" not in url else f"{url}&{qs}"
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def now_utc():
    return dt.datetime.now(dt.timezone.utc)


def mtd_factor(created):
    """Fraction of current month elapsed since max(created, month-start)."""
    now = now_utc()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start = created
    if start.tzinfo is None:
        start = start.replace(tzinfo=dt.timezone.utc)
    if start < month_start:
        start = month_start
    if start >= now:
        return 0.0
    month_len = ((month_start + dt.timedelta(days=32)).replace(day=1) - month_start).total_seconds()
    return max(0.0, min(1.0, (now - start).total_seconds() / month_len))


def parse_time(s):
    if not s:
        return now_utc()
    try:
        return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return now_utc()


def upsert(db_path, rows):
    con = sqlite3.connect(db_path)
    con.executescript(SCHEMA)
    fetched = now_utc().isoformat()
    for r in rows:
        con.execute(
            """INSERT INTO resources
               (provider, account, service, resource_id, name, region, status, cost_mtd, tags, raw, fetched_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(provider, account, service, resource_id)
               DO UPDATE SET name=excluded.name, region=excluded.region,
                 status=excluded.status, cost_mtd=excluded.cost_mtd,
                 tags=excluded.tags, raw=excluded.raw, fetched_at=excluded.fetched_at""",
            (r["provider"], r["account"], r["service"], r["resource_id"],
             r.get("name", ""), r.get("region", ""), r.get("status", ""),
             float(r.get("cost_mtd", 0.0)), json.dumps(r.get("tags", {})),
             json.dumps(r.get("raw", {}))[:8000], fetched),
        )
    con.commit()
    return con.execute("SELECT COUNT(*) FROM resources").fetchone()[0]
