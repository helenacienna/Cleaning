const facilities = ['Cienna', 'Boheme', 'Holidays'];

const makeDemoTask = (title, required = 'Standard', estimatedMinutes = 10) => ({
  title,
  required,
  estimatedMinutes,
});

const zoneBlueprints = [
  {
    id: 'zone-1',
    zone: 'Rooftop',
    groups: [
      {
        key: 'rooftop-daily-reset',
        name: 'Rooftop daily reset',
        frequency: 'Daily',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '4 Jun 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Reset rooftop furniture', 'Standard', 8),
          makeDemoTask('Wipe rooftop handrails', 'Random photo eligible', 10),
        ],
      },
      {
        key: 'rooftop-weekly-anchored',
        name: 'Rooftop weekly presentation',
        frequency: 'Weekly',
        cadenceMode: 'Anchored',
        designatedDay: 'MON',
        frequencyType: 'Suggestive',
        lastCompleted: '25 May 2026',
        suggestedDue: '1 Jun 2026',
        tasks: [
          makeDemoTask('Detail BBQ splashback panels', 'Comment on exception', 18),
          makeDemoTask('Inspect planter drainage points', 'Standard', 14),
        ],
      },
      {
        key: 'rooftop-quarterly-deep-clean',
        name: 'Rooftop quarterly deep clean',
        frequency: 'Quarterly',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '4 Mar 2026',
        suggestedDue: '4 Jun 2026',
        tasks: [
          makeDemoTask('Pressure clean rooftop pavers', 'Random photo eligible', 45),
          makeDemoTask('Detail clean balustrade glass', 'Comment on exception', 35),
        ],
      },
    ],
  },
  {
    id: 'zone-2',
    zone: 'Lifts',
    groups: [
      {
        key: 'lift-daily-reset',
        name: 'Lift daily refresh',
        frequency: 'Daily',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '4 Jun 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Polish lift mirrors', 'Standard', 8),
          makeDemoTask('Wipe lift thresholds', 'Comment on exception', 8),
        ],
      },
      {
        key: 'button-sanitising',
        name: 'Button sanitising',
        frequency: 'Weekly',
        cadenceMode: 'Anchored',
        designatedDay: 'MON',
        frequencyType: 'Critical',
        lastCompleted: '25 May 2026',
        suggestedDue: '1 Jun 2026',
        tasks: [
          makeDemoTask('Sanitise call buttons', 'Forced photo', 12),
          makeDemoTask('Wipe door tracks', 'Comment on exception', 10),
        ],
      },
      {
        key: 'lift-annual-detail',
        name: 'Lift annual detail clean',
        frequency: 'Annual',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '8 Jun 2025',
        suggestedDue: '8 Jun 2026',
        tasks: [
          makeDemoTask('High-level dust lift bulkheads', 'Comment on exception', 45),
          makeDemoTask('Detail clean lift vent surrounds', 'Random photo eligible', 40),
        ],
      },
    ],
  },
  {
    id: 'zone-3',
    zone: 'Entry t4',
    groups: [
      {
        key: 'entry-daily-arrival',
        name: 'Tower 4 arrival reset',
        frequency: 'Daily',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '4 Jun 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Vacuum entry mats', 'Standard', 7),
          makeDemoTask('Wipe intercom panel', 'Random photo eligible', 6),
        ],
      },
      {
        key: 'entry-every-2-days',
        name: 'Tower 4 glass cycle',
        frequency: 'Every 2 days',
        cadenceMode: 'Rolling',
        designatedDay: '—',
        frequencyType: 'Suggestive',
        lastCompleted: '3 Jun 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Spot clean entry glazing', 'Comment on exception', 12),
          makeDemoTask('Clean stainless push plates', 'Standard', 8),
        ],
      },
      {
        key: 'entry-monthly-presentation',
        name: 'Tower 4 monthly presentation clean',
        frequency: 'Monthly',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '5 May 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Detail clean stone skirting edges', 'Random photo eligible', 22),
          makeDemoTask('Polish entry signage panel', 'Standard', 16),
        ],
      },
    ],
  },
  {
    id: 'zone-4',
    zone: 'Entry t3',
    groups: [
      {
        key: 'entry-t3-daily',
        name: 'Tower 3 daily foyer reset',
        frequency: 'Daily',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '4 Jun 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Tidy foyer furniture', 'Standard', 6),
          makeDemoTask('Clean foyer glass doors', 'Comment on exception', 8),
        ],
      },
      {
        key: 'entry-t3-weekly-rolling',
        name: 'Tower 3 foyer detail cycle',
        frequency: 'Weekly',
        cadenceMode: 'Rolling',
        designatedDay: '—',
        frequencyType: 'Suggestive',
        lastCompleted: '29 May 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Detail clean skirting corners', 'Comment on exception', 14),
          makeDemoTask('Dust behind lobby seating', 'Standard', 12),
        ],
      },
      {
        key: 'entry-t3-as-required',
        name: 'Tower 3 responsive works',
        frequency: 'As required',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Suggestive',
        lastCompleted: '—',
        suggestedDue: 'As triggered',
        tasks: [
          makeDemoTask('Broken glass isolation and clean', 'Random photo eligible', 15),
          makeDemoTask('Emergency spill signage reset', 'Comment on exception', 12),
        ],
      },
    ],
  },
  {
    id: 'zone-5',
    zone: 'Residents lounge',
    groups: [
      {
        key: 'lounge-daily',
        name: 'Residents lounge daily reset',
        frequency: 'Daily',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '4 Jun 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Wipe lounge tables', 'Standard', 8),
          makeDemoTask('Reset lounge furniture', 'Standard', 7),
        ],
      },
      {
        key: 'lounge-monthly',
        name: 'Residents lounge monthly fabric care',
        frequency: 'Monthly',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Suggestive',
        lastCompleted: '5 May 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Vacuum lounge upholstery seams', 'Comment on exception', 20),
          makeDemoTask('Detail clean coffee table bases', 'Random photo eligible', 16),
        ],
      },
      {
        key: 'lounge-quarterly',
        name: 'Residents lounge quarterly recovery',
        frequency: 'Quarterly',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '5 Mar 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Steam clean lounge rugs', 'Random photo eligible', 35),
          makeDemoTask('Deep clean kitchenette kickboards', 'Comment on exception', 28),
        ],
      },
    ],
  },
  {
    id: 'zone-6',
    zone: 'Pool area',
    groups: [
      {
        key: 'pool-daily',
        name: 'Pool deck daily reset',
        frequency: 'Daily',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '4 Jun 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Reset pool furniture', 'Standard', 9),
          makeDemoTask('Clean gate touch points', 'Comment on exception', 8),
        ],
      },
      {
        key: 'pool-weekly-anchored',
        name: 'Pool amenities weekly check',
        frequency: 'Weekly',
        cadenceMode: 'Anchored',
        designatedDay: 'FRI',
        frequencyType: 'Critical',
        lastCompleted: '29 May 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Inspect pool safety signage', 'Forced photo', 14),
          makeDemoTask('Detail clean shower fixtures', 'Comment on exception', 12),
        ],
      },
      {
        key: 'pool-as-required',
        name: 'Pool area responsive works',
        frequency: 'As required',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Suggestive',
        lastCompleted: '—',
        suggestedDue: 'As triggered',
        tasks: [
          makeDemoTask('After-hours complaint touch-up clean', 'Comment on exception', 15),
          makeDemoTask('Storm debris sweep and drain check', 'Standard', 18),
        ],
      },
    ],
  },
  {
    id: 'zone-7',
    zone: 'Carparks',
    groups: [
      {
        key: 'carpark-daily',
        name: 'Carpark daily round',
        frequency: 'Daily',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '4 Jun 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Pick litter from carpark corners', 'Standard', 10),
          makeDemoTask('Check bin bay presentation', 'Comment on exception', 8),
        ],
      },
      {
        key: 'carpark-every-2-days',
        name: 'Carpark access ramp cycle',
        frequency: 'Every 2 days',
        cadenceMode: 'Rolling',
        designatedDay: '—',
        frequencyType: 'Suggestive',
        lastCompleted: '3 Jun 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Inspect trolley bay edges', 'Standard', 10),
          makeDemoTask('Degrease access door handles', 'Random photo eligible', 12),
        ],
      },
      {
        key: 'carpark-annual',
        name: 'Carpark annual presentation works',
        frequency: 'Annual',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '8 Jun 2025',
        suggestedDue: '8 Jun 2026',
        tasks: [
          makeDemoTask('Detail clean emergency signage housings', 'Comment on exception', 36),
          makeDemoTask('Pressure clean bin bay walls', 'Random photo eligible', 42),
        ],
      },
    ],
  },
  {
    id: 'zone-8',
    zone: 'Gym',
    groups: [
      {
        key: 'gym-daily',
        name: 'Gym daily floor care',
        frequency: 'Daily',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '4 Jun 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Vacuum gym floor', 'Standard', 10),
          makeDemoTask('Wipe free weight handles', 'Random photo eligible', 10),
        ],
      },
      {
        key: 'gym-weekly-rolling',
        name: 'Gym equipment recovery cycle',
        frequency: 'Weekly',
        cadenceMode: 'Rolling',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '29 May 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Detail clean cardio consoles', 'Forced photo', 16),
          makeDemoTask('Dust wall-mounted TV brackets', 'Comment on exception', 12),
        ],
      },
      {
        key: 'gym-quarterly',
        name: 'Gym quarterly edge scrub',
        frequency: 'Quarterly',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '6 Mar 2026',
        suggestedDue: '6 Jun 2026',
        tasks: [
          makeDemoTask('Machine scrub gym floor edges', 'Random photo eligible', 30),
          makeDemoTask('Detail clean mirrored skirting line', 'Standard', 24),
        ],
      },
    ],
  },
  {
    id: 'zone-9',
    zone: 'Mail room',
    groups: [
      {
        key: 'mail-daily',
        name: 'Mail room daily reset',
        frequency: 'Daily',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '4 Jun 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Tidy parcel shelving', 'Standard', 7),
          makeDemoTask('Sweep parcel room floor', 'Comment on exception', 8),
        ],
      },
      {
        key: 'mail-monthly',
        name: 'Mail room monthly locker detail',
        frequency: 'Monthly',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Suggestive',
        lastCompleted: '5 May 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Detail clean parcel locker fronts', 'Random photo eligible', 18),
          makeDemoTask('Clean locker vent grilles', 'Standard', 14),
        ],
      },
      {
        key: 'mail-as-required',
        name: 'Mail room responsive works',
        frequency: 'As required',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Suggestive',
        lastCompleted: '—',
        suggestedDue: 'As triggered',
        tasks: [
          makeDemoTask('Parcel overflow tidy and re-stack', 'Comment on exception', 20),
          makeDemoTask('Contractor delivery presentation reset', 'Standard', 15),
        ],
      },
    ],
  },
  {
    id: 'zone-10',
    zone: 'Loading dock',
    groups: [
      {
        key: 'dock-daily',
        name: 'Loading dock daily reset',
        frequency: 'Daily',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '4 Jun 2026',
        suggestedDue: '5 Jun 2026',
        tasks: [
          makeDemoTask('Sweep loading dock', 'Standard', 10),
          makeDemoTask('Remove cardboard scraps', 'Standard', 8),
        ],
      },
      {
        key: 'dock-weekly-anchored',
        name: 'Loading dock weekly safety check',
        frequency: 'Weekly',
        cadenceMode: 'Anchored',
        designatedDay: 'WED',
        frequencyType: 'Critical',
        lastCompleted: '27 May 2026',
        suggestedDue: '3 Jun 2026',
        tasks: [
          makeDemoTask('Inspect spill kit and signage', 'Forced photo', 14),
          makeDemoTask('Detail clean roller door handles', 'Comment on exception', 12),
        ],
      },
      {
        key: 'dock-quarterly',
        name: 'Loading dock quarterly deep clean',
        frequency: 'Quarterly',
        cadenceMode: '—',
        designatedDay: '—',
        frequencyType: 'Critical',
        lastCompleted: '3 Mar 2026',
        suggestedDue: '3 Jun 2026',
        tasks: [
          makeDemoTask('Deep clean roller door tracks', 'Random photo eligible', 32),
          makeDemoTask('Pressure clean dock edge concrete', 'Comment on exception', 40),
        ],
      },
    ],
  },
];

