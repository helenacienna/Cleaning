const facilityName = 'Cienna';
const zoneNames = [
  'Rooftop',
  'Lifts',
  'Entry t4',
  'Entry t3',
  'Residents lounge',
  'Pool area',
  'Carparks',
];

const taskGroupTemplates = [
  {
    key: 'toilet-block',
    name: 'Toilet block',
    tasks: [
      'Clean toilets',
      'Mop floor',
      'Check toilet paper',
      'Wipe basins and mirrors',
      'Refill soap dispensers',
    ],
  },
  {
    key: 'entry-detail',
    name: 'Entry detail',
    tasks: [
      'Spot clean glass',
      'Vacuum mats',
      'Wipe intercom panel',
      'Check entrance presentation',
      'Remove marks from doors',
    ],
  },
  {
    key: 'lift-refresh',
    name: 'Lift refresh',
    tasks: [
      'Polish lift mirrors',
      'Wipe buttons and rails',
      'Vacuum lift tracks',
      'Check lift walls for marks',
      'Remove rubbish',
    ],
  },
  {
    key: 'rooftop-presentation',
    name: 'Rooftop presentation',
    tasks: [
      'Clear tables',
      'Wipe handrails',
      'Sweep traffic paths',
      'Check bins',
      'Spot clean glass balustrade',
    ],
  },
  {
    key: 'pool-deck',
    name: 'Pool deck reset',
    tasks: [
      'Remove leaf litter',
      'Check pool furniture',
      'Wipe gate handles',
      'Rinse high-traffic patches',
      'Check safety signage',
    ],
  },
  {
    key: 'lounge-touchup',
    name: 'Residents lounge touch-up',
    tasks: [
      'Wipe tables',
      'Arrange cushions and chairs',
      'Vacuum lounge floor',
      'Clean kitchenette bench',
      'Empty bins',
    ],
  },
  {
    key: 'carpark-round',
    name: 'Carpark round',
    tasks: [
      'Pick litter',
      'Blow leaves from corners',
      'Check bin bays',
      'Spot clean entry doors',
      'Inspect trolley area',
    ],
  },
];

const allocationStaff = ['Mia Thompson', 'Leo Nguyen', 'Ava Patel'];
const allocationDays = ['Mon 1', 'Tue 2', 'Wed 3', 'Thu 4', 'Fri 5'];

function buildTaskCatalog() {
  return taskGroupTemplates.flatMap((group, groupIndex) => (
    group.tasks.map((title, taskIndex) => ({
      title,
      taskGroup: group.name,
      groupKey: group.key,
      zone: zoneNames[(groupIndex + taskIndex) % zoneNames.length],
      required: taskIndex % 3 === 0 ? 'Random photo eligible' : taskIndex % 4 === 0 ? 'Comment on exception' : 'Standard',
      frequency: taskIndex % 5 === 0 ? 'Weekly' : taskIndex % 2 === 0 ? 'Daily' : 'Every 2 days',
      frequencyType: taskIndex % 4 === 0 ? 'Suggestive' : 'Critical',
      templateId: `task_template_${String(groupIndex * 10 + taskIndex + 1).padStart(3, '0')}`,
    }))
  ));
}

export const taskCardTemplates = buildTaskCatalog().map((task, index) => ({
  id: `task-card-${String(index + 1).padStart(3, '0')}`,
  title: task.title,
  taskGroup: task.taskGroup,
  groupKey: task.groupKey,
  templateId: task.templateId,
  zone: task.zone,
  facility: facilityName,
  jobOrderNumber: String(index + 1).padStart(3, '0'),
  required: task.required,
  frequency: task.frequency,
  frequencyType: task.frequencyType,
  estimatedEffort: index % 3 === 0 ? 'Quick check' : index % 3 === 1 ? 'Standard pass' : 'Detailed pass',
  lastCompleted: index % 4 === 0 ? '30 May 2026' : index % 4 === 1 ? '29 May 2026' : index % 4 === 2 ? '28 May 2026' : '27 May 2026',
  suggestedDue: index % 5 === 0 ? '5 Jun 2026' : index % 2 === 0 ? '1 Jun 2026' : '2 Jun 2026',
  notes: index % 4 === 0 ? 'Watch presentation standard and raise an issue if damaged.' : 'Standard task card ready for daily scheduling.',
  active: true,
}));

const taskCatalog = taskCardTemplates;

