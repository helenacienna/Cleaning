const facilities = ['Cienna', 'Boheme', 'Holidays'];

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
  { name: 'Tony', facility: 'Cienna', shiftLabel: 'Morning walk-through shift', shiftWindow: '6:00 AM – 2:00 PM', routeLabel: 'Rooftop → Tower 4 → Residents lounge → Pool → Carparks' },
  { name: 'Leo Nguyen', facility: 'Boheme', shiftLabel: 'Day flexible shift', shiftWindow: '7:30 AM – 3:30 PM', routeLabel: 'Boheme → Holidays → Cienna' },
  { name: 'Ava Patel', facility: 'Holidays', shiftLabel: 'Late flexible shift', shiftWindow: '9:00 AM – 5:00 PM', routeLabel: 'Holidays → Cienna → Boheme' },
];
const allocationDays = ['Mon 1', 'Tue 2', 'Wed 3', 'Thu 4', 'Fri 5', 'Sat 6', 'Sun 7', 'Mon 8', 'Tue 9', 'Wed 10'];
const TARGET_TASKS_PER_SHIFT = 50;
const COMPLETION_RATIO = 0.6;

const supplementalTaskBlueprints = [
  { category: 'annual', title: 'Pressure wash main entry paving', zone: 'Entry t4', taskGroup: 'Annual presentation works', required: 'Random photo eligible', frequency: 'Annual', frequencyType: 'Critical', estimatedMinutes: 60, lastCompleted: '12 Jun 2025', suggestedDue: '12 Jun 2026' },
  { category: 'annual', title: 'Deep clean rooftop drainage channels', zone: 'Rooftop', taskGroup: 'Annual presentation works', required: 'Comment on exception', frequency: 'Annual', frequencyType: 'Critical', estimatedMinutes: 50, lastCompleted: '18 Jun 2025', suggestedDue: '18 Jun 2026' },
  { category: 'annual', title: 'Strip and seal loading dock concrete edges', zone: 'Loading dock', taskGroup: 'Annual presentation works', required: 'Random photo eligible', frequency: 'Annual', frequencyType: 'Critical', estimatedMinutes: 75, lastCompleted: '24 Jun 2025', suggestedDue: '24 Jun 2026' },
  { category: 'annual', title: 'High-level dusting around lift vents and bulkheads', zone: 'Lifts', taskGroup: 'Annual presentation works', required: 'Comment on exception', frequency: 'Annual', frequencyType: 'Critical', estimatedMinutes: 45, lastCompleted: '8 Jul 2025', suggestedDue: '8 Jul 2026' },
  { category: 'annual', title: 'Emergency signage and fitting detail clean', zone: 'Carparks', taskGroup: 'Annual presentation works', required: 'Standard', frequency: 'Annual', frequencyType: 'Critical', estimatedMinutes: 40, lastCompleted: '30 Jul 2025', suggestedDue: '30 Jul 2026' },
  { category: 'quarterly', title: 'Pressure wash pool deck and drain covers', zone: 'Pool area', taskGroup: 'Quarterly deep cleans', required: 'Random photo eligible', frequency: 'Quarterly', frequencyType: 'Critical', estimatedMinutes: 40, lastCompleted: '2 Mar 2026', suggestedDue: '2 Jun 2026' },
  { category: 'quarterly', title: 'Machine scrub gym floor edges', zone: 'Gym', taskGroup: 'Quarterly deep cleans', required: 'Standard', frequency: 'Quarterly', frequencyType: 'Critical', estimatedMinutes: 35, lastCompleted: '6 Mar 2026', suggestedDue: '6 Jun 2026' },
  { category: 'quarterly', title: 'Deep clean parcel locker fronts and surrounds', zone: 'Mail room', taskGroup: 'Quarterly deep cleans', required: 'Comment on exception', frequency: 'Quarterly', frequencyType: 'Critical', estimatedMinutes: 30, lastCompleted: '10 Mar 2026', suggestedDue: '10 Jun 2026' },
  { category: 'quarterly', title: 'Polish lift doors and threshold trims', zone: 'Lifts', taskGroup: 'Quarterly deep cleans', required: 'Random photo eligible', frequency: 'Quarterly', frequencyType: 'Critical', estimatedMinutes: 30, lastCompleted: '14 Mar 2026', suggestedDue: '14 Jun 2026' },
  { category: 'quarterly', title: 'Detail carpark line-marking edges', zone: 'Carparks', taskGroup: 'Quarterly deep cleans', required: 'Standard', frequency: 'Quarterly', frequencyType: 'Critical', estimatedMinutes: 35, lastCompleted: '18 Mar 2026', suggestedDue: '18 Jun 2026' },
  { category: 'quarterly', title: 'Clean rooftop glass balustrades end-to-end', zone: 'Rooftop', taskGroup: 'Quarterly deep cleans', required: 'Random photo eligible', frequency: 'Quarterly', frequencyType: 'Critical', estimatedMinutes: 45, lastCompleted: '22 Mar 2026', suggestedDue: '22 Jun 2026' },
  { category: 'quarterly', title: 'Descale shower and amenities fixtures', zone: 'Pool area', taskGroup: 'Quarterly deep cleans', required: 'Comment on exception', frequency: 'Quarterly', frequencyType: 'Critical', estimatedMinutes: 30, lastCompleted: '26 Mar 2026', suggestedDue: '26 Jun 2026' },
  { category: 'quarterly', title: 'Steam clean lounge upholstery and rugs', zone: 'Residents lounge', taskGroup: 'Quarterly deep cleans', required: 'Random photo eligible', frequency: 'Quarterly', frequencyType: 'Critical', estimatedMinutes: 45, lastCompleted: '30 Mar 2026', suggestedDue: '30 Jun 2026' },
  { category: 'quarterly', title: 'Deep clean roller door tracks and kickplates', zone: 'Loading dock', taskGroup: 'Quarterly deep cleans', required: 'Standard', frequency: 'Quarterly', frequencyType: 'Critical', estimatedMinutes: 35, lastCompleted: '3 Apr 2026', suggestedDue: '3 Jul 2026' },
  { category: 'quarterly', title: 'Scrub tiled entry grout and corners', zone: 'Entry t3', taskGroup: 'Quarterly deep cleans', required: 'Comment on exception', frequency: 'Quarterly', frequencyType: 'Critical', estimatedMinutes: 30, lastCompleted: '7 Apr 2026', suggestedDue: '7 Jul 2026' },
  { category: 'as-required', title: 'Spill response clean-up and signage reset', zone: 'Loading dock', taskGroup: 'Responsive works', required: 'Comment on exception', frequency: 'As required', frequencyType: 'Suggestive', estimatedMinutes: 20, lastCompleted: '—', suggestedDue: 'As triggered' },
  { category: 'as-required', title: 'Graffiti removal touch-up', zone: 'Entry t4', taskGroup: 'Responsive works', required: 'Random photo eligible', frequency: 'As required', frequencyType: 'Suggestive', estimatedMinutes: 20, lastCompleted: '—', suggestedDue: 'As triggered' },
  { category: 'as-required', title: 'Event setup reset and furniture recovery', zone: 'Residents lounge', taskGroup: 'Responsive works', required: 'Standard', frequency: 'As required', frequencyType: 'Suggestive', estimatedMinutes: 25, lastCompleted: '—', suggestedDue: 'As triggered' },
  { category: 'as-required', title: 'Storm debris sweep and drain check', zone: 'Rooftop', taskGroup: 'Responsive works', required: 'Comment on exception', frequency: 'As required', frequencyType: 'Suggestive', estimatedMinutes: 25, lastCompleted: '—', suggestedDue: 'As triggered' },
  { category: 'as-required', title: 'Broken glass isolation and clean', zone: 'Entry t3', taskGroup: 'Responsive works', required: 'Random photo eligible', frequency: 'As required', frequencyType: 'Critical', estimatedMinutes: 15, lastCompleted: '—', suggestedDue: 'As triggered' },
  { category: 'as-required', title: 'Contractor access presentation touch-up', zone: 'Lifts', taskGroup: 'Responsive works', required: 'Standard', frequency: 'As required', frequencyType: 'Suggestive', estimatedMinutes: 15, lastCompleted: '—', suggestedDue: 'As triggered' },
  { category: 'as-required', title: 'Parcel overflow tidy and re-stack', zone: 'Mail room', taskGroup: 'Responsive works', required: 'Comment on exception', frequency: 'As required', frequencyType: 'Suggestive', estimatedMinutes: 20, lastCompleted: '—', suggestedDue: 'As triggered' },
  { category: 'as-required', title: 'Body corporate inspection presentation pass', zone: 'Entry t4', taskGroup: 'Responsive works', required: 'Random photo eligible', frequency: 'As required', frequencyType: 'Critical', estimatedMinutes: 20, lastCompleted: '—', suggestedDue: 'As triggered' },
  { category: 'as-required', title: 'After-hours complaint touch-up clean', zone: 'Pool area', taskGroup: 'Responsive works', required: 'Comment on exception', frequency: 'As required', frequencyType: 'Suggestive', estimatedMinutes: 15, lastCompleted: '—', suggestedDue: 'As triggered' },
  { category: 'as-required', title: 'Odour treatment at bin bay and surrounds', zone: 'Carparks', taskGroup: 'Responsive works', required: 'Standard', frequency: 'As required', frequencyType: 'Suggestive', estimatedMinutes: 20, lastCompleted: '—', suggestedDue: 'As triggered' },
];

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
            cadenceMode: groupIndex === 2 ? 'Anchored' : groupIndex === 1 ? 'Rolling' : 'Rolling',
            frequencyType: groupIndex === 2 ? 'Suggestive' : 'Critical',
            estimatedMinutes: taskIndex === 0 ? 5 : 10,
            lastCompleted: taskIndex === 0 ? '30 May 2026' : '29 May 2026',
            suggestedDue: groupIndex === 2 ? '5 Jun 2026' : '1 Jun 2026',
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
      jobOrderNumber: task.jobOrderNumber,
      required: task.required,
      frequency: task.frequency,
      frequencyType: task.frequencyType,
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
      jobOrderNumber: task.jobOrderNumber,
      required: task.required,
      frequency: task.frequency,
      frequencyType: task.frequencyType,
      estimatedMinutes: task.estimatedMinutes,
      notes: task.notes,
      status: index < completedTarget ? 'completed' : index === completedTarget ? 'in-progress' : (task.photoRequired && index % 7 === 0 ? 'photo-required' : 'pending'),
      photoRequired: task.photoRequired,
      commentRequired: task.commentRequired,
      taskGroup: task.taskGroup,
      zone: task.zone,
    };
  });
}