const allocationStaff = [
  { name: 'Tony', facility: 'Cienna', shiftLabel: 'Morning walk-through shift', shiftWindow: '6:00 AM – 2:00 PM', routeLabel: 'Rooftop → Tower 4 → Residents lounge → Pool → Carparks' },
  { name: 'Leo Nguyen', facility: 'Boheme', shiftLabel: 'Day flexible shift', shiftWindow: '7:30 AM – 3:30 PM', routeLabel: 'Boheme → Holidays → Cienna' },
  { name: 'Ava Patel', facility: 'Holidays', shiftLabel: 'Late flexible shift', shiftWindow: '9:00 AM – 5:00 PM', routeLabel: 'Holidays → Cienna → Boheme' },
];
const allocationDays = ['Mon 1', 'Tue 2', 'Wed 3', 'Thu 4', 'Fri 5', 'Sat 6', 'Sun 7', 'Mon 8', 'Tue 9', 'Wed 10'];
const DEMO_TODAY = new Date('2026-06-05T00:00:00');
const TARGET_TASKS_PER_SHIFT = 50;
const COMPLETION_RATIO = 0.6;

const supplementalTaskBlueprints = [];

function slugifyValue(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function makeCleanerShiftAssignmentId({ staff, day, facility, zone }) {
  return `shift-${slugifyValue(day)}-${slugifyValue(staff)}-${slugifyValue(facility)}-${slugifyValue(zone)}`;
}

const allocationRoutes = {
  Tony: [
    { facility: 'Cienna', zones: ['Rooftop', 'Lifts', 'Entry t4', 'Entry t3'], laneIndexes: [0] },
    { facility: 'Boheme', zones: ['Residents lounge', 'Pool area', 'Carparks', 'Gym'], laneIndexes: [1, 2] },
    { facility: 'Cienna', zones: ['Mail room', 'Loading dock'], laneIndexes: [3] },
  ],
  'Leo Nguyen': [
    { facility: 'Boheme', zones: ['Rooftop', 'Lifts', 'Entry t4', 'Entry t3', 'Residents lounge'], laneIndexes: [1, 2] },
    { facility: 'Holidays', zones: ['Pool area', 'Carparks', 'Gym'], laneIndexes: [3] },
    { facility: 'Cienna', zones: ['Mail room', 'Loading dock'], laneIndexes: [4] },
  ],
  'Ava Patel': [
    { facility: 'Holidays', zones: ['Rooftop', 'Lifts', 'Entry t4', 'Entry t3'], laneIndexes: [3] },
    { facility: 'Cienna', zones: ['Residents lounge', 'Pool area', 'Carparks', 'Gym'], laneIndexes: [4, 5] },
    { facility: 'Boheme', zones: ['Mail room', 'Loading dock'], laneIndexes: [6] },
  ],
};

function makeTemplateId(index) {
  return `task_template_${String(index + 1).padStart(3, '0')}`;
}

function makeTaskCardId(index) {
  return `task-card-${String(index + 1).padStart(3, '0')}`;
}

function makeDemoHierarchyCode({ facilityIndex, zoneIndex, groupIndex, taskIndex }) {
  return `F${String(facilityIndex + 1).padStart(2, '0')}-Z${String(zoneIndex + 1).padStart(2, '0')}-G${String(groupIndex + 1).padStart(2, '0')}-T${String(taskIndex + 1).padStart(2, '0')}`;
}

function makeDemoInstanceCode(hierarchyCode, boardDayLabel, timeText = '0900') {
  const boardDate = parseBoardDateLabel(boardDayLabel);
  const stamp = `${boardDate.getFullYear()}${String(boardDate.getMonth() + 1).padStart(2, '0')}${String(boardDate.getDate()).padStart(2, '0')}`;
  return `${hierarchyCode}-D${stamp}-T${timeText}`;
}

function buildTaskCatalog() {
  const templates = [];

  facilities.forEach((facilityName, facilityIndex) => {
    zoneBlueprints.forEach((zoneBlueprint, zoneIndex) => {
      zoneBlueprint.groups.forEach((group, groupIndex) => {
        group.tasks.forEach((taskBlueprint, taskIndex) => {
          const templateIndex = templates.length;
          templates.push({
            id: makeTaskCardId(templateIndex),
            title: taskBlueprint.title,
            taskGroup: group.name,
            groupKey: group.key,
            groupIndex,
            zoneId: `${facilityIndex + 1}-${zoneBlueprint.id}`,
            zone: zoneBlueprint.zone,
            facility: facilityName,
            templateId: makeTemplateId(templateIndex),
            hierarchyCode: makeDemoHierarchyCode({ facilityIndex, zoneIndex, groupIndex, taskIndex }),
            jobOrderNumber: String(templateIndex + 1).padStart(3, '0'),
            required: taskBlueprint.required,
            frequency: group.frequency,
            cadenceMode: group.cadenceMode,
            designatedDay: group.designatedDay,
            frequencyType: group.frequencyType,
            estimatedMinutes: taskBlueprint.estimatedMinutes,
            lastCompleted: taskBlueprint.lastCompleted ?? group.lastCompleted,
            suggestedDue: taskBlueprint.suggestedDue ?? group.suggestedDue,
            notes: `${group.name} · ${zoneBlueprint.zone} · ${facilityName}`,
            active: true,
          });
        });
      });
    });
  });

  facilities.forEach((facilityName, facilityIndex) => {
    supplementalTaskBlueprints.forEach((taskBlueprint, supplementalIndex) => {
      const zoneBlueprint = zoneBlueprints.find((zone) => zone.zone === taskBlueprint.zone);
      if (!zoneBlueprint) {
        return;
      }

      const templateIndex = templates.length;
      templates.push({
        id: makeTaskCardId(templateIndex),
        title: taskBlueprint.title,
        taskGroup: taskBlueprint.taskGroup,
        groupKey: `${taskBlueprint.category}-${slugifyValue(taskBlueprint.taskGroup)}`,
        groupIndex: 10 + supplementalIndex,
        zoneId: `${facilityIndex + 1}-${zoneBlueprint.id}`,
        zone: taskBlueprint.zone,
        facility: facilityName,
        templateId: makeTemplateId(templateIndex),
        jobOrderNumber: String(templateIndex + 1).padStart(3, '0'),
        required: taskBlueprint.required,
        frequency: taskBlueprint.frequency,
        frequencyType: taskBlueprint.frequencyType,
        estimatedMinutes: taskBlueprint.estimatedMinutes,
        lastCompleted: taskBlueprint.lastCompleted,
        suggestedDue: taskBlueprint.suggestedDue,
        notes: `${taskBlueprint.taskGroup} · ${taskBlueprint.zone} · ${facilityName}`,
        active: true,
      });
    });
  });

  return templates;
}

export const taskCardTemplates = buildTaskCatalog();
const taskCatalog = taskCardTemplates;

function buildAssignmentTasks(facilityName, zoneName, customTasks = null) {
  const zoneTasks = (customTasks ?? taskCardTemplates
    .filter((task) => task.facility === facilityName && task.zone === zoneName)
    .map((task) => ({
      title: task.title,
      templateId: task.templateId,
      hierarchyCode: task.hierarchyCode,
      jobOrderNumber: task.jobOrderNumber,
      required: task.required,
      frequency: task.frequency,
      frequencyType: task.frequencyType,
      cadenceMode: task.cadenceMode,
      designatedDay: task.designatedDay,
      estimatedMinutes: task.estimatedMinutes,
      notes: task.notes,
      photoRequired: task.required === 'Random photo eligible',
      commentRequired: task.required === 'Comment on exception',
      taskGroup: task.taskGroup,
      zone: task.zone,
    })));

  const completedTarget = Math.round(TARGET_TASKS_PER_SHIFT * COMPLETION_RATIO);

  return Array.from({ length: TARGET_TASKS_PER_SHIFT }, (_, index) => {
    const task = zoneTasks[index % zoneTasks.length];
    return {
      id: `assignment-${facilityName}-${zoneName}-${index + 1}`,
      title: task.title,
      templateId: task.templateId,
      instanceCode: makeDemoInstanceCode(task.hierarchyCode ?? task.templateId, 'Fri 5', `${String(600 + index).padStart(4, '0')}`),
      hierarchyCode: task.hierarchyCode,
      jobOrderNumber: task.jobOrderNumber,
      required: task.required,
      frequency: task.frequency,
      frequencyType: task.frequencyType,
      estimatedMinutes: task.estimatedMinutes,
      notes: task.notes,
      status: getDemoTaskStatus(DEMO_TODAY, index, completedTarget),
      photoRequired: task.photoRequired,
      commentRequired: task.commentRequired,
      taskGroup: task.taskGroup,
      zone: task.zone,
    };
  });
}

export const appSummary = {
  appName: 'Cienna Cleaning',
  suiteLabel: 'Cienna Suite',
  today: 'Friday, 29 May',
  completionRate: 78,
  completedTasks: 126,
  pendingTasks: 54,
  overdueTasks: 9,
  photoVerifications: 24,
};

export const cleanerAssignments = allocationStaff.map((staff, index) => ({
  id: `assignment-${index + 1}`,
  location: staff.facility,
  zone: zoneBlueprints[index].zone,
  shift: staff.shiftLabel,
  progress: Math.round(COMPLETION_RATIO * 100),
  stats: {
    total: TARGET_TASKS_PER_SHIFT,
    completed: Math.round(TARGET_TASKS_PER_SHIFT * COMPLETION_RATIO),
    photoRequired: Math.round(TARGET_TASKS_PER_SHIFT * 0.18),
  },
  tasks: buildAssignmentTasks(staff.facility, zoneBlueprints[index].zone),
}));

const staffMetaByName = Object.fromEntries(allocationStaff.map((staff) => [staff.name, staff]));

export const qrZones = facilities.flatMap((facilityName, facilityIndex) => (
  zoneBlueprints.map((zoneBlueprint) => ({
    id: `facility-${facilityIndex + 1}-${zoneBlueprint.id}`,
    label: zoneBlueprint.zone,
    location: facilityName,
    qrUrl: `/scan/${zoneBlueprint.id}`,
    code: `CIENNA-${facilityIndex + 1}-${zoneBlueprint.id.toUpperCase()}`,
  }))
));

export const cleanerProfile = {
  name: 'Tony',
  role: 'Morning walk-through cleaner',
  nextShift: 'Today · PPM morning inspection run',
};

export const supervisorCards = [
  { title: 'Live completion', value: '126 / 180', note: 'Across 3 Cienna facilities', tone: 'green' },
  { title: 'Missed tasks', value: '9', note: '4 carried forward automatically', tone: 'amber' },
  { title: 'Photo audits', value: '24', note: '9 random verifications still open', tone: 'blue' },
  { title: 'Issues raised', value: '6', note: '2 marked urgent', tone: 'red' },
];

export const taskLibrary = Array.from(
  new Map(
    taskCardTemplates.map((task) => [task.taskGroup, {
      title: task.taskGroup,
      category: task.zone,
      duration: 'Variable',
      flags: ['Reusable', task.frequency, task.required],
    }])
  ).values()
).slice(0, 6);

export const reports = [
  ['Facilities in sample', String(facilities.length)],
  ['Zones per facility', String(zoneBlueprints.length)],
  ['Task groups per zone', '3'],
  ['Minimum tasks per group', '2'],
  ['Completion rate', '94%'],
  ['Audits passed', '33 / 36'],
];

function parseBoardDateLabel(day) {
  const match = String(day).match(/^(\w{3})\s(\d{1,2})$/);
  if (!match) {
    return new Date(Number.NaN);
  }

  const [, , dayNumber] = match;
  const paddedDay = String(dayNumber).padStart(2, '0');
  return new Date(`2026-06-${paddedDay}T00:00:00`);
}

function parseTemplateDateLabel(value) {
  if (!value || value === '—' || value === 'As triggered') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function diffCalendarDays(left, right) {
  const a = new Date(left);
  const b = new Date(right);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

function calculateDemoNextDueDate(template) {
  const frequency = String(template.frequency || '').toLowerCase();
  const cadenceMode = String(template.cadenceMode || 'Rolling').toLowerCase();
  const lastCompleted = parseTemplateDateLabel(template.lastCompleted);
  const suggestedDue = parseTemplateDateLabel(template.suggestedDue);

  if (frequency === 'as required') {
    return null;
  }

  if (frequency === 'daily') {
    return suggestedDue ?? (lastCompleted ? addDays(startOfDay(lastCompleted), 1) : null);
  }

  if (frequency === 'every 2 days') {
    return cadenceMode === 'rolling'
      ? (lastCompleted ? addDays(startOfDay(lastCompleted), 2) : suggestedDue)
      : suggestedDue;
  }

  if (frequency === 'weekly') {
    return cadenceMode === 'rolling'
      ? (lastCompleted ? addDays(startOfDay(lastCompleted), 7) : suggestedDue)
      : suggestedDue;
  }

  if (frequency === 'monthly') {
    return cadenceMode === 'rolling'
      ? (lastCompleted ? addMonths(startOfDay(lastCompleted), 1) : suggestedDue)
      : suggestedDue;
  }

  if (frequency === 'quarterly') {
    return cadenceMode === 'rolling'
      ? (lastCompleted ? addMonths(startOfDay(lastCompleted), 3) : suggestedDue)
      : suggestedDue;
  }

  if (frequency === 'annual') {
    return cadenceMode === 'rolling'
      ? (lastCompleted ? addMonths(startOfDay(lastCompleted), 12) : suggestedDue)
      : suggestedDue;
  }

  return suggestedDue;
}

function getDemoTaskStatus(boardDate, index, completedTarget) {
  const day = startOfDay(boardDate);
  const today = startOfDay(DEMO_TODAY);

  if (day.getTime() > today.getTime()) {
    return 'pending';
  }

  if (index < completedTarget) {
    return 'completed';
  }

  if (day.getTime() === today.getTime() && index === completedTarget) {
    return 'in-progress';
  }

  return 'pending';
}

function hasDayIntervalOccurrence(boardDate, firstDueDate, intervalDays) {
  if (!firstDueDate) {
    return false;
  }

  const diff = diffCalendarDays(boardDate, firstDueDate);
  return diff >= 0 && diff % intervalDays === 0;
}

function hasMonthIntervalOccurrence(boardDate, firstDueDate, intervalMonths) {
  if (!firstDueDate) {
    return false;
  }

  const board = startOfDay(boardDate);
  const first = startOfDay(firstDueDate);
  if (board < first) {
    return false;
  }

  const monthDiff = (board.getFullYear() - first.getFullYear()) * 12 + (board.getMonth() - first.getMonth());
  return monthDiff >= 0 && monthDiff % intervalMonths === 0 && board.getDate() === first.getDate();
}

function isTemplateScheduledOnBoardDay(template, boardDate) {
  const frequency = String(template.frequency || '').toLowerCase();
  const nextDue = calculateDemoNextDueDate(template);

  if (frequency === 'daily') {
    return true;
  }

  if (frequency === 'every 2 days') {
    return hasDayIntervalOccurrence(boardDate, nextDue, 2);
  }

  if (frequency === 'weekly') {
    return hasDayIntervalOccurrence(boardDate, nextDue, 7);
  }

  if (frequency === 'monthly') {
    return hasMonthIntervalOccurrence(boardDate, nextDue, 1);
  }

  if (frequency === 'quarterly') {
    return hasMonthIntervalOccurrence(boardDate, nextDue, 3);
  }

  if (frequency === 'annual') {
    return hasMonthIntervalOccurrence(boardDate, nextDue, 12);
  }

  if (frequency === 'as required') {
    return false;
  }

  return nextDue ? diffCalendarDays(boardDate, nextDue) === 0 : false;
}

function buildRouteTaskPool(staff, boardDate) {
  const routeStops = allocationRoutes[staff.name] || [];

  return routeStops.flatMap((stop, stopIndex) => {
    const stopTemplates = taskCatalog.filter((template) => (
      template.facility === stop.facility
      && stop.zones.includes(template.zone)
      && isTemplateScheduledOnBoardDay(template, boardDate)
    ));
    const laneSpan = stop.laneIndexes.length;

    return stopTemplates.map((template, templateIndex) => ({
      template,
      stopIndex,
      laneIndex: stop.laneIndexes[Math.min(laneSpan - 1, Math.floor((templateIndex / stopTemplates.length) * laneSpan))],
    }));
  });
}

const allocationCards = allocationDays.flatMap((day, dayIndex) => (
  allocationStaff.flatMap((staff) => {
    const routeTaskPool = buildRouteTaskPool(staff, parseBoardDateLabel(day));
    if (!routeTaskPool.length) {
      return [];
    }
    const taskCount = Math.min(TARGET_TASKS_PER_SHIFT, routeTaskPool.length);
    const completedTarget = Math.round(taskCount * COMPLETION_RATIO);

    return Array.from({ length: taskCount }, (_, index) => {
      const poolItem = routeTaskPool[index % routeTaskPool.length];
      const template = poolItem.template;
      const jobOrder = index + 1;

      return {
        id: `alloc-${dayIndex + 1}-${staff.name.replace(/\s+/g, '-').toLowerCase()}-${jobOrder}`,
        title: template.title,
        templateId: template.templateId,
        instanceCode: makeDemoInstanceCode(template.hierarchyCode ?? template.templateId, day, `${String(600 + poolItem.laneIndex * 100 + jobOrder).padStart(4, '0')}`),
        staff: staff.name,
        day,
        jobOrder,
        laneIndex: poolItem.laneIndex,
        routeStopIndex: poolItem.stopIndex,
        status: getDemoTaskStatus(parseBoardDateLabel(day), index, completedTarget),
        facility: template.facility,
        zone: template.zone,
        taskGroup: template.taskGroup,
        frequency: template.frequency,
        cadenceMode: template.cadenceMode,
        designatedDay: template.designatedDay,
        type: template.frequencyType.toLowerCase(),
        groupId: `group-${dayIndex + 1}-${template.zoneId}-${template.groupKey}`,
        groupName: template.taskGroup,
        auditScore: getDemoTaskStatus(parseBoardDateLabel(day), index, completedTarget) === 'completed' ? (jobOrder % 4 === 0 ? 4 : 5) : null,
        issueNote: '',
        detached: false,
      };
    });
  })
));

const uniqueGroupKeys = Array.from(new Set(allocationCards.map((card) => `${card.day}:${card.groupId}:${card.staff}`)));
const taskGroups = uniqueGroupKeys.map((groupKey) => {
  const groupCards = allocationCards.filter((card) => `${card.day}:${card.groupId}:${card.staff}` === groupKey);
  const firstCard = groupCards[0];
  return {
    id: firstCard.groupId,
    name: firstCard.groupName,
    day: firstCard.day,
    staff: firstCard.staff,
    facility: firstCard.facility,
    zone: firstCard.zone,
    jobOrderStart: firstCard.jobOrder,
    jobOrderEnd: groupCards[groupCards.length - 1].jobOrder,
    taskCount: groupCards.length,
    type: groupCards.some((card) => card.type === 'critical') ? 'critical' : 'suggestive',
  };
});

const denseScoreDemoCards = Array.from({ length: 6 }, (_, index) => ({
  id: `dense-score-demo-${index + 1}`,
  title: `Follow-up presentation check ${index + 1}`,
  templateId: `dense_score_demo_${String(index + 1).padStart(3, '0')}`,
  staff: 'Mia Thompson',
  day: 'Mon 1',
  jobOrder: TARGET_TASKS_PER_SHIFT + 20 + index,
  laneIndex: 0,
  routeStopIndex: 0,
  status: 'pending',
  facility: 'Cienna',
  zone: 'Rooftop',
  taskGroup: 'Rooftop presentation',
  type: 'critical',
  groupId: 'group-dense-score-demo',
  groupName: 'Rooftop presentation',
  auditScore: 4,
  issueNote: '',
  detached: false,
}));

export const cleanerShiftAssignments = Array.from(
  new Map(
    [...allocationCards, ...denseScoreDemoCards].map((card) => {
      const key = `${card.staff}|${card.day}|${card.facility}`;
      return [key, null];
    })
  ).keys()
).map((key) => {
  const [staff, day, facility] = key.split('|');
  const matchingCards = [...allocationCards, ...denseScoreDemoCards]
    .filter((card) => card.staff === staff && card.day === day && card.facility === facility)
    .sort((a, b) => a.jobOrder - b.jobOrder);
  const shiftMeta = staffMetaByName[staff];
  const completed = matchingCards.filter((card) => card.status === 'completed').length;
  const photoRequired = matchingCards.filter((card) => card.type === 'critical').length;
  const zones = [...new Set(matchingCards.map((card) => card.zone))];

  return {
    id: makeCleanerShiftAssignmentId({ staff, day, facility, zone: 'facility' }),
    location: facility,
    zone: zones[0],
    zones,
    staff,
    day,
    shift: shiftMeta?.shiftLabel ?? 'Shift',
    routeLabel: shiftMeta?.routeLabel ?? '',
    progress: matchingCards.length ? Math.round((completed / matchingCards.length) * 100) : 0,
    stats: { total: matchingCards.length, completed, photoRequired },
    tasks: matchingCards.map((card) => ({
      id: card.id,
      title: card.title,
      status: card.status,
      photoRequired: card.type === 'critical',
      commentRequired: false,
      taskGroup: card.taskGroup,
      zone: card.zone,
      score: card.auditScore,
    })),
  };
});

const draftSelection = taskCardTemplates.filter((task) => task.facility === 'Cienna' && task.zone === 'Entry t4').slice(0, 5);

export const scheduleBuilder = {
  selectedLocation: 'Cienna',
  selectedZone: 'Entry t4',
  frequency: 'Weekdays',
  shift: 'Flexible daily run · no fixed task times',
  assignedCleaner: 'Tony',
  repeatRule: 'Mon-Fri · generate daily task instances',
  randomPhotoRate: '30% of eligible tasks',
  draftTasks: draftSelection.map((task, index) => ({
    order: index + 1,
    jobOrderNumber: task.jobOrderNumber,
    title: task.title,
    templateId: task.templateId,
    taskGroup: task.taskGroup,
    zone: task.zone,
    facility: task.facility,
    required: task.required,
    frequency: task.frequency,
    frequencyType: task.frequencyType,
    lastCompleted: task.lastCompleted,
    suggestedDue: task.suggestedDue,
  })),
  generatedInstances: [
    ['Mon 1 Jun', '180 task instances', 'scheduled_cienna_2026-06-01'],
    ['Tue 2 Jun', '180 task instances', 'scheduled_cienna_2026-06-02'],
    ['Wed 3 Jun', '180 task instances', 'scheduled_cienna_2026-06-03'],
  ],
  calendarDays: [
    { date: 'Mon 1', dayType: 'weekday', jobs: [{ jobOrderStart: '001', facility: 'Cienna', zone: 'Entry t4', groupName: 'Toilet block', count: 2, type: 'critical' }, { jobOrderStart: '061', facility: 'Boheme', zone: 'Entry t4', groupName: 'Toilet block', count: 2, type: 'critical' }, { jobOrderStart: '121', facility: 'Holidays', zone: 'Entry t4', groupName: 'Toilet block', count: 2, type: 'critical' }] },
    { date: 'Tue 2', dayType: 'weekday', jobs: [{ jobOrderStart: '019', facility: 'Cienna', zone: 'Pool area', groupName: 'Pool deck reset', count: 2, type: 'critical' }, { jobOrderStart: '079', facility: 'Boheme', zone: 'Pool area', groupName: 'Pool deck reset', count: 2, type: 'critical' }, { jobOrderStart: '139', facility: 'Holidays', zone: 'Pool area', groupName: 'Pool deck reset', count: 2, type: 'critical' }] },
    { date: 'Wed 3', dayType: 'weekday', jobs: [{ jobOrderStart: '031', facility: 'Cienna', zone: 'Gym', groupName: 'Gym floor care', count: 2, type: 'suggestive' }, { jobOrderStart: '091', facility: 'Boheme', zone: 'Gym', groupName: 'Gym floor care', count: 2, type: 'suggestive' }, { jobOrderStart: '151', facility: 'Holidays', zone: 'Gym', groupName: 'Gym floor care', count: 2, type: 'suggestive' }] },
    { date: 'Thu 4', dayType: 'weekday', jobs: [{ jobOrderStart: '043', facility: 'Cienna', zone: 'Loading dock', groupName: 'Dock sweep', count: 2, type: 'suggestive' }, { jobOrderStart: '103', facility: 'Boheme', zone: 'Loading dock', groupName: 'Dock sweep', count: 2, type: 'suggestive' }, { jobOrderStart: '163', facility: 'Holidays', zone: 'Loading dock', groupName: 'Dock sweep', count: 2, type: 'suggestive' }] },
    { date: 'Fri 5', dayType: 'weekday', jobs: [{ jobOrderStart: '013', facility: 'Cienna', zone: 'Residents lounge', groupName: 'Residents lounge touch-up', count: 2, type: 'critical' }, { jobOrderStart: '073', facility: 'Boheme', zone: 'Residents lounge', groupName: 'Residents lounge touch-up', count: 2, type: 'critical' }, { jobOrderStart: '133', facility: 'Holidays', zone: 'Residents lounge', groupName: 'Residents lounge touch-up', count: 2, type: 'critical' }] },
    { date: 'Sat 6', dayType: 'weekend', jobs: [{ jobOrderStart: '025', facility: 'Cienna', zone: 'Carparks', groupName: 'Carpark round', count: 2, type: 'suggestive' }] },
    { date: 'Sun 7', dayType: 'weekend', jobs: [] },
  ],
  allocationBoard: {
    staff: [...allocationStaff.map((staff) => staff.name), 'Unallocated'],
    staffMeta: Object.fromEntries([
      ...allocationStaff.map((staff) => [staff.name, { shiftLabel: staff.shiftLabel, shiftWindow: `${staff.shiftWindow} · ${staff.routeLabel}`, facility: staff.facility, routeLabel: staff.routeLabel }]),
      ['Unallocated', { shiftLabel: 'Not assigned', shiftWindow: 'No shift yet', facility: 'Unallocated' }],
    ]),
    days: allocationDays,
    cards: [
      ...allocationCards,
      ...denseScoreDemoCards,
      { id: 'alloc-unassigned-1', title: 'Check dock spill kit', templateId: 'custom_001', staff: 'Unallocated', day: 'Mon 1', jobOrder: 61, status: 'pending', facility: 'Cienna', zone: 'Loading dock', taskGroup: 'Back-of-house tidy', type: 'suggestive', groupId: 'group-unassigned-dock', groupName: 'Back-of-house tidy' },
      { id: 'alloc-unassigned-2', title: 'Recheck sauna entry mat', templateId: 'custom_002', staff: 'Unallocated', day: 'Wed 3', jobOrder: 62, status: 'in-progress', facility: 'Boheme', zone: 'Pool area', taskGroup: 'Amenities wipe-down', type: 'critical', groupId: 'group-unassigned-pool', groupName: 'Amenities wipe-down' },
      { id: 'alloc-unassigned-3', title: 'Inspect parcel overflow shelf', templateId: 'custom_003', staff: 'Unallocated', day: 'Fri 5', jobOrder: 63, status: 'pending', facility: 'Holidays', zone: 'Mail room', taskGroup: 'Parcel room reset', type: 'suggestive', groupId: 'group-unassigned-mail', groupName: 'Parcel room reset' },
    ],
  },
  exceptionWorkflow: {
    groups: taskGroups.slice(0, 8),
    detachedTasks: [
      { ...allocationCards[7], id: 'detached-demo-1', title: 'Extra mop up after spill', detached: true, day: 'Tue 2', jobOrder: 33, staff: 'Tony', reason: 'Incident clean-up required outside normal run' },
      { ...allocationCards[80], id: 'detached-demo-2', title: 'Urgent litter sweep at entry', detached: true, day: 'Wed 3', jobOrder: 48, staff: 'Leo Nguyen', reason: 'Separated from group and rescheduled individually' },
    ],
  },
};