export const appSummary = {
  appName: 'Cienna Cleaning',
  suiteLabel: 'Cienna Suite',
  today: 'Friday, 29 May',
  completionRate: 78,
  completedTasks: 42,
  pendingTasks: 12,
  overdueTasks: 5,
  photoVerifications: 8,
};

export const cleanerAssignments = [
  {
    id: 'zone-1',
    location: facilityName,
    zone: 'Rooftop',
    shift: 'Flexible morning run',
    progress: 75,
    stats: { total: 12, completed: 9, photoRequired: 3 },
    tasks: [
      { id: 't1', title: 'Clear tables', status: 'completed', photoRequired: false, commentRequired: false },
      { id: 't2', title: 'Wipe handrails', status: 'photo-required', photoRequired: true, commentRequired: false },
      { id: 't3', title: 'Sweep traffic paths', status: 'pending', photoRequired: false, commentRequired: true },
      { id: 't4', title: 'Check bins', status: 'completed', photoRequired: false, commentRequired: false },
      { id: 't5', title: 'Spot clean glass balustrade', status: 'pending', photoRequired: true, commentRequired: false },
      { id: 't6', title: 'Check rooftop presentation', status: 'pending', photoRequired: false, commentRequired: true },
    ],
  },
  {
    id: 'zone-2',
    location: facilityName,
    zone: 'Lifts',
    shift: 'Flexible mid-morning run',
    progress: 40,
    stats: { total: 10, completed: 4, photoRequired: 2 },
    tasks: [
      { id: 't7', title: 'Polish lift mirrors', status: 'pending', photoRequired: false, commentRequired: false },
      { id: 't8', title: 'Wipe buttons and rails', status: 'photo-required', photoRequired: true, commentRequired: false },
      { id: 't9', title: 'Vacuum lift tracks', status: 'carried-forward', photoRequired: false, commentRequired: true },
      { id: 't10', title: 'Check lift walls for marks', status: 'pending', photoRequired: false, commentRequired: false },
      { id: 't11', title: 'Remove rubbish', status: 'pending', photoRequired: false, commentRequired: false },
    ],
  },
];

export const qrZones = cleanerAssignments.map((assignment) => ({
  id: assignment.id,
  label: assignment.zone,
  location: assignment.location,
  qrUrl: `/scan/${assignment.id}`,
  code: `CIENNA-${assignment.id.toUpperCase()}`,
}));

export const cleanerProfile = {
  name: 'Mia Thompson',
  role: 'Morning cleaner',
  nextShift: 'Today · Flexible run window',
};

export const supervisorCards = [
  {
    title: 'Live completion',
    value: '42 / 54',
    note: 'Across the Cienna facility',
    tone: 'green',
  },
  {
    title: 'Missed tasks',
    value: '5',
    note: '2 carried forward automatically',
    tone: 'amber',
  },
  {
    title: 'Photo audits',
    value: '8',
    note: '3 random verifications still open',
    tone: 'blue',
  },
  {
    title: 'Issues raised',
    value: '3',
    note: '1 marked urgent',
    tone: 'red',
  },
];

export const taskLibrary = [
  {
    title: 'Toilet block',
    category: 'Amenities',
    duration: 'Variable',
    flags: ['Reusable', 'Multi-zone', 'Photo optional'],
  },
  {
    title: 'Lift refresh',
    category: 'Vertical transport',
    duration: 'Variable',
    flags: ['Reusable', 'High touch points', 'Daily'],
  },
  {
    title: 'Residents lounge touch-up',
    category: 'Shared spaces',
    duration: 'Variable',
    flags: ['Reusable', 'Presentation', 'Flexible order'],
  },
  {
    title: 'Carpark round',
    category: 'External',
    duration: 'Variable',
    flags: ['Reusable', 'Weather dependent', 'Random photo eligible'],
  },
];

export const reports = [
  ['Location', facilityName],
  ['Zone', 'Rooftop'],
  ['Cleaner', 'Mia Thompson'],
  ['Date range', 'Last 7 days'],
  ['Completion rate', '94%'],
  ['Audits passed', '11 / 12'],
];

