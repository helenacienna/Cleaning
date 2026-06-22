import BoardThemeSettings from './BoardThemeSettings';
import { getAppSettingsEditorData } from '../../../lib/app-settings';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Settings · Cienna Cleaning',
};

export default async function AdminSettingsPage() {
  const { settings, source, staffNames, facilityNames, timeZone, timeZoneOptions } = await getAppSettingsEditorData();

  return (
    <BoardThemeSettings
      initialSettings={settings}
      initialTimeZone={timeZone}
      timeZoneOptions={timeZoneOptions}
      source={source}
      staffNames={staffNames}
      facilityNames={facilityNames}
    />
  );
}
