import { NextResponse } from "next/server";
import { draftCollectionsMessage } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await draftCollectionsMessage(body);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("draft error:", e);
    return NextResponse.json({ error: e?.message ?? "Internal error" }, { status: 500 });
  }
}
