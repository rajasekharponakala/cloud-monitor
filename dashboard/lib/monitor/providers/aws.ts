import { createHash, createHmac } from "crypto";
import type { Row } from "../types";

function sign(key: Buffer, msg: string): Buffer {
  return createHmac("sha256", key).update(msg).digest();
}

/** SigV4 headers for AWS query-protocol POSTs and CE JSON POSTs. */
export function sigv4(
  url: string, service: string, region: string, ak: string, sk: string,
  body: string, target?: string
): Record<string, string> {
  const u = new URL(url);
  const now = new Date();
  const amzdate = now.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const datestamp = amzdate.slice(0, 8);
  const payloadHash = createHash("sha256").update(body).digest("hex");
  const headers: Record<string, string> = { host: u.host, "x-amz-date": amzdate };
  if (target) {
    headers["x-amz-target"] = target;
    headers["content-type"] = "application/x-amz-json-1.1";
  } else if (body) {
    headers["content-type"] = "application/x-www-form-urlencoded; charset=utf-8";
  }
  const signed = Object.keys(headers).sort().join(";");
  const canonical = [
    "POST", u.pathname || "/",
    "",
    ...Object.keys(headers).sort().map((k) => `${k}:${headers[k]}`),
    "", signed, payloadHash,
  ].join("\n");
  const scope = `${datestamp}/${region}/${service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzdate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  let k = sign(Buffer.from("AWS4" + sk), datestamp);
  k = sign(k, region); k = sign(k, service); k = sign(k, "aws4_request");
  const sig = createHmac("sha256", k).update(toSign).digest("hex");
  headers["Authorization"] = `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=${signed}, Signature=${sig}`;
  return headers;
}

async function postQuery(endpoint: string, service: string, region: string, ak: string, sk: string, params: Record<string, string>) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(endpoint, {
    method: "POST", body, headers: sigv4(endpoint, service, region, ak, sk, body), cache: "no-store",
  });
  if (!res.ok) throw new Error(`${service} -> ${res.status}`);
  return res.text();
}

const tag = (xml: string, name: string): string =>
  xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] || "";

export function parseEc2Instances(xml: string) {
  // Split on <item>; an instance's <tagSet><item> blocks follow its fields,
  // so include the next block when looking up the Name tag.
  const parts = xml.split("<item>");
  const out: { id: string; type: string; state: string; az: string; name: string }[] = [];
  parts.forEach((b, i) => {
    if (!b.includes("<instanceId>")) return;
    const scope = b + (parts[i + 1] || "");
    const id = tag(b, "instanceId");
    out.push({
      id,
      type: tag(b, "instanceType"),
      state: (b.match(/<name>([^<]*)<\/name>/) || [])[1] || "",
      az: tag(b, "availabilityZone"),
      name: (scope.match(/<key>Name<\/key>\s*<value>([^<]*)<\/value>/) || [])[1] || id,
    });
  });
  return out;
}

async function ceMtd(ak: string, sk: string): Promise<{ total: number; groups: [string, number][] }> {
  const now = new Date();
  const start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const body = JSON.stringify({
    TimePeriod: { Start: start, End: now.toISOString().slice(0, 10) },
    Granularity: "MONTHLY", Metrics: ["UnblendedCost"],
    GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
  });
  const endpoint = "https://ce.us-east-1.amazonaws.com/";
  const res = await fetch(endpoint, {
    method: "POST", body,
    headers: sigv4(endpoint, "ce", "us-east-1", ak, sk, body, "AWSOrigamiService_v20190101.GetCostAndUsage"),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ce -> ${res.status}`);
  const data = await res.json();
  let total = 0;
  const groups: [string, number][] = [];
  for (const r of data.ResultsByTime || []) {
    total += parseFloat(r.Total?.UnblendedCost?.Amount || "0");
    for (const g of r.Groups || []) {
      groups.push([g.Keys.join(" "), Math.round(parseFloat(g.Metrics?.UnblendedCost?.Amount || "0") * 10000) / 10000]);
    }
  }
  return { total: Math.round(total * 10000) / 10000, groups };
}

export async function collect(account: string, token: string): Promise<Row[]> {
  const [ak, sk, region = "us-east-1"] = token.split(":");
  const rows: Row[] = [];

  try {
    const xml = await postQuery(`https://ec2.${region}.amazonaws.com/`, "ec2", region, ak, sk, {
      Action: "DescribeInstances", Version: "2016-11-15",
    });
    for (const i of parseEc2Instances(xml)) {
      rows.push({
        provider: "aws", account, service: "ec2", resource_id: i.id, name: i.name,
        region: i.az, status: i.state, cost_mtd: 0,
        tags: { instance_type: i.type }, raw: { type: i.type },
      });
    }
  } catch (e) {
    rows.push({
      provider: "aws", account, service: "api_error", resource_id: "ec2",
      name: "ec2", region, status: "error", cost_mtd: 0,
      tags: { error: String(e).slice(0, 200) }, raw: {},
    });
  }

  try {
    const { total, groups } = await ceMtd(ak, sk);
    rows.push({
      provider: "aws", account, service: "billing", resource_id: "ce:total",
      name: "MTD UnblendedCost", region: "", status: "", cost_mtd: total, tags: {}, raw: {},
    });
    for (const [svc, amt] of groups.sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      rows.push({
        provider: "aws", account, service: "billing", resource_id: `ce:${svc}`,
        name: svc, region: "", status: "", cost_mtd: amt, tags: {}, raw: {},
      });
    }
  } catch (e) {
    rows.push({
      provider: "aws", account, service: "api_error", resource_id: "ce",
      name: "ce", region: "", status: "error", cost_mtd: 0,
      tags: { error: String(e).slice(0, 200) }, raw: {},
    });
  }
  return rows;
}
