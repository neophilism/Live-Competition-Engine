import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function buildHealthPayload(now = new Date()) {
  return {
    status: "ok" as const,
    service: "live-competition-engine",
    timestamp: now.toISOString()
  };
}

export function GET() {
  return NextResponse.json(buildHealthPayload());
}
