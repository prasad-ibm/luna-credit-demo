import { NextResponse } from "next/server";
import { suggestPtpDate } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await suggestPtpDate(body);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("suggest-ptp error:", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
