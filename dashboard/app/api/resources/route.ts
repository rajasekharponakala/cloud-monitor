import { NextResponse } from "next/server";
import { getResources } from "@/lib/monitor/db";

export async function GET() {
  return NextResponse.json(getResources());
}
