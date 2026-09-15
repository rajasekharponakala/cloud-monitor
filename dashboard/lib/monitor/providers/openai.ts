import { httpGet } from "../util";
import type { Row } from "../types";

/**
 * OpenAI Usage + Costs API. Token = Org Admin key.
 * Docs: developers.openai.com — /v1/organization/usage/completions, /v1/organization/costs
 */
export async function collect(account: string, token: string): Promise<Row[]> {
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const rows: Row[] = [];
  const start = Math.floor(Date.now() / 1000) - 30 * 86400;

  const costs = await httpGet<{ data?: { amount?: { value?: number }; start_time?: number }[] }>(
    `https://api.openai.com/v1/organization/costs?start_time=${start}&bucket_width=1d&limit=31`, h);
  let total = 0;
  for (const b of costs.data || []) {
    const amt = b.amount?.value || 0;
    total += amt;
    rows.push({
      provider: "openai", account, service: "costs",
      resource_id: `costs:${b.start_time ? new Date(b.start_time * 1000).toISOString().slice(0, 10) : "?"}`,
      name: "API costs (daily)", region: "", status: "",
      cost_mtd: Math.round(amt * 10000) / 10000, tags: {}, raw: {},
    });
  }
  rows.push({
    provider: "openai", account, service: "costs", resource_id: "costs:total-30d",
    name: "API costs (30d total)", region: "", status: "",
    cost_mtd: Math.round(total * 10000) / 10000, tags: {}, raw: {},
  });

  const usage = await httpGet<{ data?: Record<string, never>[] }>(
    `https://api.openai.com/v1/organization/usage/completions?start_time=${start}&bucket_width=1d&limit=31&group_by=model`, h);
  for (const b of (usage.data || []) as unknown as {
    model?: string; start_time?: number;
    input_tokens?: number; output_tokens?: number; num_model_requests?: number;
  }[]) {
    rows.push({
      provider: "openai", account, service: "usage",
      resource_id: `usage:${b.model || "?"}:${b.start_time ? new Date(b.start_time * 1000).toISOString().slice(0, 10) : "?"}`,
      name: b.model || "unknown model", region: "", status: "", cost_mtd: 0,
      tags: {
        input_tokens: b.input_tokens || 0, output_tokens: b.output_tokens || 0,
        requests: b.num_model_requests || 0,
      },
      raw: {},
    });
  }
  return rows;
}
