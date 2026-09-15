"""GCP via access-token auth (no google-cloud libs). Docs: cloud.google.com/compute/docs/reference/rest/v1.

Token format in config.toml: token = "PROJECT_ID:ACCESS_TOKEN"
Get ACCESS_TOKEN via `gcloud auth print-access-token` (valid ~1h; re-paste
or export and extend this collector to refresh). Cost: GCP has no simple
MTD-spend REST without billing export to BigQuery, so cost_mtd is 0 and
this collector is inventory (instances, SQL, buckets) + status.
"""
from __future__ import annotations

from .base import http_get


def collect(account, token):
    project, _, access = token.partition(":")
    h = {"Authorization": f"Bearer {access}"}
    rows = []
    try:
        data = http_get(
            f"https://compute.googleapis.com/compute/v1/projects/{project}/aggregated/instances",
            h)
        for scope, scoped in (data.get("items") or {}).items():
            for inst in scoped.get("instances", []):
                zone = inst.get("zone", "").rsplit("/", 1)[-1]
                rows.append({
                    "provider": "gcp", "account": account, "service": "gce_instance",
                    "resource_id": str(inst.get("id", inst.get("name"))),
                    "name": inst.get("name", ""), "region": zone,
                    "status": inst.get("status", ""), "cost_mtd": 0.0,
                    "tags": {"machine_type": str(inst.get("machineType", "")).rsplit("/", 1)[-1]},
                    "raw": {},
                })
    except Exception as e:
        return [{"provider": "gcp", "account": account, "service": "api_error",
                 "resource_id": "gce", "name": "gce", "region": "",
                 "status": "error", "cost_mtd": 0.0,
                 "tags": {"error": str(e)[:200]}, "raw": {}}]
    try:
        data = http_get(
            f"https://sqladmin.googleapis.com/v1/projects/{project}/instances", h)
        for db in data.get("items", []):
            rows.append({
                "provider": "gcp", "account": account, "service": "cloud_sql",
                "resource_id": db.get("name", ""), "name": db.get("name", ""),
                "region": db.get("region", ""), "status": db.get("state", ""),
                "cost_mtd": 0.0, "tags": {"tier": db.get("settings", {}).get("tier", "")},
                "raw": {},
            })
    except Exception:
        pass
    try:
        data = http_get(
            f"https://storage.googleapis.com/storage/v1/b?project={project}", h)
        for b in data.get("items", []):
            rows.append({
                "provider": "gcp", "account": account, "service": "gcs_bucket",
                "resource_id": b.get("id", b.get("name", "")),
                "name": b.get("name", ""), "region": b.get("location", ""),
                "status": "", "cost_mtd": 0.0, "tags": {}, "raw": {},
            })
    except Exception:
        pass
    return rows
