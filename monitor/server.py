"""Tiny stdlib web UI: / (dashboard), /api/resources, /api/summary."""
from __future__ import annotations

import html
import json
import sqlite3
import tomllib
from http.server import BaseHTTPRequestHandler, HTTPServer

from .base import SCHEMA


def cfg():
    try:
        with open("config.toml", "rb") as f:
            return tomllib.load(f)
    except FileNotFoundError:
        return {"general": {"db": "cloud-monitor.db", "port": 4000}}


class Handler(BaseHTTPRequestHandler):
    def _db(self):
        con = sqlite3.connect(cfg().get("general", {}).get("db", "cloud-monitor.db"))
        con.executescript(SCHEMA)
        con.row_factory = sqlite3.Row
        return con

    def _send(self, body, ctype="text/html"):
        data = body.encode()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        con = self._db()
        if self.path == "/api/resources":
            rows = [dict(r) for r in con.execute(
                "SELECT * FROM resources ORDER BY provider, cost_mtd DESC LIMIT 500")]
            return self._send(json.dumps(rows), "application/json")
        if self.path == "/api/summary":
            rows = [dict(r) for r in con.execute(
                "SELECT provider, COUNT(*) n, ROUND(SUM(cost_mtd),2) cost FROM resources GROUP BY provider")]
            return self._send(json.dumps(rows), "application/json")
        summary = [dict(r) for r in con.execute(
            "SELECT provider, COUNT(*) n, ROUND(SUM(cost_mtd),2) cost FROM resources GROUP BY provider")]
        top = [dict(r) for r in con.execute(
            "SELECT provider, service, name, region, status, cost_mtd, fetched_at FROM resources ORDER BY cost_mtd DESC LIMIT 100")]
        cards = "".join(
            f"<div><b>{html.escape(s['provider'])}</b><br>{s['n']} resources<br>€/₹ ${s['cost']} MTD est.</div>"
            for s in summary) or "<p>No data yet — run <code>python3 -m monitor.scheduler</code>.</p>"
        trs = "".join(
            f"<tr><td>{html.escape(str(t['provider']))}</td><td>{html.escape(str(t['service']))}</td>"
            f"<td>{html.escape(str(t['name']))}</td><td>{html.escape(str(t['region'] or ''))}</td>"
            f"<td>{html.escape(str(t['status'] or ''))}</td><td>{t['cost_mtd']}</td></tr>"
            for t in top)
        return self._send(
            f"<html><head><title>Cloud Monitor</title>"
            f"<style>body{{font-family:sans-serif;max-width:1000px;margin:auto}}"
            f"div{{display:inline-block;border:1px solid #ccc;padding:12px;margin:6px}}"
            f"table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #ddd;padding:6px}}</style></head>"
            f"<body><h1>Cloud Monitor</h1>{cards}"
            f"<h2>Top costs</h2><table><tr><th>provider</th><th>service</th><th>name</th>"
            f"<th>region</th><th>status</th><th>cost MTD</th></tr>{trs}</table></body></html>")


def main():
    c = cfg()
    port = int(c.get("general", {}).get("port", 4000))
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
