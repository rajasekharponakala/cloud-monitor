/* eslint-disable @typescript-eslint/no-require-imports */
import path from "path";
import type { Row } from "./types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS resources (
  provider TEXT, account TEXT, service TEXT, resource_id TEXT,
  name TEXT, region TEXT, status TEXT, cost_mtd REAL,
  tags TEXT, raw TEXT, fetched_at TEXT,
  PRIMARY KEY (provider, account, service, resource_id)
);`;

function dbPath(): string {
  return path.resolve(process.cwd(), process.env.CM_DB || "../cloud-monitor.db");
}

type Db = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...args: unknown[]) => void;
    all: (...args: unknown[]) => Record<string, unknown>[];
  };
  close: () => void;
};

let db: Db | null = null;

export function getDb(): Db {
  if (!db) {
    const { DatabaseSync } = require("node:sqlite") as {
      DatabaseSync: new (path: string) => Db;
    };
    db = new DatabaseSync(dbPath());
    db.exec(SCHEMA);
  }
  return db;
}

export function upsert(rows: Row[]): void {
  const d = getDb();
  const fetched = new Date().toISOString();
  const stmt = d.prepare(`INSERT INTO resources
    (provider, account, service, resource_id, name, region, status, cost_mtd, tags, raw, fetched_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(provider, account, service, resource_id) DO UPDATE SET
      name=excluded.name, region=excluded.region, status=excluded.status,
      cost_mtd=excluded.cost_mtd, tags=excluded.tags, raw=excluded.raw,
      fetched_at=excluded.fetched_at`);
  for (const r of rows) {
    stmt.run(
      r.provider, r.account, r.service, r.resource_id,
      r.name || "", r.region || "", r.status || "", r.cost_mtd || 0,
      JSON.stringify(r.tags || {}), JSON.stringify(r.raw || {}).slice(0, 8000), fetched
    );
  }
}

export function getSummary() {
  return getDb()
    .prepare("SELECT provider, COUNT(*) as n, ROUND(SUM(cost_mtd),2) as cost FROM resources GROUP BY provider")
    .all();
}

export function getResources(limit = 500) {
  return getDb()
    .prepare("SELECT * FROM resources ORDER BY cost_mtd DESC LIMIT ?")
    .all(limit);
}
