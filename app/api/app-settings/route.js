import { NextResponse } from 'next/server';
import { getAppSettingsEditorData, saveAppSettings } from '../../../lib/app-settings';

export async function GET() {
  const editorData = await getAppSettingsEditorData();

  return NextResponse.json({
    ok: true,
    settings: editorData.settings,
    timeZone: editorData.timeZone,
    timeZoneOptions: editorData.timeZoneOptions,
    source: editorData.source,
    staffNames: editorData.staffNames,
    facilityNames: editorData.facilityNames,
  });
}

export async function PATCH(request) {
  const body = await request.json().catch(() => null);

  if ((!body?.settings || typeof body.settings !== 'object') && !body?.timeZone) {
    return NextResponse.json({ ok: false, error: 'Settings payload required' }, { status: 400 });
  }

  try {
    const saved = await saveAppSettings({
      settings: body?.settings,
      timeZone: body?.timeZone,
    });
    return NextResponse.json({ ok: true, ...saved, message: 'Settings saved.' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Unable to save settings' }, { status: 503 });
  }
}
