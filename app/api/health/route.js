import { NextResponse } from 'next/server';
import { getOrganiserBoardData } from '../../../lib/app-data';
import { buildDashboardHealth } from '../../../lib/dashboard-health';

export async function GET() {
  const { board, source, timeZone } = await getOrganiserBoardData({
    includeMaintenance: false,
    includeInboxSummary: false,
  });
  const dashboard = buildDashboardHealth({ board, source, timeZone });
  const status = dashboard.ok ? 200 : 503;

  return NextResponse.json({
    ok: dashboard.ok,
    dashboard,
  }, { status });
}
