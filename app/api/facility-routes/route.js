import { NextResponse } from 'next/server';
import { getPrisma } from '../../../lib/prisma';

const DEFAULT_ROUTE_NAME = 'Default route';

function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

async function findFacility(prisma, value) {
  const raw = normalizeName(value);
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const facilityMatchers = [
    { facilityCode: { equals: raw, mode: 'insensitive' } },
    { name: { equals: raw, mode: 'insensitive' } },
    { name: { equals: lower === 'holiday' ? 'Best Stays' : raw, mode: 'insensitive' } },
  ];

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    facilityMatchers.unshift({ id: raw });
  }

  return prisma.facility.findFirst({
    where: {
      active: true,
      OR: facilityMatchers,
    },
  });
}

async function getFacilityTemplates(prisma, facilityId) {
  return prisma.taskTemplate.findMany({
    where: { facilityId, active: true },
    include: { zone: true, taskGroup: true },
    orderBy: [{ defaultSequence: 'asc' }, { zone: { name: 'asc' } }, { title: 'asc' }],
  });
}

function mapRoute(route) {
  return {
    id: route.id,
    name: route.name,
    isDefault: route.isDefault,
    active: route.active,
    items: [...(route.items ?? [])]
      .sort((left, right) => left.sequence - right.sequence)
      .map((item) => ({
        id: item.id,
        sequence: item.sequence,
        taskTemplateId: item.taskTemplateId,
        taskTemplateCode: item.taskTemplate?.taskTemplateCode ?? null,
        title: item.taskTemplate?.title ?? '',
        zone: item.taskTemplate?.zone?.name ?? '',
        taskGroup: item.taskTemplate?.taskGroup?.name ?? '',
      })),
  };
}

async function listRoutes(prisma, facilityId) {
  return prisma.cleaningRoute.findMany({
    where: { facilityId, active: true },
    include: {
      items: {
        include: {
          taskTemplate: { include: { zone: true, taskGroup: true } },
        },
        orderBy: { sequence: 'asc' },
      },
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
}

async function ensureDefaultRoute(prisma, facility) {
  const existing = await prisma.cleaningRoute.findFirst({
    where: { facilityId: facility.id, isDefault: true, active: true },
  });

  if (existing) return existing;

  const templates = await getFacilityTemplates(prisma, facility.id);

  return prisma.$transaction(async (tx) => {
    const route = await tx.cleaningRoute.create({
      data: { facilityId: facility.id, name: DEFAULT_ROUTE_NAME, isDefault: true },
    });

    if (templates.length) {
      await tx.cleaningRouteItem.createMany({
        data: templates.map((template, index) => ({
          routeId: route.id,
          taskTemplateId: template.id,
          sequence: Number.isFinite(template.defaultSequence) ? template.defaultSequence : (index + 1) * 10,
        })),
        skipDuplicates: true,
      });
    }

    return route;
  });
}

async function resolveTemplateIds(prisma, body) {
  const orderedTemplateIds = Array.isArray(body?.orderedTemplateIds)
    ? body.orderedTemplateIds.filter((id) => typeof id === 'string' && id.trim())
    : [];
  const orderedInstanceIds = Array.isArray(body?.orderedInstanceIds)
    ? body.orderedInstanceIds.filter((id) => typeof id === 'string' && id.trim())
    : [];

  if (orderedTemplateIds.length) {
    return [...new Set(orderedTemplateIds)];
  }

  if (!orderedInstanceIds.length) {
    return [];
  }

  const instances = await prisma.taskInstance.findMany({
    where: { id: { in: orderedInstanceIds } },
    select: { id: true, taskTemplateId: true },
  });
  const instanceById = new Map(instances.map((instance) => [instance.id, instance]));

  return [...new Set(orderedInstanceIds.map((id) => instanceById.get(id)?.taskTemplateId).filter(Boolean))];
}

async function saveRouteItems(prisma, routeId, templateIds) {
  await prisma.$transaction(async (tx) => {
    await tx.cleaningRouteItem.deleteMany({ where: { routeId } });
    if (templateIds.length) {
      await tx.cleaningRouteItem.createMany({
        data: templateIds.map((taskTemplateId, index) => ({
          routeId,
          taskTemplateId,
          sequence: (index + 1) * 10,
        })),
      });
    }
  }, { timeout: 30000 });
}

export async function GET(request) {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const facility = await findFacility(prisma, searchParams.get('facility'));
  if (!facility) return NextResponse.json({ error: 'Facility not found' }, { status: 404 });

  await ensureDefaultRoute(prisma, facility);
  const routes = await listRoutes(prisma, facility.id);

  return NextResponse.json({
    ok: true,
    facility: { id: facility.id, name: facility.name, facilityCode: facility.facilityCode },
    routes: routes.map(mapRoute),
  });
}

export async function POST(request) {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const facility = await findFacility(prisma, body?.facility);
  const name = normalizeName(body?.name);

  if (!facility) return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
  if (!name) return NextResponse.json({ error: 'Route name required' }, { status: 400 });

  await ensureDefaultRoute(prisma, facility);
  const templateIds = await resolveTemplateIds(prisma, body);
  const route = await prisma.cleaningRoute.create({
    data: { facilityId: facility.id, name, isDefault: Boolean(body?.isDefault) },
  });

  if (body?.isDefault) {
    await prisma.cleaningRoute.updateMany({
      where: { facilityId: facility.id, id: { not: route.id } },
      data: { isDefault: false },
    });
  }

  await saveRouteItems(prisma, route.id, templateIds.length ? templateIds : (await getFacilityTemplates(prisma, facility.id)).map((template) => template.id));
  const routes = await listRoutes(prisma, facility.id);

  return NextResponse.json({ ok: true, routeId: route.id, routes: routes.map(mapRoute) });
}

export async function PATCH(request) {
  const prisma = await getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const routeId = typeof body?.routeId === 'string' ? body.routeId : '';
  if (!routeId) return NextResponse.json({ error: 'Route ID required' }, { status: 400 });

  const route = await prisma.cleaningRoute.findUnique({ where: { id: routeId }, include: { facility: true } });
  if (!route) return NextResponse.json({ error: 'Route not found' }, { status: 404 });

  const data = {};
  const name = normalizeName(body?.name);
  if (name) data.name = name;
  if (typeof body?.isDefault === 'boolean') data.isDefault = body.isDefault;
  if (typeof body?.active === 'boolean') data.active = body.active;

  if (Object.keys(data).length) {
    await prisma.cleaningRoute.update({ where: { id: routeId }, data });
  }

  if (body?.isDefault === true) {
    await prisma.cleaningRoute.updateMany({
      where: { facilityId: route.facilityId, id: { not: routeId } },
      data: { isDefault: false },
    });
  }

  const templateIds = await resolveTemplateIds(prisma, body);
  if (templateIds.length) {
    await saveRouteItems(prisma, routeId, templateIds);
  }

  const routes = await listRoutes(prisma, route.facilityId);
  return NextResponse.json({ ok: true, routes: routes.map(mapRoute) });
}
