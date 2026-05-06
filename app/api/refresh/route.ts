import { NextResponse } from "next/server";
import { refreshViews } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  try {
    await refreshViews();
    return NextResponse.json({ ok: true, refreshed_at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Refresh failed" }, { status: 500 });
  }
}