const allocationCards = allocationDays.flatMap((day, dayIndex) => (
  Array.from({ length: 60 }, (_, index) => {
    const sequence = dayIndex * 60 + index + 1;
    const jobOrder = index + 1;
    const template = taskCatalog[index % taskCatalog.length];
    const zone = zoneNames[(index + dayIndex) % zoneNames.length];
    const taskGroupNumber = Math.floor(index / 5) + 1;

    return {
      id: `alloc-${sequence}`,
      title: template.title,
      templateId: template.templateId,
      staff: allocationStaff[index % allocationStaff.length],
      day,
      jobOrder,
      facility: facilityName,
      zone,
      taskGroup: template.taskGroup,
      type: index % 4 === 0 ? 'critical' : 'suggestive',
      groupId: `group-${dayIndex + 1}-${taskGroupNumber}`,
      groupName: `${template.taskGroup} ${taskGroupNumber}`,
      detached: false,
    };
  })
));

const taskGroups = allocationDays.flatMap((day, dayIndex) => (
  Array.from({ length: 12 }, (_, groupIndex) => {
    const groupId = `group-${dayIndex + 1}-${groupIndex + 1}`;
    const groupCards = allocationCards.filter((card) => card.groupId === groupId);
    return {
      id: groupId,
      name: groupCards[0]?.groupName ?? `Task group ${groupIndex + 1}`,
      day,
      staff: groupCards[0]?.staff ?? allocationStaff[groupIndex % allocationStaff.length],
      facility: facilityName,
      zone: groupCards[0]?.zone ?? zoneNames[groupIndex % zoneNames.length],
      jobOrderStart: groupCards[0]?.jobOrder ?? 1,
      jobOrderEnd: groupCards[groupCards.length - 1]?.jobOrder ?? 5,
      taskCount: groupCards.length,
      type: groupCards.some((card) => card.type === 'critical') ? 'critical' : 'suggestive',
    };
  })
));

