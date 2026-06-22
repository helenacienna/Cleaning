import { NextResponse } from 'next/server';
import { getStaffRosterOverrides, saveStaffRosterOverrides } from '../../../lib/app-settings';

export async function GET() {
  try {
    const overrides = await getStaffRosterOverrides();
    return NextResponse.json({ ok: true, overrides });
  } catch {
    return NextResponse.json({ error: 'Unable to load roster overrides.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const body = await request.json().catch(() => null);
  try {
    const overrides = await saveStaffRosterOverrides(body?.overrides || {});
    return NextResponse.json({ ok: true, overrides });
  } catch (error) {
    const message = String(error?.message ?? 'Unable to save roster overrides.');
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
