import { httpGet } from "../util";
import type { Row } from "../types";

const API = "https://api.cloudflare.com/client/v4";

export async function collect(account: string, token: string): Promise<Row[]> {
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const rows: Row[] = [];
  let page = 1;
  for (;;) {
    const data = await httpGet<{
      result: { id: string; name: string; status: string; type: string; plan?: { name: string } }[];
      result_info?: { total_pages: number };
    }>(`${API}/zones?per_page=50&page=${page}`, h);
    for (const z of data.result) {
      rows.push({
        provider: "cloudflare", account, service: "zone", resource_id: z.id,
        name: z.name, region: "", status: z.status, cost_mtd: 0,
        tags: { plan: z.plan?.name || "" }, raw: { type: z.type },
      });
    }
    if (page >= (data.result_info?.total_pages || 1)) break;
    page++;
  }
  return rows;
}
