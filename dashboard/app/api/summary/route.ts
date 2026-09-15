export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSummary } from "@/lib/monitor/db";

export async function GET() {
  return NextResponse.json(getSummary());
}