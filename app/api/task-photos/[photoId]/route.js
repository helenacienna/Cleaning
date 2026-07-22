import { NextResponse } from 'next/server';
import { getPrisma } from '../../../../lib/prisma';
import { readStoredPhoto } from '../../../../lib/task-photo-storage';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request, { params }) {
  const prisma = await getPrisma();

  if (!prisma) {
    return new NextResponse('Database unavailable', { status: 503 });
  }

  const { photoId } = await params;

  if (!UUID_PATTERN.test(photoId || '')) {
    return new NextResponse('Photo not found', { status: 404 });
  }

  const photo = await prisma.taskPhoto.findUnique({
    where: { id: photoId },
    select: { photoUrl: true },
  });

  if (!photo?.photoUrl) {
    return new NextResponse('Photo not found', { status: 404 });
  }

  const stored = await readStoredPhoto(photo.photoUrl).catch(() => null);

  if (!stored) {
    return new NextResponse('Photo file unavailable', { status: 404 });
  }

  return new NextResponse(stored.buffer, {
    status: 200,
    headers: {
      'Content-Type': stored.contentType,
      'Cache-Control': 'private, max-age=60',
    },
  });
}
