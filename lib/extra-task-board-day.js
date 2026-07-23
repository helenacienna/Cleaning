export function parseExtraTaskBoardDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day ?? ''))) {
    return null;
  }

  const dateOnly = new Date(`${day}T00:00:00.000Z`);
  const localStart = new Date(`${day}T00:00:00+10:00`);

  return {
    dateOnly,
    localStart,
    localEnd: new Date(localStart.getTime() + 24 * 60 * 60 * 1000),
    dueAt: new Date(`${day}T09:00:00+10:00`),
  };
}
