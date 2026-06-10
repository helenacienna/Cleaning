import test from 'node:test';
import assert from 'node:assert/strict';

import { markTaskTemplateCompleted } from '../lib/task-scheduling.js';

function buildTx(taskTemplate, taskInstance) {
  const createdInstances = [];
  const statusWrites = [];

  const tx = {
    taskInstance: {
      async findUnique() {
        return {
          ...taskInstance,
          taskTemplateId: taskTemplate.id,
          taskTemplate: {
            ...taskTemplate,
            status: taskTemplate.status ?? null,
          },
        };
      },
      async findFirst({ where }) {
        if (where?.taskTemplateId === taskTemplate.id && where?.dueAt) {
          return null;
        }

        return null;
      },
      async create({ data }) {
        createdInstances.push(data);
        return { id: `created-${createdInstances.length}`, ...data };
      },
    },
    taskTemplate: {
      async findUnique() {
        return {
          ...taskTemplate,
          status: taskTemplate.status ?? null,
          taskInstances: [],
        };
      },
    },
    taskTemplateStatus: {
      async upsert({ update, create }) {
        const payload = update ?? create;
        statusWrites.push(payload);
        return payload;
      },
    },
  };

  return { tx, createdInstances, statusWrites };
}

test('markTaskTemplateCompleted keeps anchored weekly follow-up based on prior due date', async () => {
  const taskTemplate = {
    id: 'template-weekly',
    taskTemplateCode: 'TMP-WEEKLY',
    recurrenceType: 'weekly',
    autoGenerateInstances: true,
    preferredTimeWindow: 'morning',
    recurrenceRule: {
      recurrenceBasis: 'anchored',
      designatedDay: 'wed',
    },
  };

  const taskInstance = {
    id: 'instance-weekly',
    dueAt: new Date('2026-06-10T09:00:00+10:00'),
  };

  const completedAt = new Date('2026-06-12T15:30:00+10:00');
  const { tx, createdInstances, statusWrites } = buildTx(taskTemplate, taskInstance);

  await markTaskTemplateCompleted(tx, taskInstance.id, completedAt);

  assert.equal(createdInstances.length, 1);
  assert.equal(createdInstances[0].dueAt.toISOString(), '2026-06-16T23:00:00.000Z');
  assert.equal(statusWrites[0].nextDueAt.toISOString(), '2026-06-16T23:00:00.000Z');
});

test('markTaskTemplateCompleted keeps monthly follow-up based on completion time', async () => {
  const taskTemplate = {
    id: 'template-monthly',
    taskTemplateCode: 'TMP-MONTHLY',
    recurrenceType: 'monthly',
    autoGenerateInstances: true,
    preferredTimeWindow: 'morning',
    recurrenceRule: null,
  };

  const taskInstance = {
    id: 'instance-monthly',
    dueAt: new Date('2026-06-01T09:00:00+10:00'),
  };

  const completedAt = new Date('2026-06-18T15:30:00+10:00');
  const { tx, createdInstances, statusWrites } = buildTx(taskTemplate, taskInstance);

  await markTaskTemplateCompleted(tx, taskInstance.id, completedAt);

  assert.equal(createdInstances.length, 1);
  assert.equal(createdInstances[0].dueAt.toISOString(), '2026-07-17T23:00:00.000Z');
  assert.equal(statusWrites[0].nextDueAt.toISOString(), '2026-07-17T23:00:00.000Z');
});
