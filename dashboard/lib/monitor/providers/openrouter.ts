import { httpGet } from "../util";
import type { Row } from "../types";

/**
 * OpenRouter key credits. Token = OpenRouter API key.
 * Docs: openrouter.ai/docs/api_reference/limits — GET /api/v1/key
 */
export async function collect(account: string, token: string): Promise<Row[]> {
  const data = await httpGet<{ data?: {
    label?: string; limit?: number | null; limit_remaining?: number | null;
    usage?: number; usage_daily?: number; usage_weekly?: number; usage_monthly?: number;
  } }>("https://openrouter.ai/api/v1/key", { Authorization: `Bearer ${token}` });
  const d = data.data || {};
  return [{
    provider: "openrouter", account, service: "credits", resource_id: "key",
    name: d.label || "api key", region: "", status: "", cost_mtd: d.usage_monthly || 0,
    tags: {
      limit: d.limit ?? "unlimited", limit_remaining: d.limit_remaining ?? "unlimited",
      usage_total: d.usage || 0, usage_daily: d.usage_daily || 0, usage_weekly: d.usage_weekly || 0,
    },
    raw: {},
  }];
}
