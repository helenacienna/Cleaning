export function formatStaffRole(role = '') {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return 'Building manager';
  if (normalized === 'supervisor') return 'Cleaning supervisor';
  if (normalized === 'organiser') return 'Organiser';
  return 'Cleaner';
}

export function canReceiveCleaningTasks(role = '') {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'cleaner' || normalized === 'supervisor';
}
