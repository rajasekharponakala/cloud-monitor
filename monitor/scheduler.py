"""Run all collectors once (cron calls this) or loop with --loop."""
from __future__ import annotations

import sys
import time
import tomllib

from . import base, hetzner, digitalocean, cloudflare, dreamhost, godaddy, aws, gcp

COLLECTORS = {
    "hetzner": hetzner.collect,
    "digitalocean": digitalocean.collect,
    "cloudflare": cloudflare.collect,
    "dreamhost": dreamhost.collect,
    "godaddy": godaddy.collect,
    "aws": aws.collect,
    "gcp": gcp.collect,
}


def load_config(path="config.toml"):
    with open(path, "rb") as f:
        return tomllib.load(f)


def run_once(cfg):
    db = cfg.get("general", {}).get("db", "cloud-monitor.db")
    total = 0
    for acct in cfg.get("account", []):
        fn = COLLECTORS.get(acct["provider"])
        if not fn:
            print(f"skip unknown provider {acct['provider']}", flush=True)
            continue
        try:
            rows = fn(acct["name"], acct["token"])
        except Exception as e:
            print(f"{acct['provider']}/{acct['name']}: ERROR {e}", flush=True)
            rows = []
        n = base.upsert(db, rows) if rows else 0
        print(f"{acct['provider']}/{acct['name']}: {len(rows)} resources", flush=True)
        total += len(rows)
    return total


def main():
    cfg = load_config(sys.argv[1] if len(sys.argv) > 1 else "config.toml")
    if "--loop" in sys.argv:
        interval = int(cfg.get("general", {}).get("interval_minutes", 30)) * 60
        while True:
            run_once(cfg)
            time.sleep(interval)
    else:
        run_once(cfg)


if __name__ == "__main__":
    main()
