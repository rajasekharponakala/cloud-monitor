import { httpGet, prorated } from "../util";
import type { Row } from "../types";

const API = "https://api.hetzner.cloud/v1";
const VOL_GB_MONTH = 0.044;

type Priced = { id: number; prices?: { location: string; price_monthly: { gross: string } }[] };

export async function collect(account: string, token: string): Promise<Row[]> {
  const h = { Authorization: `Bearer ${token}` };
  const rows: Row[] = [];

  const stypes = (await httpGet<{ server_types: Priced[] }>(`${API}/server_types`, h)).server_types;
  const lbtypes = (await httpGet<{ load_balancer_types: Priced[] }>(`${API}/load_balancer_types`, h))
    .load_balancer_types;
  const priceOf = (t: Priced | undefined, loc: string): number => {
    if (!t?.prices?.length) return 0;
    return parseFloat(t.prices.find((p) => p.location === loc)?.price_monthly.gross || t.prices[0].price_monthly.gross) || 0;
  };

  const servers = (await httpGet<{ servers: Record<string, never>[] }>(`${API}/servers`, h)).servers;
  for (const s of servers as unknown as {
    id: number; name: string; status: string; created: string;
    location?: { name: string }; server_type?: { id: number; name: string }; labels?: Record<string, string>;
  }[]) {
    const loc = s.location?.name || "";
    const monthly = priceOf(stypes.find((t) => t.id === s.server_type?.id), loc);
    rows.push({
      provider: "hetzner", account, service: "server", resource_id: String(s.id),
      name: s.name, region: loc, status: s.status,
      cost_mtd: prorated(s.created, monthly), tags: s.labels || {},
      raw: { type: s.server_type?.name },
    });
  }

  const volumes = (await httpGet<{ volumes: Record<string, never>[] }>(`${API}/volumes`, h)).volumes;
  for (const v of volumes as unknown as {
    id: number; name: string; status: string; created: string; size: number;
    location?: { name: string }; labels?: Record<string, string>;
  }[]) {
    rows.push({
      provider: "hetzner", account, service: "volume", resource_id: String(v.id),
      name: v.name, region: v.location?.name || "", status: v.status,
      cost_mtd: prorated(v.created, v.size * VOL_GB_MONTH), tags: v.labels || {},
      raw: { size_gb: v.size },
    });
  }

  const lbs = (await httpGet<{ load_balancers: Record<string, never>[] }>(`${API}/load_balancers`, h)).load_balancers;
  for (const lb of lbs as unknown as {
    id: number; name: string; created: string; location?: { name: string };
    load_balancer_type?: { id: number }; labels?: Record<string, string>;
  }[]) {
    const loc = lb.location?.name || "";
    rows.push({
      provider: "hetzner", account, service: "load_balancer", resource_id: String(lb.id),
      name: lb.name, region: loc, status: "",
      cost_mtd: prorated(lb.created, priceOf(lbtypes.find((t) => t.id === lb.load_balancer_type?.id), loc)),
      tags: lb.labels || {}, raw: {},
    });
  }

  for (const [kind, service] of [["firewalls", "firewall"], ["floating_ips", "floating_ip"], ["networks", "network"]]) {
    const items = (await httpGet<Record<string, { id: number; name?: string; ip?: string; labels?: Record<string, string> }[]>>(`${API}/${kind}`, h))[kind];
    for (const o of items) {
      rows.push({
        provider: "hetzner", account, service, resource_id: String(o.id),
        name: o.name || o.ip || String(o.id), region: "", status: "", cost_mtd: 0,
        tags: o.labels || {}, raw: {},
      });
    }
  }
  return rows;
}