const tonyPdfWalkthroughTasks = [
  { title: 'Glass Clean', taskGroup: 'Rooftop', zone: 'Rooftop', photoRequired: false, commentRequired: false },
  { title: 'Straighten all furniture and loungers', taskGroup: 'Rooftop', zone: 'Rooftop', photoRequired: false, commentRequired: false },
  { title: 'Rooftop Bathroom Clean', taskGroup: 'Rooftop', zone: 'Rooftop', photoRequired: false, commentRequired: false },
  { title: "Check BBQ's", taskGroup: 'Rooftop', zone: 'Rooftop', photoRequired: false, commentRequired: false },
  { title: 'Check Binchute', taskGroup: 'Rooftop', zone: 'Rooftop', photoRequired: false, commentRequired: false },
  { title: 'Gardens Tidy', taskGroup: 'Rooftop', zone: 'Rooftop', photoRequired: false, commentRequired: false },
  { title: 'Lift 1 floor', taskGroup: 'Tower 4 Lifts', zone: 'Lifts', photoRequired: false, commentRequired: false },
  { title: 'Lift 1 Walls', taskGroup: 'Tower 4 Lifts', zone: 'Lifts', photoRequired: false, commentRequired: false },
  { title: 'Lift 2 floor', taskGroup: 'Tower 4 Lifts', zone: 'Lifts', photoRequired: false, commentRequired: false },
  { title: 'Lift 2 Walls', taskGroup: 'Tower 4 Lifts', zone: 'Lifts', photoRequired: false, commentRequired: false },
  { title: 'Floor', taskGroup: 'Tower 4 entry', zone: 'Entry t4', photoRequired: false, commentRequired: false },
  { title: 'Furniture tidy', taskGroup: 'Tower 4 entry', zone: 'Entry t4', photoRequired: false, commentRequired: false },
  { title: 'Glass doors', taskGroup: 'Tower 4 entry', zone: 'Entry t4', photoRequired: false, commentRequired: false },
  { title: 'Visitor Bathroom', taskGroup: 'Tower 4 entry', zone: 'Entry t4', photoRequired: false, commentRequired: false },
  { title: 'Toilet 1 Clean', taskGroup: 'Cafe Toilets', zone: 'Entry t4', photoRequired: false, commentRequired: false },
  { title: 'Toilet 2 Clean', taskGroup: 'Cafe Toilets', zone: 'Entry t4', photoRequired: false, commentRequired: false },
  { title: 'Floor infront of toilets all the way to the cafe clean', taskGroup: 'Cafe Toilets', zone: 'Entry t4', photoRequired: false, commentRequired: false },
  { title: 'Floors clean', taskGroup: 'Residents Lounge', zone: 'Residents lounge', photoRequired: false, commentRequired: false },
  { title: 'Furniture straightened', taskGroup: 'Residents Lounge', zone: 'Residents lounge', photoRequired: false, commentRequired: false },
  { title: 'Glass clean', taskGroup: 'Residents Lounge', zone: 'Residents lounge', photoRequired: false, commentRequired: false },
  { title: 'Fridge clean', taskGroup: 'Residents Lounge', zone: 'Residents lounge', photoRequired: false, commentRequired: false },
  { title: 'Bin next to fridge emptied', taskGroup: 'Residents Lounge', zone: 'Residents lounge', photoRequired: false, commentRequired: false },
  { title: 'Benches clean', taskGroup: 'Residents Lounge', zone: 'Residents lounge', photoRequired: false, commentRequired: false },
  { title: 'Straighten Furniture', taskGroup: 'Pool Area', zone: 'Pool area', photoRequired: false, commentRequired: false },
  { title: 'Blow Down and Collect Leaves', taskGroup: 'Pool Area', zone: 'Pool area', photoRequired: false, commentRequired: false },
  { title: 'Pool Area Generally Clean and Tidy', taskGroup: 'Pool Area', zone: 'Pool area', photoRequired: false, commentRequired: false },
  { title: 'BBQ and Bench Clean', taskGroup: 'BBQ 1 - Near Rec Room', zone: 'Pool area', photoRequired: false, commentRequired: false },
  { title: 'Furniture Clean', taskGroup: 'BBQ 1 - Near Rec Room', zone: 'Pool area', photoRequired: false, commentRequired: false },
  { title: 'Mens Bathroom Clean', taskGroup: 'Pool Toilets X 3', zone: 'Pool area', photoRequired: false, commentRequired: false },
  { title: 'Disabled Toilet Clean', taskGroup: 'Pool Toilets X 3', zone: 'Pool area', photoRequired: false, commentRequired: false },
  { title: "Woman's Toilet Clean", taskGroup: 'Pool Toilets X 3', zone: 'Pool area', photoRequired: false, commentRequired: false },
  { title: 'Glass Clean', taskGroup: 'Tower 3 Entrance Foyer', zone: 'Entry t3', photoRequired: false, commentRequired: false },
  { title: 'Furniture Tidy', taskGroup: 'Tower 3 Entrance Foyer', zone: 'Entry t3', photoRequired: false, commentRequired: false },
  { title: 'Floors Clean', taskGroup: 'Tower 3 Entrance Foyer', zone: 'Entry t3', photoRequired: false, commentRequired: false },
  { title: 'Lift 3 Clean', taskGroup: 'Tower 3 Entrance Foyer', zone: 'Entry t3', photoRequired: false, commentRequired: false },
  { title: 'Lift 4 Clean', taskGroup: 'Tower 3 Entrance Foyer', zone: 'Entry t3', photoRequired: false, commentRequired: false },
  { title: 'Building 3 Lift Foyer and Rubbish Bin', taskGroup: 'Carpark B1', zone: 'Carparks', photoRequired: false, commentRequired: false },
  { title: 'Gym', taskGroup: 'Carpark B1', zone: 'Gym', photoRequired: false, commentRequired: false },
  { title: 'Building 4 Lift Foyer and Rubbish Bin', taskGroup: 'Carpark B1', zone: 'Carparks', photoRequired: false, commentRequired: false },
  { title: 'Building 4 Lift Foyer and Rubbish Bin', taskGroup: 'Carpark B2', zone: 'Carparks', photoRequired: false, commentRequired: false },
  { title: 'Building 4 Mailbox Area', taskGroup: 'Carpark B2', zone: 'Mail room', photoRequired: false, commentRequired: false },
  { title: 'General Carpark Clean', taskGroup: 'Carpark B2', zone: 'Carparks', photoRequired: false, commentRequired: false },
  { title: 'Building 3 Lift Foyer and Rubbish Bin', taskGroup: 'Carpark B2', zone: 'Carparks', photoRequired: false, commentRequired: false },
  { title: 'Building 3 Mailbox Area', taskGroup: 'Carpark B2', zone: 'Mail room', photoRequired: false, commentRequired: false },
  { title: 'Litter in Carpark', taskGroup: 'Visitor Carpark', zone: 'Carparks', photoRequired: false, commentRequired: false },
  { title: 'Parcel Locker Area Tidy', taskGroup: 'Visitor Carpark', zone: 'Mail room', photoRequired: false, commentRequired: false },
];

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
  zone: staff.name === 'Tony' ? 'Rooftop' : zoneBlueprints[index].zone,
  shift: staff.shiftLabel,
  progress: Math.round(COMPLETION_RATIO * 100),
  stats: {
    total: TARGET_TASKS_PER_SHIFT,
    completed: Math.round(TARGET_TASKS_PER_SHIFT * COMPLETION_RATIO),
    photoRequired: staff.name === 'Tony' ? 0 : Math.round(TARGET_TASKS_PER_SHIFT * 0.18),
  },
  tasks: staff.name === 'Tony'
    ? buildAssignmentTasks(staff.facility, 'Rooftop', tonyPdfWalkthroughTasks)
    : buildAssignmentTasks(staff.facility, zoneBlueprints[index].zone),
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
  return new Date(`${day.replace(/^(\w{3})\s(\d{1,2})$/, '2026-06-$2')}T00:00:00`);
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
        staff: staff.name,
        day,
        jobOrder,
        laneIndex: poolItem.laneIndex,
        routeStopIndex: poolItem.stopIndex,
        status: index < completedTarget ? 'completed' : index === completedTarget ? 'in-progress' : 'pending',
        facility: template.facility,
        zone: template.zone,
        taskGroup: template.taskGroup,
        frequency: template.frequency,
        cadenceMode: template.cadenceMode,
        type: template.frequencyType.toLowerCase(),
        groupId: `group-${dayIndex + 1}-${template.zoneId}-${template.groupKey}`,
        groupName: template.taskGroup,
        auditScore: index < completedTarget ? (jobOrder % 4 === 0 ? 4 : 5) : null,
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
