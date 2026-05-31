const facilities = ['Cienna North', 'Cienna Central', 'Cienna South'];

const zoneBlueprints = [
  {
    id: 'zone-1',
    zone: 'Rooftop',
    groups: [
      { key: 'rooftop-presentation', name: 'Rooftop presentation', tasks: ['Clear tables', 'Wipe handrails'] },
      { key: 'bbq-reset', name: 'BBQ area reset', tasks: ['Clean BBQ surrounds', 'Check outdoor bins'] },
      { key: 'planter-perimeter', name: 'Planter perimeter', tasks: ['Sweep planter edges', 'Remove loose litter'] },
    ],
  },
  {
    id: 'zone-2',
    zone: 'Lifts',
    groups: [
      { key: 'lift-refresh', name: 'Lift refresh', tasks: ['Polish lift mirrors', 'Wipe buttons and rails'] },
      { key: 'lift-foyer-detail', name: 'Lift foyer detail', tasks: ['Vacuum lift foyer mats', 'Spot clean foyer glass'] },
      { key: 'button-sanitising', name: 'Button sanitising', tasks: ['Sanitise call buttons', 'Wipe door tracks'] },
    ],
  },
  {
    id: 'zone-3',
    zone: 'Entry t4',
    groups: [
      { key: 'toilet-block-t4', name: 'Toilet block', tasks: ['Clean toilets', 'Mop floor'] },
      { key: 'entry-detail-t4', name: 'Entry detail', tasks: ['Vacuum mats', 'Wipe intercom panel'] },
      { key: 'glass-presentation-t4', name: 'Glass presentation', tasks: ['Spot clean glass', 'Remove marks from doors'] },
    ],
  },
  {
    id: 'zone-4',
    zone: 'Entry t3',
    groups: [
      { key: 'toilet-block-t3', name: 'Toilet block', tasks: ['Check toilet paper', 'Wipe basins and mirrors'] },
      { key: 'entry-detail-t3', name: 'Entry detail', tasks: ['Check entrance presentation', 'Clean skirting edges'] },
      { key: 'mail-lobby-reset', name: 'Mail lobby reset', tasks: ['Tidy parcel shelves', 'Wipe lobby bench'] },
    ],
  },
  {
    id: 'zone-5',
    zone: 'Residents lounge',
    groups: [
      { key: 'lounge-touchup', name: 'Residents lounge touch-up', tasks: ['Wipe tables', 'Arrange cushions and chairs'] },
      { key: 'kitchenette-reset', name: 'Kitchenette reset', tasks: ['Clean kitchenette bench', 'Restock paper towel'] },
      { key: 'soft-furnishing-check', name: 'Soft furnishing check', tasks: ['Vacuum lounge floor', 'Spot clean upholstery'] },
    ],
  },
  {
    id: 'zone-6',
    zone: 'Pool area',
    groups: [
      { key: 'pool-deck-reset', name: 'Pool deck reset', tasks: ['Check pool furniture', 'Rinse high-traffic patches'] },
      { key: 'amenities-wipe-down', name: 'Amenities wipe-down', tasks: ['Wipe gate handles', 'Clean shower touch points'] },
      { key: 'safety-inspection', name: 'Safety inspection', tasks: ['Check safety signage', 'Remove leaf litter'] },
    ],
  },
  {
    id: 'zone-7',
    zone: 'Carparks',
    groups: [
      { key: 'carpark-round', name: 'Carpark round', tasks: ['Pick litter', 'Blow leaves from corners'] },
      { key: 'bin-bay-detail', name: 'Bin bay detail', tasks: ['Check bin bays', 'Degrease bin bay handles'] },
      { key: 'access-ramp-tidy', name: 'Access ramp tidy', tasks: ['Spot clean entry doors', 'Inspect trolley area'] },
    ],
  },
  {
    id: 'zone-8',
    zone: 'Gym',
    groups: [
      { key: 'gym-floor-care', name: 'Gym floor care', tasks: ['Vacuum gym floor', 'Mop rubber flooring'] },
      { key: 'equipment-wipe-down', name: 'Equipment wipe-down', tasks: ['Sanitise cardio equipment', 'Wipe free weights'] },
      { key: 'mirror-presentation', name: 'Mirror presentation', tasks: ['Polish wall mirrors', 'Check drink station'] },
    ],
  },
  {
    id: 'zone-9',
    zone: 'Mail room',
    groups: [
      { key: 'parcel-room-reset', name: 'Parcel room reset', tasks: ['Tidy parcel shelving', 'Sweep parcel room floor'] },
      { key: 'locker-wipe-down', name: 'Locker wipe-down', tasks: ['Wipe locker doors', 'Check fingerprint marks'] },
      { key: 'waste-detail', name: 'Waste detail', tasks: ['Empty bins', 'Replace liners'] },
    ],
  },
  {
    id: 'zone-10',
    zone: 'Loading dock',
    groups: [
      { key: 'dock-sweep', name: 'Dock sweep', tasks: ['Sweep loading dock', 'Remove cardboard scraps'] },
      { key: 'roller-door-check', name: 'Roller door check', tasks: ['Wipe roller door handles', 'Check scuff marks near door'] },
      { key: 'back-of-house-tidy', name: 'Back-of-house tidy', tasks: ['Tidy delivery corner', 'Check back-of-house bins'] },
    ],
  },
];

