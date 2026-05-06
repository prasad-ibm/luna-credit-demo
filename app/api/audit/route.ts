import { NextResponse } from "next/server";
import { searchAuditTrail } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rows = await searchAuditTrail({
      entity_name: searchParams.get("entity_name") ?? undefined,
      entity_id:   searchParams.get("entity_id")   ?? undefined,
      changed_by:  searchParams.get("changed_by")  ?? undefined,
      from_date:   searchParams.get("from_date")   ?? undefined,
      to_date:     searchParams.get("to_date")     ?? undefined,
    });
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
