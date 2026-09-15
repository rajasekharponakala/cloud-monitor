import { httpGet } from "../util";
import type { Row } from "../types";

export async function collect(account: string, token: string): Promise<Row[]> {
  const sep = token.indexOf(":");
  const project = token.slice(0, sep);
  const access = token.slice(sep + 1);
  const h = { Authorization: `Bearer ${access}` };
  const rows: Row[] = [];

  try {
    const data = await httpGet<{ items?: Record<string, { instances?: Record<string, never>[] }> }>(
      `https://compute.googleapis.com/compute/v1/projects/${project}/aggregated/instances`, h);
    for (const scoped of Object.values(data.items || {})) {
      for (const inst of scoped.instances || []) {
        const i = inst as unknown as {
          id: string; name: string; status: string; zone: string; machineType: string;
        };
        rows.push({
          provider: "gcp", account, service: "gce_instance",
          resource_id: String(i.id ?? i.name), name: i.name || "",
          region: (i.zone || "").split("/").pop() || "", status: i.status || "",
          cost_mtd: 0, tags: { machine_type: (i.machineType || "").split("/").pop() || "" }, raw: {},
        });
      }
    }
  } catch (e) {
    return [{
      provider: "gcp", account, service: "api_error", resource_id: "gce",
      name: "gce", region: "", status: "error", cost_mtd: 0,
      tags: { error: String(e).slice(0, 200) }, raw: {},
    }];
  }

  try {
    const data = await httpGet<{ items?: Record<string, never>[] }>(
      `https://sqladmin.googleapis.com/v1/projects/${project}/instances`, h);
    for (const db of (data.items || []) as unknown as {
      name: string; region: string; state: string; settings?: { tier: string };
    }[]) {
      rows.push({
        provider: "gcp", account, service: "cloud_sql", resource_id: db.name,
        name: db.name, region: db.region || "", status: db.state || "",
        cost_mtd: 0, tags: { tier: db.settings?.tier || "" }, raw: {},
      });
    }
  } catch { /* best-effort */ }

  try {
    const data = await httpGet<{ items?: Record<string, never>[] }>(
      `https://storage.googleapis.com/storage/v1/b?project=${project}`, h);
    for (const b of (data.items || []) as unknown as { id: string; name: string; location: string }[]) {
      rows.push({
        provider: "gcp", account, service: "gcs_bucket",
        resource_id: b.id || b.name, name: b.name || "", region: b.location || "",
        status: "", cost_mtd: 0, tags: {}, raw: {},
      });
    }
  } catch { /* best-effort */ }
  return rows;
}
