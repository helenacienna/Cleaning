import { NextResponse } from 'next/server';
import { getPrisma } from '../../../../lib/prisma';

export async function PATCH(request, { params }) {
  const prisma = await getPrisma();
  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const active = typeof body?.active === 'boolean' ? body.active : null;

  if (!name) {
    return NextResponse.json({ error: 'Facility name is required' }, { status: 400 });
  }

  try {
    const facility = await prisma.facility.update({
      where: { id: params.facilityId },
      data: {
        name,
        ...(active === null ? {} : { active }),
      },
      select: {
        id: true,
        facilityCode: true,
        name: true,
        active: true,
      },
    });

    return NextResponse.json({ ok: true, facility });
  } catch {
    return NextResponse.json({ error: 'Unable to update facility' }, { status: 400 });
  }
}