const allocationStaff = [
  { name: 'Mia Thompson', facility: 'Cienna North', shiftLabel: 'Morning flexible shift', shiftWindow: '6:00 AM – 2:00 PM', routeLabel: 'Cienna North → Cienna Central → Cienna North' },
  { name: 'Leo Nguyen', facility: 'Cienna Central', shiftLabel: 'Day flexible shift', shiftWindow: '7:30 AM – 3:30 PM', routeLabel: 'Cienna Central → Cienna South → Cienna North' },
  { name: 'Ava Patel', facility: 'Cienna South', shiftLabel: 'Late flexible shift', shiftWindow: '9:00 AM – 5:00 PM', routeLabel: 'Cienna South → Cienna North → Cienna Central' },
];
const allocationDays = ['Mon 1', 'Tue 2', 'Wed 3', 'Thu 4', 'Fri 5'];

const allocationRoutes = {
  'Mia Thompson': [
    { facility: 'Cienna North', zones: ['Rooftop', 'Lifts', 'Entry t4'], laneIndexes: [0, 1] },
    { facility: 'Cienna Central', zones: ['Entry t3', 'Residents lounge', 'Pool area', 'Carparks'], laneIndexes: [2, 3, 4] },
    { facility: 'Cienna North', zones: ['Gym', 'Mail room', 'Loading dock'], laneIndexes: [5, 6, 7] },
  ],
  'Leo Nguyen': [
    { facility: 'Cienna Central', zones: ['Rooftop', 'Lifts', 'Entry t4', 'Entry t3'], laneIndexes: [1, 2, 3] },
    { facility: 'Cienna South', zones: ['Residents lounge', 'Pool area', 'Carparks'], laneIndexes: [4, 5, 6] },
    { facility: 'Cienna North', zones: ['Gym', 'Mail room', 'Loading dock'], laneIndexes: [7, 8] },
  ],
  'Ava Patel': [
    { facility: 'Cienna South', zones: ['Rooftop', 'Lifts', 'Entry t4'], laneIndexes: [3, 4] },
    { facility: 'Cienna North', zones: ['Entry t3', 'Residents lounge', 'Pool area', 'Carparks'], laneIndexes: [5, 6, 7] },
    { facility: 'Cienna Central', zones: ['Gym', 'Mail room', 'Loading dock'], laneIndexes: [8, 9, 10] },
  ],
};

function makeTemplateId(index) {
  return `task_template_${String(index + 1).padStart(3, '0')}`;
}

function makeTaskCardId(index) {
  return `task-card-${String(index + 1).padStart(3, '0')}`;
}

