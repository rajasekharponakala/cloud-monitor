/* eslint-disable @typescript-eslint/no-require-imports */
import fs from "fs";
import os from "os";
import path from "path";
import type { Row } from "../types";

/**
 * OpenCode local usage. Token = path to opencode.db (default ~/.local/share/opencode/opencode.db).
 * Reads session_v2 aggregates (cost + tokens per session). DB copied to tmp first (WAL-safe).
 */
export async function collect(account: string, token: string): Promise<Row[]> {
  const src = token || path.join(os.homedir(), ".local/share/opencode/opencode.db");
  if (!fs.existsSync(src)) {
    return [{
      provider: "opencode", account, service: "api_error", resource_id: "db",
      name: "opencode.db not found", region: "", status: "error", cost_mtd: 0,
      tags: { expected: src }, raw: {},
    }];
  }
  const tmp = path.join(os.tmpdir(), `opencode-monitor-${process.pid}.db`);
  fs.copyFileSync(src, tmp);
  try {
    const { DatabaseSync } = require("node:sqlite") as {
      DatabaseSync: new (p: string) => {
        prepare: (sql: string) => { all: (...a: unknown[]) => Record<string, unknown>[] };
        close: () => void;
      };
    };
    const db = new DatabaseSync(tmp);
    // model column may be plain text or a JSON blob -> normalize to model id.
    const days = db.prepare(`
      SELECT date(time_created/1000, 'unixepoch') AS day,
             COALESCE(json_extract(model, '$.id'), model) AS model,
             COUNT(*) AS sessions, SUM(cost) AS cost,
             SUM(tokens_input) AS ti, SUM(tokens_output) AS tout,
             SUM(tokens_reasoning) AS tr, SUM(tokens_cache_read) AS tcr,
             SUM(tokens_cache_write) AS tcw
      FROM session_v2 GROUP BY day, model ORDER BY day DESC LIMIT 90`).all();
    db.close();
    return (days as unknown as {
      day: string; model: string; sessions: number; cost: number;
      ti: number; tout: number; tr: number; tcr: number; tcw: number;
    }[]).map((d) => ({
      provider: "opencode", account, service: "session",
      resource_id: `session:${d.model || "?"}:${d.day}`,
      name: d.model || "unknown model", region: "", status: "",
      cost_mtd: Math.round((d.cost || 0) * 10000) / 10000,
      tags: {
        sessions: d.sessions, day: d.day,
        input_tokens: d.ti || 0, output_tokens: d.tout || 0,
        reasoning_tokens: d.tr || 0, cache_read: d.tcr || 0, cache_write: d.tcw || 0,
      },
      raw: {},
    }));
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}
