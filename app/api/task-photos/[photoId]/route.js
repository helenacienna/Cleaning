import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getPrisma } from '../../../../lib/prisma';
import { deleteStoredPhoto, readStoredPhoto } from '../../../../lib/task-photo-storage';
import { isTestingCostControlMode } from '../../../../lib/cost-control';

function shouldServeThumbnail(request) {
  const url = new URL(request.url);
  return url.searchParams.get('thumb') === '1';
}

function thumbnailWidth(request) {
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get('w') || 480);
  const defaultWidth = isTestingCostControlMode() ? 240 : 480;
  const maxWidth = isTestingCostControlMode() ? 360 : 1200;
  if (!Number.isFinite(requested)) return defaultWidth;
  return Math.max(120, Math.min(maxWidth, Math.round(requested)));
}

async function buildThumbnail(stored, width) {
  if (!String(stored.contentType || '').startsWith('image/')) {
    return null;
  }

  try {
    const buffer = await sharp(stored.buffer, { failOn: 'none' })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: isTestingCostControlMode() ? 55 : 72, effort: 4 })
      .toBuffer();
    return { buffer, contentType: 'image/webp' };
  } catch (error) {
    console.warn('task-photo-thumbnail-failed', JSON.stringify({ message: error?.message }));
    return null;
  }
}

export async function GET(request, { params }) {
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

  const thumbnail = shouldServeThumbnail(request)
    ? await buildThumbnail(stored, thumbnailWidth(request))
    : null;
  const payload = thumbnail || stored;

  return new NextResponse(payload.buffer, {
    status: 200,
    headers: {
      'Content-Type': payload.contentType,
      'Cache-Control': 'private, max-age=604800, stale-while-revalidate=86400',
      'Vary': 'Accept',
    },
  });
}

export async function DELETE(_request, { params }) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { photoId } = await params;
  const photo = await prisma.taskPhoto.findUnique({
    where: { id: photoId },
    select: { id: true, photoUrl: true },
  });

  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  await prisma.taskPhoto.delete({
    where: { id: photo.id },
  });

  await deleteStoredPhoto(photo.photoUrl).catch((error) => {
    console.warn('task-photo-delete-file-failed', JSON.stringify({ photoId: photo.id, message: error?.message }));
  });

  return NextResponse.json({ ok: true, deletedPhotoId: photo.id });
}
