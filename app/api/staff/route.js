import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';
import { normalizeWeeklyRoster } from '../../../lib/staff-roster';

const VALID_ROLES = new Set(['cleaner', 'supervisor', 'manager', 'organiser']);

function parsePayload(body) {
  const staffCode = typeof body?.staffCode === 'string' ? body.staffCode.trim().toUpperCase() : '';
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const role = typeof body?.role === 'string' ? body.role.trim().toLowerCase() : 'cleaner';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const preferredTimeWindow = typeof body?.preferredTimeWindow === 'string' ? body.preferredTimeWindow.trim().toLowerCase() : '';
  const preferredShiftLabel = typeof body?.preferredShiftLabel === 'string' ? body.preferredShiftLabel.trim() : '';
  const availabilityNotes = typeof body?.availabilityNotes === 'string' ? body.availabilityNotes.trim() : '';
  const weeklyAvailability = body?.weeklyAvailability && typeof body.weeklyAvailability === 'object' ? body.weeklyAvailability : {};
  const active = typeof body?.active === 'boolean' ? body.active : true;

  return {
    staffCode,
    fullName,
    role: VALID_ROLES.has(role) ? role : null,
    phone: phone || null,
    preferredTimeWindow: ['morning', 'afternoon', 'flexible'].includes(preferredTimeWindow) ? preferredTimeWindow : null,
    preferredShiftLabel: preferredShiftLabel || null,
    availabilityNotes: availabilityNotes || null,
    weeklyAvailability,
    active,
  };
}

function mapStaff(staff) {
  return {
    id: staff.id,
    staffCode: staff.staffCode,
    fullName: staff.fullName,
    role: staff.role,
    phone: staff.phone ?? '',
    preferredTimeWindow: staff.preferredTimeWindow ?? '',
    preferredShiftLabel: staff.preferredShiftLabel ?? '',
    availabilityNotes: staff.availabilityNotes ?? '',
    weeklyAvailability: normalizeWeeklyRoster(staff.weeklyAvailability),
    active: staff.active,
    summary: {
      assignedShiftRuns: 0,
      assignedTasks: 0,
      completedExecutions: 0,
      audits: 0,
      inboxParticipants: 0,
      facilities: [],
    },
    recentAssignments: [],
  };
}

export async function POST(request) {
  const prisma = await getPrisma();
  if (!prisma) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const payload = parsePayload(body);

  if (!payload.staffCode || !payload.fullName || !payload.role) {
    return NextResponse.json({ error: 'Staff code, full name, and role are required.' }, { status: 400 });
  }

  try {
    const staff = await prisma.staff.create({
      data: payload,
    });

    return NextResponse.json({ ok: true, staff: mapStaff(staff) });
  } catch (error) {
    const message = String(error?.message ?? '');
    if (message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'That staff code already exists.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unable to create staff member.' }, { status: 400 });
  }
}
