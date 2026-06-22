import { NextResponse } from 'next/server';
import { getDashboardStaffOrderSettings, saveDashboardStaffOrderSettings } from '../../../lib/app-settings';

export async function GET() {
  const settings = await getDashboardStaffOrderSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request) {
  const body = await request.json().catch(() => null);

  if (!body?.settings || typeof body.settings !== 'object') {
    return NextResponse.json({ ok: false, error: 'Settings payload required' }, { status: 400 });
  }

  try {
    const settings = await saveDashboardStaffOrderSettings(body.settings);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Unable to save staff order settings' }, { status: 503 });
  }
}
