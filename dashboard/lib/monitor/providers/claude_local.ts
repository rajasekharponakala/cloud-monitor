import fs from "fs";
import os from "os";
import path from "path";
import type { Row } from "../types";

/**
 * Claude Code local transcripts. Token = ~/.claude/projects dir (default).
 * Sums message.usage per day + model from *.jsonl. Cost = rough estimate
 * from public per-MTok rates (input/output only); tokens always exact in tags.
 */
const RATES: { match: RegExp; input: number; output: number }[] = [
  { match: /opus/i, input: 15, output: 75 },
  { match: /sonnet/i, input: 3, output: 15 },
  { match: /haiku/i, input: 0.8, output: 4 },
];

function estCost(model: string, input: number, output: number): number {
  const r = RATES.find((x) => x.match.test(model));
  if (!r) return 0;
  return (input / 1e6) * r.input + (output / 1e6) * r.output;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".jsonl")) out.push(p);
  }
  return out;
}

export async function collect(account: string, token: string): Promise<Row[]> {
  const dir = token || path.join(os.homedir(), ".claude/projects");
  if (!fs.existsSync(dir)) {
    return [{
      provider: "claudecode", account, service: "api_error", resource_id: "dir",
      name: "projects dir not found", region: "", status: "error", cost_mtd: 0,
      tags: { expected: dir }, raw: {},
    }];
  }
  // day+model -> {in, out}
  const agg = new Map<string, { in: number; out: number; sessions: Set<string> }>();
  for (const file of walk(dir)) {
    const session = path.basename(file, ".jsonl");
    let day = "?";
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let d: { type?: string; timestamp?: string; message?: { model?: string; usage?: {
        input_tokens?: number; output_tokens?: number } } };
      try { d = JSON.parse(line); } catch { continue; }
      const u = d.message?.usage;
      if (!u) continue;
      if (d.timestamp) day = d.timestamp.slice(0, 10);
      const model = d.message?.model || "claude";
      const key = `${day}	${model}`;
      const a = agg.get(key) || { in: 0, out: 0, sessions: new Set<string>() };
      a.in += u.input_tokens || 0;
      a.out += u.output_tokens || 0;
      a.sessions.add(session);
      agg.set(key, a);
    }
  }
  return Array.from(agg.entries()).map(([key, a]) => {
    const [day, model] = key.split("	");
    return {
      provider: "claudecode", account, service: "transcript",
      resource_id: `transcript:${model}:${day}`,
      name: model, region: "", status: "",
      cost_mtd: Math.round(estCost(model, a.in, a.out) * 10000) / 10000,
      tags: {
        day, sessions: a.sessions.size,
        input_tokens: a.in, output_tokens: a.out,
        cost_note: "estimate from public per-MTok rates; tokens exact",
      },
      raw: {},
    };
  });
}
