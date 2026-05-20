import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getRecentErpSyncLogs } from "@/lib/store-admin";

export async function GET() {
  await requireAdmin();

  const recentLogs = await getRecentErpSyncLogs(5);
  const activeLog = recentLogs.find((log) => log.status === "RUNNING") ?? null;

  return NextResponse.json({
    activeLog,
    recentLogs,
  });
}
