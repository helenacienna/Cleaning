export function taskPhotoUrl(photo, options = {}) {
  const baseUrl = photo?.photoUrl || (photo?.id ? `/api/task-photos/${photo.id}` : '');
  if (!baseUrl || !options.thumbnail) return baseUrl;
  if (baseUrl.startsWith('data:')) return baseUrl;

  const separator = baseUrl.includes('?') ? '&' : '?';
  const width = Number.isFinite(Number(options.width)) ? Math.max(80, Math.min(1200, Number(options.width))) : 480;
  return `${baseUrl}${separator}thumb=1&w=${width}`;
}
