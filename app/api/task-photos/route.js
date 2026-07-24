import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { saveTaskPhotoFile } from '../../../lib/task-photo-storage';

function normalisePhotoType(value) {
  return ['completion', 'exception', 'audit'].includes(value) ? value : 'completion';
}

export async function POST(request) {
  const prisma = await getPrisma();

  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const formData = await request.formData().catch((error) => {
    console.warn('task-photo-upload-formdata-parse-failed', {
      contentType: request.headers.get('content-type'),
      contentLength: request.headers.get('content-length'),
      userAgent: request.headers.get('user-agent'),
      message: error?.message,
    });
    return null;
  });
  const formEntries = formData ? Array.from(formData.entries()) : [];
  const taskInstanceId = formData?.get('taskInstanceId');
  const photoType = normalisePhotoType(formData?.get('photoType'));
  const file = formData?.get('file');

  if (typeof taskInstanceId !== 'string' || !file || typeof file.arrayBuffer !== 'function') {
    console.warn('task-photo-upload-invalid-payload', {
      contentType: request.headers.get('content-type'),
      contentLength: request.headers.get('content-length'),
      userAgent: request.headers.get('user-agent'),
      fieldSummary: formEntries.map(([key, value]) => ({
        key,
        type: typeof value,
        constructorName: value?.constructor?.name || null,
        hasArrayBuffer: typeof value?.arrayBuffer === 'function',
        size: typeof value?.size === 'number' ? value.size : null,
        name: typeof value?.name === 'string' ? value.name : null,
      })),
      hasTaskInstanceId: typeof taskInstanceId === 'string',
      hasFile: Boolean(file),
      fileHasArrayBuffer: typeof file?.arrayBuffer === 'function',
    });
    return NextResponse.json({ error: 'Task and photo file are required' }, { status: 400 });
  }

  const taskInstance = await prisma.taskInstance.findUnique({
    where: { id: taskInstanceId },
    select: {
      id: true,
      assignedStaffId: true,
    },
  });

  if (!taskInstance) {
    return NextResponse.json({ error: 'Task instance not found' }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || 'application/octet-stream';
  const photoId = crypto.randomUUID();
  let photoUrl;

  try {
    photoUrl = await saveTaskPhotoFile({ photoId, buffer, mimeType });
  } catch {
    photoUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const execution = await tx.taskExecution.upsert({
      where: { taskInstanceId },
      update: {
        startedAt: now,
        completedByStaffId: taskInstance.assignedStaffId,
      },
      create: {
        taskInstanceId,
        startedAt: now,
        completedByStaffId: taskInstance.assignedStaffId,
        completionStatus: 'partial',
      },
    });

    const photo = await tx.taskPhoto.create({
      data: {
        id: photoId,
        taskExecutionId: execution.id,
        photoUrl,
        photoType,
      },
    });

    return photo;
  }, {
    timeout: 20000,
  });

  return NextResponse.json({
    ok: true,
    photoId: result.id,
    photoUrl: result.photoUrl,
    message: 'Photo uploaded',
  });
}
