import type { Row } from "../types";

const API = "https://api.dreamhost.com/";

async function call(key: string, cmd: string): Promise<Record<string, never>> {
  const res = await fetch(`${API}?key=${encodeURIComponent(key)}&cmd=${cmd}&format=json`, { cache: "no-store" });
  return res.json();
}

export async function collect(account: string, token: string): Promise<Row[]> {
  const rows: Row[] = [];
  const cmds: [string, string][] = [
    ["domain-list_domains", "domain"],
    ["dns-list_records", "dns_record"],
  ];
  for (const [cmd, service] of cmds) {
    let data: { data?: unknown };
    try {
      data = await call(token, cmd);
    } catch (e) {
      rows.push({
        provider: "dreamhost", account, service: "api_error", resource_id: cmd,
        name: cmd, region: "", status: "error", cost_mtd: 0,
        tags: { error: String(e).slice(0, 200) }, raw: {},
      });
      continue;
    }
    let items = (data.data || []) as unknown;
    if (!Array.isArray(items)) items = [items];
    for (const o of items as Record<string, unknown>[]) {
      if (typeof o !== "object" || !o) continue;
      const rid = String(o.domain || o.record || "?");
      rows.push({
        provider: "dreamhost", account, service, resource_id: `${cmd}:${rid}`,
        name: String(o.domain || o.record || rid), region: "", status: "", cost_mtd: 0,
        tags: {}, raw: Object.fromEntries(Object.entries(o).slice(0, 8)) as Record<string, unknown>,
      });
    }
  }
  return rows;
}
