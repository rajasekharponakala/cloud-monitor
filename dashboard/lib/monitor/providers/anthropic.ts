import { httpGet } from "../util";
import type { Row } from "../types";

/**
 * Anthropic Analytics API (Claude Code usage report). Token = Admin key.
 * Docs: platform.claude.com/docs/en/manage-claude/analytics-api
 * GET /v1/organizations/usage_report/claude_code?starting_at=YYYY-MM-DD
 */
export async function collect(account: string, token: string): Promise<Row[]> {
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const h = { "x-api-key": token, "anthropic-version": "2023-06-01" };
  const data = await httpGet<Record<string, unknown>>(
    `https://api.anthropic.com/v1/organizations/usage_report/claude_code?starting_at=${start}`, h);

  const rows: Row[] = [];
  const lists = [data.data, data.results, data.usage, data.reports].filter(Array.isArray) as unknown as Record<string, unknown>[][];
  const items = lists.length ? lists[0] : [];
  if (!items.length) {
    // Shape unknown/empty — record that the endpoint answered.
    rows.push({
      provider: "anthropic", account, service: "usage_report",
      resource_id: "claude_code:raw", name: "Claude Code usage (raw)",
      region: "", status: "", cost_mtd: 0,
      tags: {}, raw: JSON.parse(JSON.stringify(data).slice(0, 2000)) as Record<string, unknown>,
    });
    return rows;
  }
  for (const u of items as unknown as {
    date?: string; day?: string; model?: string; user?: string;
    input_tokens?: number; output_tokens?: number;
    cache_creation_input_tokens?: number; cache_read_input_tokens?: number;
    cost_usd?: number; cost?: number;
  }[]) {
    const day = u.date || u.day || "?";
    rows.push({
      provider: "anthropic", account, service: "usage_report",
      resource_id: `claude_code:${u.model || "?"}:${day}`,
      name: u.model || "claude code", region: "", status: "", cost_mtd: u.cost_usd ?? u.cost ?? 0,
      tags: {
        user: u.user || "", input_tokens: u.input_tokens || 0,
        output_tokens: u.output_tokens || 0,
        cache_write: u.cache_creation_input_tokens || 0,
        cache_read: u.cache_read_input_tokens || 0,
      },
      raw: {},
    });
  }
  return rows;
}
