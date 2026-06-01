import { NextResponse } from 'next/server';
import { getPrisma } from '../../../../lib/prisma';
import { readStoredPhoto } from '../../../../lib/task-photo-storage';

export async function GET(_request, { params }) {
  const prisma = await getPrisma();

  if (!prisma) {
    return new NextResponse('Database unavailable', { status: 503 });
  }

  const { photoId } = await params;
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
