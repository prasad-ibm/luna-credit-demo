import { NextResponse } from "next/server";
import { logActivity, refreshViews } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await logActivity(body);
    await refreshViews();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("log-activity error:", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