function buildTaskCatalog() {
  const templates = [];

  facilities.forEach((facilityName, facilityIndex) => {
    zoneBlueprints.forEach((zoneBlueprint, zoneIndex) => {
      zoneBlueprint.groups.forEach((group, groupIndex) => {
        group.tasks.forEach((title, taskIndex) => {
          const templateIndex = templates.length;
          templates.push({
            id: makeTaskCardId(templateIndex),
            title,
            taskGroup: group.name,
            groupKey: group.key,
            groupIndex,
            zoneId: `${facilityIndex + 1}-${zoneBlueprint.id}`,
            zone: zoneBlueprint.zone,
            facility: facilityName,
            templateId: makeTemplateId(templateIndex),
            jobOrderNumber: String(templateIndex + 1).padStart(3, '0'),
            required: taskIndex === 0 ? 'Standard' : zoneIndex % 3 === 0 ? 'Random photo eligible' : 'Comment on exception',
            frequency: groupIndex === 0 ? 'Daily' : groupIndex === 1 ? 'Every 2 days' : 'Weekly',
            frequencyType: groupIndex === 2 ? 'Suggestive' : 'Critical',
            estimatedEffort: taskIndex === 0 ? 'Quick check' : 'Standard pass',
            lastCompleted: taskIndex === 0 ? '30 May 2026' : '29 May 2026',
            suggestedDue: groupIndex === 2 ? '5 Jun 2026' : '1 Jun 2026',
            notes: `${group.name} · ${zoneBlueprint.zone} · ${facilityName}`,
            active: true,
          });
        });
      });
    });
  });

  return templates;
}

export const taskCardTemplates = buildTaskCatalog();
const taskCatalog = taskCardTemplates;

function buildAssignmentTasks(facilityName, zoneName) {
  return taskCardTemplates
    .filter((task) => task.facility === facilityName && task.zone === zoneName)
    .map((task, index) => ({
      id: `assignment-${facilityName}-${zoneName}-${index + 1}`,
      title: task.title,
      status: index < 2 ? 'completed' : index === 2 ? 'photo-required' : index === 3 ? 'pending' : index === 4 ? 'carried-forward' : 'pending',
      photoRequired: task.required === 'Random photo eligible',
      commentRequired: task.required === 'Comment on exception',
    }));
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
  progress: index === 0 ? 75 : index === 1 ? 40 : 62,
  stats: { total: 6, completed: index === 0 ? 3 : index === 1 ? 2 : 4, photoRequired: 2 },
  tasks: buildAssignmentTasks(staff.facility, zoneBlueprints[index].zone),
}));

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
  name: 'Mia Thompson',
  role: 'Morning cleaner',
  nextShift: 'Today · Flexible run window',
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

