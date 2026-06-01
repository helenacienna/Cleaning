import { scheduleBuilder, taskCardTemplates } from '../data/demo-data';
import { getPrisma } from './prisma';

function shouldUsePrisma() {
  return process.env.ENABLE_PRISMA_DATA === 'true';
}

function getDemoLibraryData(source = 'demo') {
  return {
    cards: taskCardTemplates,
    zones: [...new Set(taskCardTemplates.map((card) => card.zone))].sort(),
    source,
  };
}

function getDemoOrganiserData(source = 'demo') {
  return {
    board: scheduleBuilder.allocationBoard,
    source,
  };
}

function mapTaskTemplateToLibraryCard(taskTemplate) {
  return {
    id: taskTemplate.id,
    title: taskTemplate.title,
    templateId: taskTemplate.taskTemplateCode,
    jobOrderNumber: String(taskTemplate.defaultSequence).padStart(3, '0'),
    taskGroup: taskTemplate.taskGroup?.name ?? '',
    zone: taskTemplate.zone?.name ?? '',
    facility: taskTemplate.facility?.name ?? '',
    frequency: taskTemplate.recurrenceType,
    frequencyType: taskTemplate.priority === 'critical' ? 'Critical' : 'Suggestive',
    required: taskTemplate.evidenceRequirement === 'required_photo'
      ? 'Forced photo'
      : taskTemplate.commentRequirement === 'always'
        ? 'Comment on exception'
        : taskTemplate.evidenceRequirement === 'optional_photo'
          ? 'Random photo eligible'
          : 'Standard',
    estimatedEffort: taskTemplate.estimatedMinutes && taskTemplate.estimatedMinutes >= 20
      ? 'Detailed pass'
      : taskTemplate.estimatedMinutes && taskTemplate.estimatedMinutes >= 10
        ? 'Standard pass'
        : 'Quick check',
    lastCompleted: taskTemplate.status?.lastCompletedAt
      ? new Date(taskTemplate.status.lastCompletedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
    suggestedDue: taskTemplate.status?.nextDueAt
      ? new Date(taskTemplate.status.nextDueAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
    notes: taskTemplate.description ?? '',
    active: taskTemplate.active,
  };
}

export async function getTaskCardLibraryData() {
  if (!shouldUsePrisma()) {
    return getDemoLibraryData();
  }

  const prisma = await getPrisma();
  if (!prisma) {
    return getDemoLibraryData('demo-no-db');
  }

  try {
    const templates = await prisma.taskTemplate.findMany({
      include: {
        facility: true,
        zone: true,
        taskGroup: true,
        status: true,
      },
      orderBy: [
        { facility: { name: 'asc' } },
        { zone: { name: 'asc' } },
        { defaultSequence: 'asc' },
      ],
    });

    if (!templates.length) {
      return getDemoLibraryData();
    }

    const cards = templates.map(mapTaskTemplateToLibraryCard);

    return {
      cards,
      zones: [...new Set(cards.map((card) => card.zone))].sort(),
      source: 'prisma',
    };
  } catch {
    return getDemoLibraryData('demo-fallback');
  }
}

export async function getOrganiserBoardData() {
  if (!shouldUsePrisma()) {
    return getDemoOrganiserData();
  }

  const prisma = await getPrisma();
  if (!prisma) {
    return getDemoOrganiserData('demo-no-db');
  }

  try {
    const instances = await prisma.taskInstance.count();

    if (!instances) {
      return getDemoOrganiserData();
    }

    return {
      board: scheduleBuilder.allocationBoard,
      source: 'prisma-placeholder',
    };
  } catch {
    return getDemoOrganiserData('demo-fallback');
  }
}
