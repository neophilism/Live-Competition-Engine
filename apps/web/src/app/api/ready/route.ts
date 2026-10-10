import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@live-competition-engine/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkDatabaseConnection();
    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json(
      { status: "not_ready" },
      { status: 503 }
    );
  }
}
