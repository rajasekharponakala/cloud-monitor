import fs from "fs";
import path from "path";
import type { Account } from "./types";

export type Config = {
  db?: string;
  intervalMinutes?: number;
  port?: number;
  accounts: (Account & { provider: string })[];
};

/** Minimal TOML reader for our schema: [general] + [[account]] string/int values. */
export function loadConfig(file = process.env.CM_CONFIG || "../config.toml"): Config {
  const text = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
  const cfg: Config = { accounts: [] };
  let section = "";
  let current: Record<string, string> | null = null;

  const flush = () => {
    if (current && (current.provider || current.name)) {
      cfg.accounts.push({
        provider: current.provider || "",
        name: current.name || "",
        token: current.token || "",
      });
    }
    current = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "[[account]]") {
      flush();
      section = "account";
      current = {};
      continue;
    }
    const sec = line.match(/^\[(\w+)\]$/);
    if (sec) {
      flush();
      section = sec[1];
      continue;
    }
    const kv = line.match(/^(\w+)\s*=\s*"?([^"]*)"?$/);
    if (!kv) continue;
    const [, k, v] = kv;
    if (section === "general") {
      if (k === "db") cfg.db = v;
      if (k === "interval_minutes") cfg.intervalMinutes = parseInt(v, 10);
      if (k === "port") cfg.port = parseInt(v, 10);
    } else if (section === "account" && current) {
      current[k] = v;
    }
  }
  flush();
  return cfg;
}
