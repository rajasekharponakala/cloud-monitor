export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { runOnce } from "@/lib/monitor/collect";

/** POST /api/collect — run all collectors. Bearer CRON_SECRET if set. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runOnce();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}