const allocationCards = allocationDays.flatMap((day, dayIndex) => (
  allocationStaff.flatMap((staff) => {
    const routeStops = allocationRoutes[staff.name] || [];
    let jobOrder = 1;

    return routeStops.flatMap((stop, stopIndex) => {
      const stopTemplates = taskCatalog.filter((template) => template.facility === stop.facility && stop.zones.includes(template.zone));
      const laneSpan = stop.laneIndexes.length;

      return stopTemplates.map((template, templateIndex) => {
        const laneIndex = stop.laneIndexes[Math.min(laneSpan - 1, Math.floor((templateIndex / stopTemplates.length) * laneSpan))];
        const card = {
          id: `alloc-${dayIndex + 1}-${staff.name.replace(/\s+/g, '-').toLowerCase()}-${jobOrder}`,
          title: template.title,
          templateId: template.templateId,
          staff: staff.name,
          day,
          jobOrder,
          laneIndex,
          routeStopIndex: stopIndex,
          status: jobOrder % 5 < 3 ? 'completed' : jobOrder % 5 === 3 ? 'in-progress' : 'pending',
          facility: template.facility,
          zone: template.zone,
          taskGroup: template.taskGroup,
          type: template.frequencyType.toLowerCase(),
          groupId: `group-${dayIndex + 1}-${template.zoneId}-${template.groupKey}`,
          groupName: template.taskGroup,
          detached: false,
        };
        jobOrder += 1;
        return card;
      });
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

const draftSelection = taskCardTemplates.filter((task) => task.facility === 'Cienna North' && task.zone === 'Entry t4').slice(0, 5);

export const scheduleBuilder = {
  selectedLocation: 'Cienna North',
  selectedZone: 'Entry t4',
  frequency: 'Weekdays',
  shift: 'Flexible daily run · no fixed task times',
  assignedCleaner: 'Mia Thompson',
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
    { date: 'Mon 1', dayType: 'weekday', jobs: [{ jobOrderStart: '001', facility: 'Cienna North', zone: 'Entry t4', groupName: 'Toilet block', count: 2, type: 'critical' }, { jobOrderStart: '061', facility: 'Cienna Central', zone: 'Entry t4', groupName: 'Toilet block', count: 2, type: 'critical' }, { jobOrderStart: '121', facility: 'Cienna South', zone: 'Entry t4', groupName: 'Toilet block', count: 2, type: 'critical' }] },
    { date: 'Tue 2', dayType: 'weekday', jobs: [{ jobOrderStart: '019', facility: 'Cienna North', zone: 'Pool area', groupName: 'Pool deck reset', count: 2, type: 'critical' }, { jobOrderStart: '079', facility: 'Cienna Central', zone: 'Pool area', groupName: 'Pool deck reset', count: 2, type: 'critical' }, { jobOrderStart: '139', facility: 'Cienna South', zone: 'Pool area', groupName: 'Pool deck reset', count: 2, type: 'critical' }] },
    { date: 'Wed 3', dayType: 'weekday', jobs: [{ jobOrderStart: '031', facility: 'Cienna North', zone: 'Gym', groupName: 'Gym floor care', count: 2, type: 'suggestive' }, { jobOrderStart: '091', facility: 'Cienna Central', zone: 'Gym', groupName: 'Gym floor care', count: 2, type: 'suggestive' }, { jobOrderStart: '151', facility: 'Cienna South', zone: 'Gym', groupName: 'Gym floor care', count: 2, type: 'suggestive' }] },
    { date: 'Thu 4', dayType: 'weekday', jobs: [{ jobOrderStart: '043', facility: 'Cienna North', zone: 'Loading dock', groupName: 'Dock sweep', count: 2, type: 'suggestive' }, { jobOrderStart: '103', facility: 'Cienna Central', zone: 'Loading dock', groupName: 'Dock sweep', count: 2, type: 'suggestive' }, { jobOrderStart: '163', facility: 'Cienna South', zone: 'Loading dock', groupName: 'Dock sweep', count: 2, type: 'suggestive' }] },
    { date: 'Fri 5', dayType: 'weekday', jobs: [{ jobOrderStart: '013', facility: 'Cienna North', zone: 'Residents lounge', groupName: 'Residents lounge touch-up', count: 2, type: 'critical' }, { jobOrderStart: '073', facility: 'Cienna Central', zone: 'Residents lounge', groupName: 'Residents lounge touch-up', count: 2, type: 'critical' }, { jobOrderStart: '133', facility: 'Cienna South', zone: 'Residents lounge', groupName: 'Residents lounge touch-up', count: 2, type: 'critical' }] },
    { date: 'Sat 6', dayType: 'weekend', jobs: [{ jobOrderStart: '025', facility: 'Cienna North', zone: 'Carparks', groupName: 'Carpark round', count: 2, type: 'suggestive' }] },
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
      { id: 'alloc-unassigned-1', title: 'Check dock spill kit', templateId: 'custom_001', staff: 'Unallocated', day: 'Mon 1', jobOrder: 61, status: 'pending', facility: 'Cienna North', zone: 'Loading dock', taskGroup: 'Back-of-house tidy', type: 'suggestive', groupId: 'group-unassigned-dock', groupName: 'Back-of-house tidy' },
      { id: 'alloc-unassigned-2', title: 'Recheck sauna entry mat', templateId: 'custom_002', staff: 'Unallocated', day: 'Wed 3', jobOrder: 62, status: 'in-progress', facility: 'Cienna Central', zone: 'Pool area', taskGroup: 'Amenities wipe-down', type: 'critical', groupId: 'group-unassigned-pool', groupName: 'Amenities wipe-down' },
      { id: 'alloc-unassigned-3', title: 'Inspect parcel overflow shelf', templateId: 'custom_003', staff: 'Unallocated', day: 'Fri 5', jobOrder: 63, status: 'pending', facility: 'Cienna South', zone: 'Mail room', taskGroup: 'Parcel room reset', type: 'suggestive', groupId: 'group-unassigned-mail', groupName: 'Parcel room reset' },
    ],
  },
  exceptionWorkflow: {
    groups: taskGroups.slice(0, 8),
    detachedTasks: [
      { ...allocationCards[7], id: 'detached-demo-1', title: 'Extra mop up after spill', detached: true, day: 'Tue 2', jobOrder: 33, staff: 'Mia Thompson', reason: 'Incident clean-up required outside normal run' },
      { ...allocationCards[80], id: 'detached-demo-2', title: 'Urgent litter sweep at entry', detached: true, day: 'Wed 3', jobOrder: 48, staff: 'Leo Nguyen', reason: 'Separated from group and rescheduled individually' },
    ],
  },
};
