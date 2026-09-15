import { httpGet, prorated } from "../util";
import type { Row } from "../types";

const API = "https://api.digitalocean.com/v2";
const VOL_GB_MONTH = 0.1;
const LB_MONTHLY = 12;

async function paged<T>(url: string, h: Record<string, string>): Promise<{ kind: string; item: T }[]> {
  const out: { kind: string; item: T }[] = [];
  let next: string | null = url;
  while (next) {
    const data: {
      droplets?: T[]; volumes?: T[]; load_balancers?: T[];
      links?: { pages?: { next?: string } };
    } = await httpGet(next, h);
    for (const k of ["droplets", "volumes", "load_balancers"] as const) {
      for (const item of data[k] || []) out.push({ kind: k, item });
    }
    next = data.links?.pages?.next || null;
  }
  return out;
}

export async function collect(account: string, token: string): Promise<Row[]> {
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const rows: Row[] = [];
  for (const { kind, item } of await paged<Record<string, never>>(`${API}/droplets?per_page=200`, h)) {
    const o = item as unknown as {
      id: number; name: string; status: string; created_at: string; tags?: string[];
      region?: { slug: string }; size?: { slug: string; price_monthly: number };
    };
    if (kind === "droplets") {
      rows.push({
        provider: "digitalocean", account, service: "droplet", resource_id: String(o.id),
        name: o.name, region: o.region?.slug || "", status: o.status,
        cost_mtd: prorated(o.created_at, o.size?.price_monthly || 0),
        tags: { tags: o.tags || [] }, raw: { size: o.size?.slug },
      });
    } else if (kind === "volumes") {
      const v = o as unknown as { id: string; name: string; size_gigabytes: number; region?: { slug: string } };
      rows.push({
        provider: "digitalocean", account, service: "volume", resource_id: v.id,
        name: v.name, region: v.region?.slug || "", status: "",
        cost_mtd: Math.round(v.size_gigabytes * VOL_GB_MONTH * 10000) / 10000,
        tags: {}, raw: { size_gb: v.size_gigabytes },
      });
    } else if (kind === "load_balancers") {
      const lb = o as unknown as { id: string; name: string; status: string; created_at: string; region?: { slug: string } };
      rows.push({
        provider: "digitalocean", account, service: "load_balancer", resource_id: lb.id,
        name: lb.name, region: lb.region?.slug || "", status: lb.status,
        cost_mtd: prorated(lb.created_at, LB_MONTHLY), tags: {}, raw: {},
      });
    }
  }
  return rows;
}
