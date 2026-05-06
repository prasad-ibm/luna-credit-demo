import { NextResponse } from "next/server";
import { customerNarrative } from "@/lib/claude";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = await customerNarrative(body);
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
