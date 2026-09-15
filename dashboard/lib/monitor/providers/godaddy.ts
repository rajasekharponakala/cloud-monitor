import { httpGet } from "../util";
import type { Row } from "../types";

const API = "https://api.godaddy.com/v1";

export async function collect(account: string, token: string): Promise<Row[]> {
  const h = { Authorization: `sso-key ${token}` };
  let domains: { domainId?: number; domain?: string; status?: string; expires?: string; renewalPrice?: number }[];
  try {
    domains = await httpGet(`${API}/domains`, h);
  } catch (e) {
    return [{
      provider: "godaddy", account, service: "api_error", resource_id: "domains",
      name: "domains", region: "", status: "error", cost_mtd: 0,
      tags: { error: String(e).slice(0, 200) }, raw: {},
    }];
  }
  return domains.map((d) => ({
    provider: "godaddy", account, service: "domain",
    resource_id: String(d.domainId ?? d.domain), name: d.domain || "",
    region: "", status: d.status || "", cost_mtd: 0,
    tags: { expires: String(d.expires || "") }, raw: { renewal: d.renewalPrice },
  }));
}
