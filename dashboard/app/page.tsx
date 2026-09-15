"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "";

type Summary = { provider: string; n: number; cost: number };
type Resource = {
  provider: string; service: string; name: string; region: string;
  status: string; cost_mtd: number; fetched_at: string; account: string;
};

export default function Home() {
  const [summary, setSummary] = useState<Summary[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/summary`).then((r) => r.json()),
      fetch(`${API}/api/resources`).then((r) => r.json()),
    ])
      .then(([s, r]) => {
        setSummary(s);
        setResources(r);
      })
      .catch(() => setError(`Cannot reach API at ${API}. Start it: python3 -m monitor.server`));
  }, []);

  const total = summary.reduce((a, s) => a + (s.cost || 0), 0);

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1>Cloud Monitor</h1>
      <p>
        Hetzner · DigitalOcean · Cloudflare · DreamHost · GoDaddy · AWS · GCP · AI (OpenAI, Anthropic, OpenRouter, OpenCode, Claude Code) —{" "}
        <b>${total.toFixed(2)} MTD est.</b>
      </p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {summary.map((s) => (
          <div key={s.provider} style={{ border: "1px solid #ccc", padding: 16, minWidth: 160 }}>
            <b>{s.provider}</b>
            <br />
            {s.n} resources
            <br />${s.cost} MTD est.
          </div>
        ))}
      </div>
      <h2>Top costs</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["provider", "account", "service", "name", "region", "status", "cost MTD"].map((h) => (
              <th key={h} style={{ border: "1px solid #ddd", padding: 6, textAlign: "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources
            .sort((a, b) => b.cost_mtd - a.cost_mtd)
            .slice(0, 200)
            .map((r, i) => (
              <tr key={i}>
                <td style={td}>{r.provider}</td>
                <td style={td}>{r.account}</td>
                <td style={td}>{r.service}</td>
                <td style={td}>{r.name}</td>
                <td style={td}>{r.region}</td>
                <td style={td}>{r.status}</td>
                <td style={td}>{r.cost_mtd}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </main>
  );
}

const td: React.CSSProperties = { border: "1px solid #ddd", padding: 6 };