export const scheduleBuilder = {
  selectedLocation: facilityName,
  selectedZone: 'Rooftop',
  frequency: 'Weekdays',
  shift: 'Flexible daily run · no fixed task times',
  assignedCleaner: 'Mia Thompson',
  repeatRule: 'Mon-Fri · generate daily task instances',
  randomPhotoRate: '30% of eligible tasks',
  draftTasks: [
    {
      order: 1,
      jobOrderNumber: '001',
      title: 'Clean toilets',
      templateId: 'task_template_001',
      taskGroup: 'Toilet block',
      zone: 'Entry t4',
      facility: facilityName,
      required: 'Standard',
      frequency: 'Daily',
      frequencyType: 'Critical',
      lastCompleted: '30 May 2026',
      suggestedDue: '31 May 2026',
    },
    {
      order: 2,
      jobOrderNumber: '002',
      title: 'Mop floor',
      templateId: 'task_template_002',
      taskGroup: 'Toilet block',
      zone: 'Entry t4',
      facility: facilityName,
      required: 'Random photo eligible',
      frequency: 'Daily',
      frequencyType: 'Critical',
      lastCompleted: '30 May 2026',
      suggestedDue: '31 May 2026',
    },
    {
      order: 3,
      jobOrderNumber: '003',
      title: 'Check toilet paper',
      templateId: 'task_template_003',
      taskGroup: 'Toilet block',
      zone: 'Entry t4',
      facility: facilityName,
      required: 'Standard',
      frequency: 'Daily',
      frequencyType: 'Critical',
      lastCompleted: '30 May 2026',
      suggestedDue: '31 May 2026',
    },
    {
      order: 4,
      jobOrderNumber: '018',
      title: 'Polish lift mirrors',
      templateId: 'task_template_004',
      taskGroup: 'Lift refresh',
      zone: 'Lifts',
      facility: facilityName,
      required: 'Comment on low grade',
      frequency: 'Every 2 days',
      frequencyType: 'Suggestive',
      lastCompleted: '29 May 2026',
      suggestedDue: '31 May 2026',
    },
    {
      order: 5,
      jobOrderNumber: '045',
      title: 'Check pool furniture',
      templateId: 'task_template_005',
      taskGroup: 'Pool deck reset',
      zone: 'Pool area',
      facility: facilityName,
      required: 'Forced photo',
      frequency: 'Weekly',
      frequencyType: 'Suggestive',
      lastCompleted: '27 May 2026',
      suggestedDue: '3 Jun 2026',
    },
  ],
  generatedInstances: [
    ['Mon 1 Jun', '5 task instances', 'scheduled_zone-1_2026-06-01_morning'],
    ['Tue 2 Jun', '5 task instances', 'scheduled_zone-1_2026-06-02_morning'],
    ['Wed 3 Jun', '5 task instances', 'scheduled_zone-1_2026-06-03_morning'],
  ],
  calendarDays: [
    {
      date: 'Mon 1',
      dayType: 'weekday',
      jobs: [
        { jobOrderStart: '001', facility: facilityName, zone: 'Entry t4', groupName: 'Toilet block', count: 5, type: 'critical' },
        { jobOrderStart: '018', facility: facilityName, zone: 'Lifts', groupName: 'Lift refresh', count: 4, type: 'suggestive' },
      ],
    },
    {
      date: 'Tue 2',
      dayType: 'weekday',
      jobs: [
        { jobOrderStart: '001', facility: facilityName, zone: 'Entry t3', groupName: 'Toilet block', count: 5, type: 'critical' },
        { jobOrderStart: '041', facility: facilityName, zone: 'Residents lounge', groupName: 'Residents lounge touch-up', count: 2, type: 'suggestive' },
      ],
    },
    {
      date: 'Wed 3',
      dayType: 'weekday',
      jobs: [
        { jobOrderStart: '001', facility: facilityName, zone: 'Rooftop', groupName: 'Rooftop presentation', count: 5, type: 'critical' },
        { jobOrderStart: '018', facility: facilityName, zone: 'Pool area', groupName: 'Pool deck reset', count: 4, type: 'suggestive' },
      ],
    },
    {
      date: 'Thu 4',
      dayType: 'weekday',
      jobs: [
        { jobOrderStart: '001', facility: facilityName, zone: 'Carparks', groupName: 'Carpark round', count: 5, type: 'critical' },
        { jobOrderStart: '030', facility: facilityName, zone: 'Entry t3', groupName: 'Entry detail', count: 3, type: 'critical' },
      ],
    },
    {
      date: 'Fri 5',
      dayType: 'weekday',
      jobs: [
        { jobOrderStart: '001', facility: facilityName, zone: 'Residents lounge', groupName: 'Residents lounge touch-up', count: 5, type: 'critical' },
        { jobOrderStart: '045', facility: facilityName, zone: 'Pool area', groupName: 'Pool deck reset', count: 1, type: 'suggestive' },
      ],
    },
    {
      date: 'Sat 6',
      dayType: 'weekend',
      jobs: [
        { jobOrderStart: '008', facility: facilityName, zone: 'Rooftop', groupName: 'Rooftop presentation', count: 2, type: 'suggestive' },
      ],
    },
    {
      date: 'Sun 7',
      dayType: 'weekend',
      jobs: [],
    },
  ],
  allocationBoard: {
    staff: [...allocationStaff, 'Unallocated'],
    staffMeta: {
      'Mia Thompson': { shiftLabel: 'Morning flexible shift', shiftWindow: '6:00 AM – 2:00 PM' },
      'Leo Nguyen': { shiftLabel: 'Day flexible shift', shiftWindow: '7:30 AM – 3:30 PM' },
      'Ava Patel': { shiftLabel: 'Late flexible shift', shiftWindow: '9:00 AM – 5:00 PM' },
      Unallocated: { shiftLabel: 'Not assigned', shiftWindow: 'No shift yet' },
    },
    days: allocationDays,
    cards: [
      ...allocationCards,
      { id: 'alloc-unassigned-1', title: 'Wipe intercom panel', staff: 'Unallocated', day: 'Mon 1', jobOrder: 52, facility: facilityName, zone: 'Entry t4', taskGroup: 'Entry detail', type: 'suggestive' },
      { id: 'alloc-unassigned-2', title: 'Check safety signage', staff: 'Unallocated', day: 'Wed 3', jobOrder: 48, facility: facilityName, zone: 'Pool area', taskGroup: 'Pool deck reset', type: 'critical' },
      { id: 'alloc-unassigned-3', title: 'Inspect trolley area', staff: 'Unallocated', day: 'Fri 5', jobOrder: 55, facility: facilityName, zone: 'Carparks', taskGroup: 'Carpark round', type: 'suggestive' },
    ],
  },
  exceptionWorkflow: {
    groups: taskGroups.slice(0, 8),
    detachedTasks: [
      {
        ...allocationCards[7],
        id: 'detached-demo-1',
        title: 'Extra mop up after spill',
        detached: true,
        day: 'Tue 2',
        jobOrder: 33,
        staff: 'Leo Nguyen',
        reason: 'Incident clean-up required outside normal run',
      },
      {
        ...allocationCards[18],
        id: 'detached-demo-2',
        title: 'Urgent litter sweep at entry',
        detached: true,
        day: 'Wed 3',
        jobOrder: 48,
        staff: 'Ava Patel',
        reason: 'Separated from group and rescheduled individually',
      },
    ],
  },
};
