import { loadConfig } from "./config";
import { upsert } from "./db";
import { collect as hetzner } from "./providers/hetzner";
import { collect as digitalocean } from "./providers/digitalocean";
import { collect as cloudflare } from "./providers/cloudflare";
import { collect as dreamhost } from "./providers/dreamhost";
import { collect as godaddy } from "./providers/godaddy";
import { collect as aws } from "./providers/aws";
import { collect as gcp } from "./providers/gcp";

const COLLECTORS: Record<string, (account: string, token: string) => Promise<import("./types").Row[]>> = {
  hetzner, digitalocean, cloudflare, dreamhost, godaddy, aws, gcp,
};

export async function runOnce(): Promise<Record<string, number | string>> {
  const cfg = loadConfig();
  const out: Record<string, number | string> = {};
  for (const acct of cfg.accounts) {
    const fn = COLLECTORS[acct.provider];
    if (!fn) {
      out[`${acct.provider}/${acct.name}`] = "unknown provider";
      continue;
    }
    try {
      const rows = await fn(acct.name, acct.token);
      upsert(rows);
      out[`${acct.provider}/${acct.name}`] = rows.length;
    } catch (e) {
      out[`${acct.provider}/${acct.name}`] = `ERROR ${String(e).slice(0, 200)}`;
    }
  }
  return out;
}
