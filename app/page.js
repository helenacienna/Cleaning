'use client';

export const dynamic = 'force-dynamic';

import {
  taskCardTemplates as demoTaskCardTemplates,
} from '../data/demo-data';
import { DEFAULT_APP_TIME_ZONE, formatBoardDayKeyForTimeZone, getTimeZoneFormatter } from '../lib/app-timezone-shared.js';
import deployStatus from '../data/deploy-status.json';
import Link from 'next/link';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ADMIN_BOARD_REFRESH_MS = 2000;
const APP_NAME = 'Cienna Cleaning';
const FACILITY_NAME_ALIASES = {
  'Cienna North': 'Cienna',
  'Cienna Central': 'Boheme',
  'Cienna South': 'Best Stays',
};

function getFacilityDisplayName(value = '') {
  return FACILITY_NAME_ALIASES[value] ?? value;
}

function slugifyThemeKey(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function statusClass(status) {
  return `task-status status-${status}`;
}

function formatTaskLabel(status = '') {
  return status.replace('-', ' ');
}

function shouldShowTaskStatusBadge(status = '') {
  return String(status || '').toLowerCase() !== 'scheduled';
}

function formatTaskGradeLabel(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore) || numericScore <= 0) {
    return '';
  }

  return String(numericScore);
}

function getTaskCompletionBadge(task = {}) {
  const numericScore = Number(task?.score ?? task?.auditScore);
  if (Number.isFinite(numericScore) && numericScore > 0) {
    return {
      label: numericScore >= 4 ? 'completed' : 'follow-up',
      tone: numericScore >= 4 ? 'completed' : 'carried-forward',
    };
  }

  return {
    label: formatTaskLabel(task?.status ?? ''),
    tone: task?.status ?? '',
  };
}

function normalizeTaskStatus(status = '') {
  if (status === 'in_progress') {
    return 'in-progress';
  }

  if (status === 'carried_forward') {
    return 'carried-forward';
  }

  return status;
}

function getDashboardTaskStaffSortValue(task) {
  const staff = String(task?.staff || 'Unallocated');
  return staff === 'Unallocated' ? 'zzzzzz-unallocated' : staff.toLowerCase();
}

function getDashboardTaskNumberSortParts(task) {
  const rawValue = task?.jobOrderNumber ?? task?.displayOrder ?? task?.instanceCode ?? '';
  const text = String(rawValue ?? '').trim();
  const digits = text.match(/\d+/g)?.join('') ?? '';
  const numeric = digits ? Number.parseInt(digits, 10) : Number.MAX_SAFE_INTEGER;
  return {
    numeric,
    text: text.toLowerCase(),
  };
}

function sortTasksByAssignedThenTaskNumber(tasks = [], preferredStaffOrder = []) {
  const staffOrderIndex = new Map(preferredStaffOrder.map((staffName, index) => [String(staffName), index]));

  return [...tasks].sort((left, right) => {
    const leftStaff = String(left?.staff || 'Unallocated');
    const rightStaff = String(right?.staff || 'Unallocated');
    const leftOrderIndex = staffOrderIndex.has(leftStaff) ? staffOrderIndex.get(leftStaff) : Number.MAX_SAFE_INTEGER;
    const rightOrderIndex = staffOrderIndex.has(rightStaff) ? staffOrderIndex.get(rightStaff) : Number.MAX_SAFE_INTEGER;

    if (leftOrderIndex !== rightOrderIndex) {
      return leftOrderIndex - rightOrderIndex;
    }

    const staffCompare = getDashboardTaskStaffSortValue(left).localeCompare(getDashboardTaskStaffSortValue(right));
    if (staffCompare !== 0) {
      return staffCompare;
    }

    const leftNumber = getDashboardTaskNumberSortParts(left);
    const rightNumber = getDashboardTaskNumberSortParts(right);

    if (leftNumber.numeric !== rightNumber.numeric) {
      return leftNumber.numeric - rightNumber.numeric;
    }

    const textCompare = leftNumber.text.localeCompare(rightNumber.text);
    if (textCompare !== 0) {
      return textCompare;
    }

    if ((left.zone || '') !== (right.zone || '')) {
      return String(left.zone || '').localeCompare(String(right.zone || ''));
    }

    if ((left.taskGroup || '') !== (right.taskGroup || '')) {
      return String(left.taskGroup || '').localeCompare(String(right.taskGroup || ''));
    }

    return String(left.title || '').localeCompare(String(right.title || ''));
  });
}

function buildTaskGroupCollection(tasks = [], preferredStaffOrder = []) {
  const groups = new Map();

  sortTasksByAssignedThenTaskNumber(tasks, preferredStaffOrder).forEach((task, index) => {
    const key = `${task.zone}__${task.taskGroup}`;
    if (!groups.has(key)) {
      groups.set(key, {
        zone: task.zone,
        taskGroup: task.taskGroup,
        tasks: [],
      });
    }

    groups.get(key).tasks.push({ ...task, displayOrder: index + 1 });
  });

  return Array.from(groups.values()).map((group) => {
    const completed = group.tasks.filter((task) => task.status === 'completed').length;
    const total = group.tasks.length;
    return {
      ...group,
      completed,
      total,
      progress: total ? Math.round((completed / total) * 100) : 0,
    };
  });
}

function buildZoneTaskCollection(tasks = [], preferredStaffOrder = []) {
  const zones = new Map();

  sortTasksByAssignedThenTaskNumber(tasks, preferredStaffOrder).forEach((task, index) => {
    const key = task.zone || 'Unassigned zone';
    if (!zones.has(key)) {
      zones.set(key, {
        zone: task.zone || 'Unassigned zone',
        tasks: [],
      });
    }

    zones.get(key).tasks.push({ ...task, displayOrder: index + 1 });
  });

  return Array.from(zones.values()).map((zone) => {
    const completed = zone.tasks.filter((task) => task.status === 'completed').length;
    const total = zone.tasks.length;
    return {
      ...zone,
      completed,
      total,
      progress: total ? Math.round((completed / total) * 100) : 0,
    };
  });
}

function getSectionDefaultStaffOrder(tasks = []) {
  const counts = new Map();

  tasks.forEach((task) => {
    const staffName = String(task?.staff || 'Unallocated');
    counts.set(staffName, (counts.get(staffName) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      if (left[0] === 'Unallocated') return 1;
      if (right[0] === 'Unallocated') return -1;
      return left[0].localeCompare(right[0]);
    })
    .map(([staffName]) => staffName);
}

function resolveSectionStaffOrder(tasks = [], savedOrder = []) {
  const defaultOrder = getSectionDefaultStaffOrder(tasks);
  const activeStaff = new Set(defaultOrder);
  const saved = savedOrder.filter((staffName) => activeStaff.has(staffName));
  const remaining = defaultOrder.filter((staffName) => !saved.includes(staffName));
  return [...saved, ...remaining];
}

function groupAssignmentTasks(tasks = [], options = {}) {
  const dailyTasks = tasks.filter((task) => !task.frequency || String(task.frequency).toLowerCase() === 'daily');
  const otherTasks = tasks.filter((task) => task.frequency && String(task.frequency).toLowerCase() !== 'daily');
  const dailyStaffOrder = resolveSectionStaffOrder(dailyTasks, options.dailyStaffOrder ?? []);
  const periodicStaffOrder = resolveSectionStaffOrder(otherTasks, options.periodicStaffOrder ?? []);
  const dailyTaskGroups = buildTaskGroupCollection(dailyTasks, dailyStaffOrder);
  const otherTaskGroups = buildTaskGroupCollection(otherTasks, periodicStaffOrder);

  const zoneMap = new Map();
  dailyTaskGroups.forEach((group) => {
    if (!zoneMap.has(group.zone)) {
      zoneMap.set(group.zone, {
        zone: group.zone,
        taskGroups: [],
      });
    }
    zoneMap.get(group.zone).taskGroups.push(group);
  });

  const dailyZones = Array.from(zoneMap.values()).map((zoneEntry) => {
    const completed = zoneEntry.taskGroups.reduce((sum, group) => sum + group.completed, 0);
    const total = zoneEntry.taskGroups.reduce((sum, group) => sum + group.total, 0);
    return {
      ...zoneEntry,
      completed,
      total,
      progress: total ? Math.round((completed / total) * 100) : 0,
    };
  });

  const dailyCompleted = dailyZones.reduce((sum, zone) => sum + zone.completed, 0);
  const dailyTotal = dailyZones.reduce((sum, zone) => sum + zone.total, 0);

  return {
    dailyZones,
    otherTaskGroups,
    dailyStaffOrder,
    periodicStaffOrder,
    dailySummary: {
      completed: dailyCompleted,
      total: dailyTotal,
      progress: dailyTotal ? Math.round((dailyCompleted / dailyTotal) * 100) : 0,
    },
  };
}

function groupTasksByStaff(tasks = [], staffMeta = {}) {
  const staffMap = new Map();

  tasks.forEach((task) => {
    const staff = task.staff || 'Unallocated';
    if (!staffMap.has(staff)) {
      staffMap.set(staff, []);
    }

    staffMap.get(staff).push(task);
  });

  return Array.from(staffMap.entries())
    .map(([staff, staffTasks]) => {
      const groups = buildTaskGroupCollection(staffTasks);
      const completed = staffTasks.filter((task) => task.status === 'completed').length;
      const total = staffTasks.length;
      const estimatedMinutes = staffTasks.reduce((sum, task) => sum + (Number(task.estimatedMinutes) || 0), 0);
      const shiftMinutes = Number(staffMeta?.[staff]?.shiftMinutes) || 0;

      return {
        staff,
        tasks: staffTasks,
        groups,
        completed,
        total,
        totalZones: new Set(staffTasks.map((task) => task.zone)).size,
        shiftWindow: staffMeta?.[staff]?.shiftWindow || 'Flexible shift',
        estimatedMinutes,
        shiftMinutes,
        shiftStartMinutes: staffMeta?.[staff]?.shiftStartMinutes ?? null,
        shiftEndMinutes: staffMeta?.[staff]?.shiftEndMinutes ?? null,
        estimatedUtilisation: shiftMinutes > 0 ? Math.round((estimatedMinutes / shiftMinutes) * 100) : null,
        progress: total ? Math.round((completed / total) * 100) : 0,
      };
    })
    .sort((left, right) => {
      if (left.staff === 'Unallocated') return 1;
      if (right.staff === 'Unallocated') return -1;
      return left.staff.localeCompare(right.staff);
    });
}

function getAssignedStaffDisplayNames(tasks = []) {
  const staffNames = [...new Set(tasks.map((task) => task.staff || 'Unallocated'))];
  const allocatedStaffNames = staffNames.filter((staff) => staff !== 'Unallocated');
  return allocatedStaffNames.length ? allocatedStaffNames : staffNames;
}

function formatMinutesLabel(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return '0m';
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${minutes}m`;
  }

  if (!minutes) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function floorToStep(totalMinutes, stepMinutes) {
  return Math.floor(totalMinutes / stepMinutes) * stepMinutes;
}

function ceilToStep(totalMinutes, stepMinutes) {
  return Math.ceil(totalMinutes / stepMinutes) * stepMinutes;
}

function formatAssignedStaffLabel(tasks = []) {
  const displayNames = getAssignedStaffDisplayNames(tasks);

  if (!displayNames.length) {
    return 'Unallocated';
  }

  if (displayNames.length === 1) {
    return displayNames[0];
  }

  if (displayNames.length === 2) {
    return `${displayNames[0]} + ${displayNames[1]}`;
  }

  return `${displayNames[0]} + ${displayNames.length - 1} more`;
}

function formatGroupStatusLabel(tasks = []) {
  if (!tasks.length) {
    return 'On board';
  }

  const statuses = tasks.map((task) => normalizeTaskStatus(task.status));

  if (statuses.every((status) => status === 'completed')) {
    return 'Completed';
  }

  if (statuses.some((status) => status === 'in-progress')) {
    return 'In progress';
  }

  if (statuses.some((status) => status === 'carried-forward')) {
    return 'Carried forward';
  }

  if (statuses.some((status) => status === 'overdue')) {
    return 'Overdue';
  }

  return 'On board';
}

function getGroupProgress(tasks = []) {
  const total = tasks.length;
  const completed = tasks.filter((task) => normalizeTaskStatus(task.status) === 'completed').length;
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

function formatGroupSummaryLabel(tasks = []) {
  const statusLabel = formatGroupStatusLabel(tasks);
  const staffLabel = formatAssignedStaffLabel(tasks);

  if (statusLabel === 'On board' && staffLabel && staffLabel !== 'Unallocated') {
    return staffLabel;
  }

  return `${statusLabel} ${staffLabel}`;
}

function isGroupUnallocated(tasks = []) {
  if (!tasks.length) {
    return true;
  }

  return !tasks.some((task) => task.staff && task.staff !== 'Unallocated');
}

function getSingleAssignedStaff(tasks = []) {
  const assignedStaff = [...new Set(tasks.map((task) => task.staff).filter((staff) => staff && staff !== 'Unallocated'))];
  return assignedStaff.length === 1 ? assignedStaff[0] : '';
}

function getRecommendedStaffSummary(tasks = []) {
  const tally = new Map();

  tasks.forEach((task) => {
    if (!task?.recommendedStaff) {
      return;
    }

    const current = tally.get(task.recommendedStaff) ?? {
      staff: task.recommendedStaff,
      taskCount: 0,
      latestCompletedAt: null,
    };
    current.taskCount += 1;

    if (task.recommendationLatestCompletedAt && (!current.latestCompletedAt || new Date(task.recommendationLatestCompletedAt).getTime() > new Date(current.latestCompletedAt).getTime())) {
      current.latestCompletedAt = task.recommendationLatestCompletedAt;
    }

    tally.set(task.recommendedStaff, current);
  });

  const winner = [...tally.values()].sort((left, right) => {
    if (right.taskCount !== left.taskCount) {
      return right.taskCount - left.taskCount;
    }

    const rightTime = right.latestCompletedAt ? new Date(right.latestCompletedAt).getTime() : 0;
    const leftTime = left.latestCompletedAt ? new Date(left.latestCompletedAt).getTime() : 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return String(left.staff).localeCompare(String(right.staff));
  })[0] ?? null;

  if (!winner) {
    return null;
  }

  return {
    staff: winner.staff,
    taskCount: winner.taskCount,
    recommendedTaskCount: tasks.filter((task) => task?.recommendedStaff).length,
    totalTaskCount: tasks.length,
  };
}

function getEffectiveRecommendedStaff(task, options = {}) {
  const { alwaysShowRecommendation = false } = options;

  if (task?.recommendedStaff) {
    return task.recommendedStaff;
  }

  if (alwaysShowRecommendation && task?.staff && task.staff !== 'Unallocated') {
    return task.staff;
  }

  return '';
}

function formatRequirement(task) {
  if (task.required) {
    return task.required;
  }
  if (task.photoRequired) {
    return 'Photo required';
  }
  if (task.commentRequired) {
    return 'Comment required';
  }
  return 'Standard';
}

function formatEstimatedMinutes(task) {
  if (!task.estimatedMinutes) {
    return '—';
  }
  return `${task.estimatedMinutes} min`;
}

function formatCadenceMode(task) {
  if (!task.frequency || String(task.frequency).toLowerCase() !== 'weekly') {
    return '—';
  }

  return task.cadenceMode ?? 'Anchored';
}

function formatDesignatedDay(task) {
  if (!task.frequency || String(task.frequency).toLowerCase() !== 'weekly') {
    return '—';
  }

  return task.designatedDay ?? '—';
}

function formatTaskNumber(task) {
  if (task.instanceCode) {
    return task.instanceCode;
  }
  if (typeof task.displayOrder === 'number') {
    return String(task.displayOrder).padStart(3, '0');
  }
  if (task.jobOrderNumber) {
    return String(task.jobOrderNumber).padStart(3, '0');
  }
  return '—';
}

function parseDemoDate(value) {
  if (!value || value === '—' || value === 'As triggered') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function diffInDays(targetDate, baseDate = new Date()) {
  if (!targetDate) {
    return null;
  }

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const base = new Date(baseDate);
  base.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - base.getTime()) / DAY_IN_MS);
}

function parseBoardDayDate(dayKey) {
  if (!dayKey) {
    return new Date();
  }

  return new Date(`${dayKey}T00:00:00+10:00`);
}

function formatLastCompletedAge(value, baseDate = new Date()) {
  const days = diffInDays(parseDemoDate(value), baseDate);

  if (days === null) {
    return 'Not completed yet';
  }

  if (days === 0) {
    return 'Done today';
  }

  if (days < 0) {
    return `${Math.abs(days)} days ago`;
  }

  return `In ${days} days`;
}

function formatNextScheduleTiming(value, baseDate = new Date()) {
  const days = diffInDays(parseDemoDate(value), baseDate);

  if (days === null) {
    return 'Triggered manually';
  }

  if (days === 0) {
    return 'Due today';
  }

  if (days < 0) {
    return `${Math.abs(days)} days overdue`;
  }

  return `Due in ${days} days`;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getStandbySuitability(task, baseDate = new Date()) {
  const nextDueDate = parseDemoDate(task.suggestedDue);
  const lastCompletedDate = parseDemoDate(task.lastCompleted);
  const daysUntilDue = diffInDays(nextDueDate, baseDate);
  const daysSinceDone = lastCompletedDate
    ? Math.max(0, -diffInDays(lastCompletedDate, baseDate))
    : 999;
  const estimatedMinutes = Number(task.estimatedMinutes) || 0;

  let urgencyScore = 20;
  if (daysUntilDue === null) {
    urgencyScore = 45;
  } else if (daysUntilDue <= 0) {
    urgencyScore = 100;
  } else if (daysUntilDue <= 2) {
    urgencyScore = 85;
  } else if (daysUntilDue <= 7) {
    urgencyScore = 65;
  } else if (daysUntilDue <= 14) {
    urgencyScore = 45;
  } else {
    urgencyScore = 20;
  }

  let staleScore = 35;
  if (!lastCompletedDate) {
    staleScore = 100;
  } else if (daysSinceDone >= 30) {
    staleScore = 90;
  } else if (daysSinceDone >= 14) {
    staleScore = 70;
  } else if (daysSinceDone >= 7) {
    staleScore = 50;
  } else if (daysSinceDone >= 3) {
    staleScore = 30;
  } else {
    staleScore = 10;
  }

  let effortScore = 60;
  if (!estimatedMinutes) {
    effortScore = 50;
  } else if (estimatedMinutes <= 10) {
    effortScore = 100;
  } else if (estimatedMinutes <= 20) {
    effortScore = 80;
  } else if (estimatedMinutes <= 30) {
    effortScore = 60;
  } else if (estimatedMinutes <= 45) {
    effortScore = 40;
  } else {
    effortScore = 20;
  }

  const score = clampScore((urgencyScore * 0.45) + (staleScore * 0.35) + (effortScore * 0.20));
  const label = score >= 80
    ? 'Strong standby'
    : score >= 60
      ? 'Good standby'
      : score >= 40
        ? 'Possible standby'
        : 'Low standby';

  return {
    score,
    label,
    urgencyScore,
    staleScore,
    effortScore,
    daysUntilDue,
    daysSinceDone,
  };
}

function formatDeployTimestamp(value, timeZone = DEFAULT_APP_TIME_ZONE) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return getTimeZoneFormatter('en-AU', timeZone, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatBoardDateLabel(dayKey, timeZone = DEFAULT_APP_TIME_ZONE) {
  if (!dayKey) {
    return 'No board day selected';
  }

  const date = new Date(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return dayKey;
  }

  return getTimeZoneFormatter('en-AU', timeZone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date).replace(',', '');
}

function getTodayBoardDayKey(timeZone = DEFAULT_APP_TIME_ZONE) {
  return formatBoardDayKeyForTimeZone(new Date(), timeZone);
}

function isFutureBoardDay(dayKey, boardDays, timeZone = DEFAULT_APP_TIME_ZONE) {
  if (!dayKey || !Array.isArray(boardDays) || !boardDays.length) {
    return false;
  }

  const todayKey = getTodayBoardDayKey(timeZone);
  const todayIndex = boardDays.indexOf(todayKey);
  const activeIndex = boardDays.indexOf(dayKey);

  if (todayIndex === -1 || activeIndex === -1) {
    return false;
  }

  return activeIndex > todayIndex;
}

function getLastCompletedSortValue(task) {
  const days = diffInDays(parseDemoDate(task.lastCompleted));

  if (days === null) {
    return -1;
  }

  return -days;
}

function getUnscheduledFacilityTasks(assignment, options = {}) {
  const scheduledTemplateIds = new Set(assignment.tasks.map((task) => task.templateId).filter(Boolean));
  const baseDate = options.baseDate ?? new Date();
  const facilityName = getFacilityDisplayName(assignment.location);
  const allTaskTemplates = Array.isArray(options.taskTemplates) && options.taskTemplates.length
    ? options.taskTemplates
    : demoTaskCardTemplates;

  return allTaskTemplates
    .filter((task) => getFacilityDisplayName(task.facility) === facilityName && !scheduledTemplateIds.has(task.templateId))
    .map((task) => ({
      ...task,
      standbySuitability: getStandbySuitability(task, baseDate),
    }))
    .sort((a, b) => {
      const scoreDiff = (b.standbySuitability?.score ?? 0) - (a.standbySuitability?.score ?? 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      const lastCompletedDiff = getLastCompletedSortValue(b) - getLastCompletedSortValue(a);
      if (lastCompletedDiff !== 0) {
        return lastCompletedDiff;
      }
      if (a.zone !== b.zone) {
        return a.zone.localeCompare(b.zone);
      }
      if (a.taskGroup !== b.taskGroup) {
        return a.taskGroup.localeCompare(b.taskGroup);
      }
      return a.title.localeCompare(b.title);
    });
}

function normalizeFutureTaskStatus(status) {
  if (['completed', 'in-progress', 'carried-forward', 'overdue'].includes(status)) {
    return 'scheduled';
  }

  return status;
}

function buildDashboardSummary(board, managerSummary) {
  const cards = Array.isArray(board?.cards) ? board.cards : [];
  const totalTasks = Number.isFinite(managerSummary?.totalTasks) ? managerSummary.totalTasks : cards.length;
  const completedTasks = Number.isFinite(managerSummary?.completedTasks)
    ? managerSummary.completedTasks
    : cards.filter((card) => card.status === 'completed').length;
  const pendingTasks = Math.max(0, totalTasks - completedTasks);
  const photoVerifications = cards.filter((card) => {
    const required = String(card.required ?? '').toLowerCase();
    return required.includes('photo');
  }).length;

  return {
    completionRate: Number.isFinite(managerSummary?.completionRate)
      ? managerSummary.completionRate
      : (totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0),
    completedTasks,
    pendingTasks,
    photoVerifications,
  };
}

function buildOperationalCards(board) {
  const automationSummary = board?.automationSummary ?? {};
  const validationSummary = board?.validationSummary ?? {};
  const cards = [];

  if (typeof automationSummary.generated === 'number') {
    cards.push({
      title: 'Generated tasks',
      value: automationSummary.generated,
      note: 'Upcoming task instances created by runtime maintenance',
      tone: automationSummary.generated > 0 ? 'green' : 'slate',
    });
  }

  if (typeof automationSummary.changed === 'number') {
    cards.push({
      title: 'Maintenance changes',
      value: automationSummary.changed,
      note: 'Runtime maintenance updates applied',
      tone: automationSummary.changed > 0 ? 'amber' : 'green',
    });
  }

  if (typeof validationSummary.issueCount === 'number') {
    cards.push({
      title: 'Validation issues',
      value: validationSummary.issueCount,
      note: 'Recurrence or sequencing issues detected in live data',
      tone: validationSummary.issueCount > 0 ? 'red' : 'green',
    });
  }

  return cards;
}

const FACILITY_BOARD_ORDER = ['Cienna', 'Boheme', 'Best Stays'];

function sortAssignmentsByFacilityOrder(assignments = []) {
  return [...assignments].sort((left, right) => {
    const leftIndex = FACILITY_BOARD_ORDER.indexOf(left.location);
    const rightIndex = FACILITY_BOARD_ORDER.indexOf(right.location);
    const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    if (safeLeft !== safeRight) {
      return safeLeft - safeRight;
    }

    return String(left.location || '').localeCompare(String(right.location || ''));
  });
}

function buildAssignmentPresentationData(assignments, options = {}) {
  const showProgress = options.showProgress !== false;
  const forceScheduledStatuses = options.forceScheduledStatuses === true;
  const baseDate = options.baseDate ?? new Date();
  const taskTemplates = options.taskTemplates ?? demoTaskCardTemplates;
  const dashboardStaffOrderSettings = options.dashboardStaffOrderSettings ?? { daily: {}, periodic: {} };

  return sortAssignmentsByFacilityOrder(assignments).map((assignment) => {
    const tasks = forceScheduledStatuses
      ? assignment.tasks.map((task) => ({
          ...task,
          status: normalizeFutureTaskStatus(task.status),
        }))
      : assignment.tasks;

    return {
      ...assignment,
      location: getFacilityDisplayName(assignment.location),
      tasks,
      showProgress,
      taskGroups: groupAssignmentTasks(tasks, {
        dailyStaffOrder: dashboardStaffOrderSettings?.daily?.[getFacilityDisplayName(assignment.location)] ?? [],
        periodicStaffOrder: dashboardStaffOrderSettings?.periodic?.[getFacilityDisplayName(assignment.location)] ?? [],
      }),
      unscheduledTasks: getUnscheduledFacilityTasks({ ...assignment, tasks }, { baseDate, taskTemplates }),
    };
  });
}

function buildDashboardAssignmentsFromBoard(board, selectedDay) {
  if (!board?.cards?.length || !selectedDay) {
    return [];
  }

  const dayCards = board.cards.filter((card) => card.day === selectedDay);
  const facilityMap = new Map();

  dayCards.forEach((card) => {
    const facilityKey = card.facility || 'Unassigned facility';
    if (!facilityMap.has(facilityKey)) {
      const shiftMeta = board.staffMeta?.[card.staff];
      facilityMap.set(facilityKey, {
        id: facilityKey.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        location: facilityKey,
        shift: shiftMeta?.shiftLabel ?? (card.staff === 'Unallocated' ? 'Board / unallocated' : card.staff),
        sourceDay: selectedDay,
        sourceCards: [],
        rosteredStaff: [],
      });
    }

    const facilityEntry = facilityMap.get(facilityKey);
    facilityEntry.sourceCards.push(card);

    if (card.staff && card.staff !== 'Unallocated' && !facilityEntry.rosteredStaff.some((entry) => entry.name === card.staff)) {
      const currentShiftMeta = board.staffMeta?.[card.staff];
      facilityEntry.rosteredStaff.push({
        name: card.staff,
        shiftWindow: currentShiftMeta?.shiftWindow || 'Flexible shift',
      });
    }
  });

  return sortAssignmentsByFacilityOrder(Array.from(facilityMap.values()).map((assignment, index) => {
    const tasks = assignment.sourceCards
      .sort((a, b) => a.jobOrder - b.jobOrder)
      .map((card) => ({
        id: card.id,
        updatedAt: card.updatedAt ?? null,
        title: card.title,
        templateId: card.templateId,
        instanceCode: card.instanceCode,
        designatedDay: card.designatedDay,
        zone: card.zone,
        taskGroup: card.groupName || card.taskGroup,
        frequency: card.frequency,
        cadenceMode: card.cadenceMode,
        frequencyType: card.frequencyType,
        estimatedMinutes: card.estimatedMinutes,
        notes: card.notes,
        required: card.required,
        jobOrderNumber: card.jobOrder,
        status: formatBoardStatusForDashboard(card.status),
        score: card.score ?? null,
        auditScore: card.auditScore ?? null,
        photoRequired: String(card.required || '').toLowerCase().includes('photo'),
        commentRequired: Boolean(card.issueNote),
        displayOrder: card.jobOrder,
        staff: card.staff || 'Unallocated',
        recommendedStaff: card.recommendedStaff ?? null,
        recommendationReason: card.recommendationReason ?? null,
        recommendationCount: card.recommendationCount ?? 0,
        recommendationSampleSize: card.recommendationSampleSize ?? 0,
        recommendationLatestCompletedAt: card.recommendationLatestCompletedAt ?? null,
      }));

    const completed = tasks.filter((task) => task.status === 'completed').length;

    return {
      id: assignment.id || `board-${index + 1}`,
      location: assignment.location,
      shift: assignment.shift,
      rosteredStaff: assignment.rosteredStaff ?? [],
      tasks,
      stats: {
        completed,
        total: tasks.length,
      },
    };
  }));
}

function applyAssignmentResultToBoard(board, payload, fallbackStaff) {
  if (!board?.cards?.length) {
    return board;
  }

  const updates = new Map(
    (payload?.updatedCards ?? []).map((card) => [card.id, card]),
  );

  if (!updates.size) {
    return board;
  }

  return {
    ...board,
    cards: board.cards.map((card) => {
      const update = updates.get(card.id);
      if (!update) {
        return card;
      }

      return {
        ...card,
        staff: update.staff ?? fallbackStaff ?? card.staff,
        status: update.status ?? card.status,
        updatedAt: update.updatedAt ?? card.updatedAt,
      };
    }),
  };
}

function formatBoardStatusForDashboard(status) {
  switch (status) {
    case 'in_progress':
      return 'in-progress';
    case 'carried_forward':
      return 'carried-forward';
    default:
      return status;
  }
}

const FacilityBoardCard = memo(function FacilityBoardCard({ assignment, activeBoardDay, boardView, staffMeta, onOpenTaskCard, onOpenAssignStaff, onApplySuggestedStaff, assigningGroupKey, suggestingTaskKey, acceptedSuggestedTaskIds, onReorderSectionStaff }) {
  const staffGroups = useMemo(() => groupTasksByStaff(assignment.tasks, staffMeta), [assignment.tasks, staffMeta]);
  const [draggingStaff, setDraggingStaff] = useState(null);
  const positionedStaffGroups = staffGroups.filter((staffGroup) => Number.isFinite(staffGroup.shiftStartMinutes) && Number.isFinite(staffGroup.shiftEndMinutes) && staffGroup.shiftEndMinutes > staffGroup.shiftStartMinutes);
  const unpositionedStaffGroups = staffGroups.filter((staffGroup) => !(Number.isFinite(staffGroup.shiftStartMinutes) && Number.isFinite(staffGroup.shiftEndMinutes) && staffGroup.shiftEndMinutes > staffGroup.shiftStartMinutes));
  const defaultEarliestMinute = 360;
  const defaultLatestMinute = 1080;
  const rawEarliestShiftMinute = positionedStaffGroups.length ? Math.min(...positionedStaffGroups.map((staffGroup) => staffGroup.shiftStartMinutes)) : defaultEarliestMinute;
  const rawLatestShiftMinute = positionedStaffGroups.length ? Math.max(...positionedStaffGroups.map((staffGroup) => staffGroup.shiftEndMinutes)) : defaultLatestMinute;
  const timelineStepMinutes = rawLatestShiftMinute - rawEarliestShiftMinute <= 360 ? 15 : rawLatestShiftMinute - rawEarliestShiftMinute <= 720 ? 30 : 60;
  const timelineStartMinute = Math.min(defaultEarliestMinute, floorToStep(rawEarliestShiftMinute, timelineStepMinutes));
  const timelineEndMinute = Math.max(defaultLatestMinute, ceilToStep(rawLatestShiftMinute, timelineStepMinutes));
  const timelineRangeMinutes = Math.max(60, timelineEndMinute - timelineStartMinute);
  const timelinePixelsPerMinute = timelineRangeMinutes <= 360 ? 1.2 : timelineRangeMinutes <= 720 ? 0.95 : 0.775;
  const timelineHeight = Math.max(210, Math.round(timelineRangeMinutes * timelinePixelsPerMinute));
  const timelineTickHeight = Math.max(10, Math.round(timelineStepMinutes * timelinePixelsPerMinute));
  const timelineMarks = Array.from({ length: Math.floor(timelineRangeMinutes / timelineStepMinutes) + 1 }, (_, index) => timelineStartMinute + (index * timelineStepMinutes));

  function renderStaffNameTags(names, options = {}) {
    const { groupKey = 'staff', interactive = false, tasks = [], nowrap = false } = options;
    const safeNames = names.filter(Boolean);

    if (!safeNames.length) {
      return <span className="button slim staff-tag secondary">Unallocated</span>;
    }

    const buttonProps = interactive
      ? {
          type: 'button',
          onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenAssignStaff(tasks);
          },
        }
      : {};

    const Tag = interactive ? 'button' : 'span';

    return (
      <span className="task-group-progress-row" style={{ gap: 6, alignItems: 'center', flexWrap: nowrap ? 'nowrap' : 'wrap' }}>
        {safeNames.map((staffName) => (
          <Tag
            key={`${groupKey}-${staffName}`}
            {...buttonProps}
            className={`button slim staff-tag ${staffName === 'Unallocated' ? 'secondary' : 'primary'} ${staffName !== 'Unallocated' ? `staff-theme-${slugifyThemeKey(staffName)}` : ''}`}
          >
            {assigningGroupKey === groupKey && interactive ? 'Assigning…' : staffName}
          </Tag>
        ))}
      </span>
    );
  }

  function renderTaskAssignmentDisplay(task, suffix = 'task', options = {}) {
    const { alwaysShowRecommendation = false, showStatusInfo = false } = options;
    const effectiveRecommendedStaff = getEffectiveRecommendedStaff(task, { alwaysShowRecommendation });
    const displayStaff = task.staff && task.staff !== 'Unallocated'
      ? task.staff
      : effectiveRecommendedStaff || 'Unallocated';
    const isScheduledRecommendation = Boolean(acceptedSuggestedTaskIds?.[task.id]);
    const isSaving = suggestingTaskKey === task.id;
    const canApplySuggested = Boolean(effectiveRecommendedStaff) && !isScheduledRecommendation && !isSaving && onApplySuggestedStaff;
    const BadgeTag = canApplySuggested ? 'button' : 'span';

    const gradeLabel = formatTaskGradeLabel(task.score ?? task.auditScore);
    const completionBadge = getTaskCompletionBadge(task);

    return (
      <span className="task-assignment-display">
        {showStatusInfo ? <span className={`${statusClass(completionBadge.tone)} task-inline-status task-inline-status-info`}>{completionBadge.label}</span> : null}
        {showStatusInfo && gradeLabel ? <span className="flag task-inline-flag task-grade-flag">{gradeLabel}</span> : null}
        <BadgeTag
          type={canApplySuggested ? 'button' : undefined}
          className={`button slim staff-tag ${displayStaff === 'Unallocated' ? 'secondary' : 'primary'} ${displayStaff !== 'Unallocated' ? `staff-theme-${slugifyThemeKey(displayStaff)}` : ''} ${canApplySuggested ? 'staff-tag-suggested-pulse' : ''}`}
          onClick={canApplySuggested ? (event) => {
            event.preventDefault();
            event.stopPropagation();
            onApplySuggestedStaff(task);
          } : undefined}
        >
          {isSaving ? 'Saving…' : displayStaff}
        </BadgeTag>
      </span>
    );
  }

  function renderTaskEditButton(task) {
    if (!task?.templateId) {
      return null;
    }

    return (
      <div className="task-disclosure-footer">
        <Link
          className="button secondary slim task-disclosure-edit-button"
          href={`/admin/task-cards?templateId=${encodeURIComponent(task.templateId)}`}
        >
          Edit
        </Link>
      </div>
    );
  }

  function handleSectionStaffDrop(sectionKey, targetStaffName) {
    if (!draggingStaff || !targetStaffName || draggingStaff === targetStaffName || !onReorderSectionStaff) {
      setDraggingStaff(null);
      return;
    }

    const currentOrder = sectionKey === 'daily'
      ? assignment.taskGroups.dailyStaffOrder
      : assignment.taskGroups.periodicStaffOrder;
    const nextOrder = currentOrder.filter((staffName) => staffName !== draggingStaff);
    const targetIndex = nextOrder.indexOf(targetStaffName);
    if (targetIndex === -1) {
      setDraggingStaff(null);
      return;
    }

    nextOrder.splice(targetIndex, 0, draggingStaff);
    onReorderSectionStaff(assignment.location, sectionKey, nextOrder);
    setDraggingStaff(null);
  }

  function renderInlineProgressBar(tasks, key) {
    const progress = getGroupProgress(tasks);
    return (
      <div className="task-group-progress-stack" key={key}>
        <div className="task-group-progress"><span style={{ width: `${progress.percent}%` }} /></div>
        <span className="task-group-progress-label">{progress.completed}/{progress.total} complete</span>
      </div>
    );
  }

  function renderGroupSummaryControl(tasks, groupKey, options = {}) {
    const statusLabel = formatGroupStatusLabel(tasks);
    const staffLabel = formatAssignedStaffLabel(tasks);
    const displayStaffNames = options.displayStaffNames ?? getAssignedStaffDisplayNames(tasks);
    const showStatusLabel = !(statusLabel === 'On board' && staffLabel && staffLabel !== 'Unallocated');
    const reorderSectionKey = options.reorderSectionKey ?? '';

    const draggableTagRenderer = reorderSectionKey && onReorderSectionStaff
      ? (names) => (
          <span className="task-group-progress-row staff-tag-sortable-row" style={{ gap: 6, alignItems: 'center', flexWrap: names.length <= 2 ? 'nowrap' : 'wrap' }}>
            {names.map((staffName) => (
              <button
                key={`${groupKey}-${staffName}`}
                type="button"
                draggable
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (onOpenAssignStaff) {
                    onOpenAssignStaff(tasks);
                  }
                }}
                onDragStart={(event) => {
                  setDraggingStaff(staffName);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', staffName);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleSectionStaffDrop(reorderSectionKey, staffName);
                }}
                onDragEnd={() => setDraggingStaff(null)}
                className={`button slim staff-tag ${staffName === 'Unallocated' ? 'secondary' : 'primary'} ${staffName !== 'Unallocated' ? `staff-theme-${slugifyThemeKey(staffName)}` : ''} ${draggingStaff === staffName ? 'staff-tag-dragging' : ''}`}
                title="Drag to reorder staff"
              >
                {staffName}
              </button>
            ))}
          </span>
        )
      : null;

    if (onOpenAssignStaff) {
      return (
        <span className="task-group-progress-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {showStatusLabel ? <span className="task-group-progress-label">{statusLabel}</span> : null}
          {draggableTagRenderer
            ? draggableTagRenderer(displayStaffNames)
            : renderStaffNameTags(displayStaffNames, {
                groupKey,
                interactive: true,
                tasks,
                nowrap: displayStaffNames.length <= 2,
              })}
        </span>
      );
    }

    if (displayStaffNames.length) {
      return (
        <span className="task-group-progress-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {showStatusLabel ? <span className="task-group-progress-label">{statusLabel}</span> : null}
          {draggableTagRenderer
            ? draggableTagRenderer(displayStaffNames)
            : renderStaffNameTags(displayStaffNames, {
                groupKey,
                interactive: false,
                nowrap: displayStaffNames.length <= 2,
              })}
        </span>
      );
    }

    return <span className="task-group-progress-label">{formatGroupSummaryLabel(tasks)}</span>;
  }

  const facilityLayout = assignment.location;
  const dailyTasks = assignment.tasks.filter((task) => !task.frequency || String(task.frequency).toLowerCase() === 'daily');
  const periodicTasks = assignment.tasks.filter((task) => task.frequency && String(task.frequency).toLowerCase() !== 'daily');
  const allZoneTasks = buildZoneTaskCollection(assignment.tasks);
  const dailyZoneTasks = buildZoneTaskCollection(dailyTasks, assignment.taskGroups.dailyStaffOrder);
  const periodicZoneTasks = buildZoneTaskCollection(periodicTasks, assignment.taskGroups.periodicStaffOrder);
  const bohemeDailyTasks = sortTasksByAssignedThenTaskNumber(dailyTasks, assignment.taskGroups.dailyStaffOrder).map((task, index) => ({ ...task, displayOrder: index + 1 }));
  const bohemePeriodicTasks = sortTasksByAssignedThenTaskNumber(periodicTasks, assignment.taskGroups.periodicStaffOrder).map((task, index) => ({ ...task, displayOrder: index + 1 }));

  function makeTaskCardDetails(task, statusOverride = null) {
    return {
      ...task,
      facility: assignment.location,
      shift: assignment.shift,
      assignmentId: assignment.id,
      ...(statusOverride ? { status: statusOverride } : {}),
    };
  }

  function renderScheduledTaskDisclosure(task, options = {}) {
    const {
      suffix = 'task',
      subtitle = '',
      showGroupField = true,
      showZoneField = true,
      showStatusBadge = true,
      alwaysShowRecommendation = false,
    } = options;
    const taskCardDetails = makeTaskCardDetails(task);

    return (
      <details className="task-disclosure task-disclosure-compact" key={`${suffix}-${task.id}`}>
        <summary className="task-row task-row-disclosure task-row-disclosure-compact">
          <div className="task-inline-main">
            <div className="task-inline-copy">
              <strong>{task.title}</strong>
              {subtitle ? <span className="muted">{subtitle}</span> : null}
            </div>
          </div>
          <div className="task-disclosure-summary-right task-disclosure-summary-right-compact">
            {task.photoRequired && <span className="flag task-inline-flag">Photo</span>}
            {task.commentRequired && <span className="flag task-inline-flag">Comment</span>}
            <span className="task-inline-staff-tags">{renderTaskAssignmentDisplay(task, `${suffix}-assignment`, {
              alwaysShowRecommendation,
              showStatusInfo: showStatusBadge && shouldShowTaskStatusBadge(task.status),
            })}</span>
            <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
          </div>
        </summary>
        <div className="task-disclosure-body">
          <div className="task-detail-grid">
            <div>
              <span className="muted">Task #</span>
              <strong>{String(task.displayOrder).padStart(3, '0')}</strong>
            </div>
            {showGroupField ? (
              <div>
                <span className="muted">Group</span>
                <strong>{task.taskGroup}</strong>
              </div>
            ) : null}
            {showZoneField ? (
              <div>
                <span className="muted">Zone</span>
                <strong>{task.zone}</strong>
              </div>
            ) : null}
            <div>
              <span className="muted">Status</span>
              <strong>{formatTaskLabel(task.status)}</strong>
            </div>
            <div>
              <span className="muted">Assigned</span>
              {renderTaskAssignmentDisplay(task, `${suffix}-detail`, { alwaysShowRecommendation, showStatusInfo: false })}
            </div>
          </div>
          {renderTaskEditButton(task)}
        </div>
      </details>
    );
  }

  function renderZoneOnlySection(title, subtitle, zoneEntries, sectionKey) {
    const allTasks = zoneEntries.flatMap((zone) => zone.tasks);
    return (
      <details className="task-group-disclosure facility-section facility-section-daily" open>
        <summary className="task-group-summary">
          <div className="task-group-summary-copy">
            <strong>{title}</strong>
            <div className="muted">{subtitle}</div>
            {renderInlineProgressBar(allTasks, `${assignment.id}-${sectionKey}-progress`)}
            <div className="task-group-progress-row">
              {renderGroupSummaryControl(allTasks, `${assignment.id}-${sectionKey}-summary`)}
            </div>
          </div>
          <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="task-group-body">
          {zoneEntries.map((zone) => (
            <details className="task-disclosure" key={`${assignment.id}-${sectionKey}-${zone.zone}`}>
              <summary className="task-row task-row-disclosure zone-summary-row">
                <div className="zone-summary-left">
                  <strong>{zone.zone}</strong>
                  {renderInlineProgressBar(zone.tasks, `${assignment.id}-${sectionKey}-${zone.zone}-progress`)}
                </div>
                <div className="task-disclosure-summary-right zone-summary-right">
                  {renderGroupSummaryControl(zone.tasks, `${assignment.id}-${sectionKey}-${zone.zone}`)}
                  <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
                </div>
              </summary>
              <div className="task-group-body">
                {zone.tasks.map((task) => renderScheduledTaskDisclosure(task, {
                  suffix: `${sectionKey}-${zone.zone}`,
                  subtitle: task.frequency && String(task.frequency).toLowerCase() !== 'daily' ? task.taskGroup : '',
                  showZoneField: false,
                  showStatusBadge: true,
                  alwaysShowRecommendation: true,
                }))}
              </div>
            </details>
          ))}
        </div>
      </details>
    );
  }

  function renderFlatSection(title, subtitle, tasks, sectionKey) {
    return (
      <details className={`task-group-disclosure facility-section ${sectionKey === 'daily' ? 'facility-section-daily' : 'facility-section-periodic'}`} open>
        <summary className="task-group-summary">
          <div className="task-group-summary-copy">
            <strong>{title}</strong>
            <div className="muted">{subtitle}</div>
            {renderInlineProgressBar(tasks, `${assignment.id}-${sectionKey}-progress`)}
            <div className="task-group-progress-row">
              {renderGroupSummaryControl(tasks, `${assignment.id}-${sectionKey}-summary`, {
                reorderSectionKey: sectionKey,
                displayStaffNames: sectionKey === 'daily' ? assignment.taskGroups.dailyStaffOrder : assignment.taskGroups.periodicStaffOrder,
              })}
            </div>
          </div>
          <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="task-group-body">
          {tasks.length ? tasks.map((task) => renderScheduledTaskDisclosure(task, {
            suffix: `${sectionKey}-flat`,
            subtitle: `${task.zone} · ${task.taskGroup}`,
            showGroupField: true,
            showZoneField: true,
            showStatusBadge: true,
            alwaysShowRecommendation: true,
          })) : (
            <div className="task-row unscheduled-task-empty">
              <div>
                <strong>No {sectionKey} tasks in this facility run</strong>
                <div className="muted">Nothing to compare here for this board day.</div>
              </div>
            </div>
          )}
        </div>
      </details>
    );
  }

  function renderHolidayPreferredSection(title, subtitle, zoneEntries, sectionKey) {
    const allTasks = zoneEntries.flatMap((zone) => zone.tasks);
    return (
      <details className={`task-group-disclosure facility-section ${sectionKey === 'daily' ? 'facility-section-daily' : 'facility-section-periodic'}`} open>
        <summary className="task-group-summary">
          <div className="task-group-summary-copy">
            <strong>{title}</strong>
            <div className="muted">{subtitle}</div>
            {renderInlineProgressBar(allTasks, `${assignment.id}-${sectionKey}-progress`)}
            <div className="task-group-progress-row">
              {renderGroupSummaryControl(allTasks, `${assignment.id}-${sectionKey}-summary`, {
                reorderSectionKey: sectionKey,
                displayStaffNames: sectionKey === 'daily' ? assignment.taskGroups.dailyStaffOrder : assignment.taskGroups.periodicStaffOrder,
              })}
            </div>
          </div>
          <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="task-group-body">
          {zoneEntries.length ? zoneEntries.map((zone) => (
            <details className="task-disclosure" key={`${assignment.id}-${sectionKey}-${zone.zone}`}>
              <summary className="task-row task-row-disclosure zone-summary-row">
                <div className="zone-summary-left">
                  <strong>{zone.zone}</strong>
                  {renderInlineProgressBar(zone.tasks, `${assignment.id}-${sectionKey}-${zone.zone}-progress`)}
                </div>
                <div className="task-disclosure-summary-right zone-summary-right">
                  {renderGroupSummaryControl(zone.tasks, `${assignment.id}-${sectionKey}-${zone.zone}`)}
                  <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
                </div>
              </summary>
              <div className="task-group-body">
                {zone.tasks.map((task) => renderScheduledTaskDisclosure(task, {
                  suffix: `${sectionKey}-${zone.zone}`,
                  subtitle: task.taskGroup,
                  showZoneField: false,
                  showStatusBadge: true,
                  alwaysShowRecommendation: true,
                }))}
              </div>
            </details>
          )) : (
            <div className="task-row unscheduled-task-empty">
              <div>
                <strong>No {sectionKey} tasks in this facility run</strong>
                <div className="muted">Nothing to compare here for this board day.</div>
              </div>
            </div>
          )}
        </div>
      </details>
    );
  }

  return (
    <div className={`card facility-board-card facility-theme-${slugifyThemeKey(assignment.location)}`}>
      <div className="facility-card-header">
        <Link className="button secondary facility-card-title-button" href={`/facility-board/${assignment.id}?day=${activeBoardDay}&view=staff`}>
          {assignment.location}
        </Link>
        {assignment.rosteredStaff?.length ? (
          <div className="facility-card-roster">
            {assignment.rosteredStaff.map((staffEntry) => (
              <div className="facility-card-roster-item" key={`${assignment.id}-${staffEntry.name}`}>
                <span className={`button slim staff-tag primary staff-theme-${slugifyThemeKey(staffEntry.name)}`}>{staffEntry.name}</span>
                <span className="muted">{staffEntry.shiftWindow}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="task-list task-list-nested">
        {boardView === 'staff' ? (
          <div className="dashboard-staff-timeline" style={{ '--dashboard-staff-height': `${timelineHeight}px`, '--dashboard-staff-step-height': `${timelineTickHeight}px` }}>
            <div className="dashboard-staff-axis">
              <div className="dashboard-staff-axis-inner">
                {timelineMarks.map((minuteMark) => {
                  const topOffset = ((minuteMark - timelineStartMinute) / timelineRangeMinutes) * timelineHeight;
                  const isHourMark = minuteMark % 60 === 0;
                  const hours24 = Math.floor(minuteMark / 60);
                  const minutes = minuteMark % 60;
                  const suffix = hours24 >= 12 ? 'pm' : 'am';
                  const hours12 = hours24 % 12 || 12;
                  return (
                    <div className={`dashboard-staff-tick ${isHourMark ? 'is-hour' : 'is-half-hour'}`} key={`${assignment.id}-${minuteMark}`} style={{ top: `${topOffset}px` }}>
                      <span>{isHourMark || timelineStepMinutes < 30 ? `${hours12}:${String(minutes).padStart(2, '0')}${suffix}` : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="dashboard-staff-columns">
              {positionedStaffGroups.map((staffGroup) => {
                const topOffset = ((staffGroup.shiftStartMinutes - timelineStartMinute) / timelineRangeMinutes) * timelineHeight;
                const cardHeight = Math.max(120, ((staffGroup.shiftEndMinutes - staffGroup.shiftStartMinutes) / timelineRangeMinutes) * timelineHeight);

                return (
                  <div className="dashboard-staff-column" key={`${assignment.id}-${staffGroup.staff}`}>
                    <div className="dashboard-staff-track" />
                    <article
                      className={`card facility-board-staff-card dashboard-staff-card staff-theme-${slugifyThemeKey(staffGroup.staff)}`}
                      style={{ top: `${topOffset}px`, minHeight: `${cardHeight}px` }}
                    >
                      <div className="facility-board-staff-header">
                        <div>
                          <h3>{staffGroup.staff}</h3>
                          <div className="muted">{staffGroup.shiftWindow}</div>
                          <div className="muted facility-board-staff-time-summary">Shift {formatMinutesLabel(staffGroup.shiftMinutes)}</div>
                        </div>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>

            {unpositionedStaffGroups.length ? (
              <div className="dashboard-staff-unplaced">
                {unpositionedStaffGroups.map((staffGroup) => (
                  <span className={`button slim staff-tag ${staffGroup.staff === 'Unallocated' ? 'secondary' : 'primary'} ${staffGroup.staff !== 'Unallocated' ? `staff-theme-${slugifyThemeKey(staffGroup.staff)}` : ''}`} key={`${assignment.id}-${staffGroup.staff}-unplaced`}>
                    {staffGroup.staff}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {facilityLayout === 'Cienna' ? (
              <>
                {renderHolidayPreferredSection('Daily tasks', 'Comparison view — Facility → Daily tasks → Zone → Task', dailyZoneTasks, 'daily')}
                {renderHolidayPreferredSection('Periodic tasks', 'Comparison view — Facility → Periodic tasks → Zone → Task', periodicZoneTasks, 'periodic')}
              </>
            ) : null}

            {facilityLayout === 'Boheme' ? (
              <>
                {renderFlatSection('Daily tasks', 'Comparison view — Facility → Daily tasks → Task', bohemeDailyTasks, 'daily')}
                {renderFlatSection('Periodic tasks', 'Comparison view — Facility → Periodic tasks → Task', bohemePeriodicTasks, 'periodic')}
              </>
            ) : null}

            {facilityLayout === 'Best Stays' ? renderZoneOnlySection(
              'Today\'s board tasks',
              'Comparison view — Facility → Zone → Task',
              allZoneTasks,
              'all-zones',
            ) : null}
          </>
        )}
      </div>
      <details className="task-group-disclosure unscheduled-facility-disclosure facility-section facility-section-unscheduled">
        <summary className="task-group-summary unscheduled-facility-summary">
          <div className="task-group-summary-copy">
            <strong>Extra tasks</strong>
            <div className="muted">All {assignment.location} tasks not included in this day&apos;s facility board, ranked for spare-time suitability</div>
            <div className="task-group-progress-row unscheduled-facility-meta-row">
              <span className="task-group-progress-label">{assignment.unscheduledTasks.length} tasks</span>
            </div>
          </div>
          <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="task-group-body unscheduled-facility-body">
          {assignment.unscheduledTasks.length ? assignment.unscheduledTasks.map((task) => {
            const taskCardDetails = {
              ...task,
              facility: assignment.location,
              shift: assignment.shift,
              assignmentId: assignment.id,
              status: 'extra task',
            };

            return (
              <details className="task-disclosure task-disclosure-compact unscheduled-task-disclosure" key={`${assignment.id}-${task.templateId}`}>
                <summary className="task-row task-row-disclosure task-row-disclosure-compact unscheduled-task-row">
                  <div className="task-inline-main">
                    <div className="unscheduled-task-copy unscheduled-task-copy-compact">
                      <strong>{task.title}</strong>
                      <span className="muted">{task.zone} · {task.taskGroup}</span>
                    </div>
                  </div>
                  <div className="task-disclosure-summary-right task-disclosure-summary-right-compact">
                    <span className="flag task-inline-flag">{task.standbySuitability?.score ?? 0}</span>
                    <span className="flag task-inline-flag">{task.frequency}</span>
                    <span className="task-disclosure-chevron" aria-hidden="true">⌄</span>
                  </div>
                </summary>
                <div className="task-disclosure-body">
                  <div className="task-detail-grid">
                    <div>
                      <span className="muted">Zone</span>
                      <strong>{task.zone}</strong>
                    </div>
                    <div>
                      <span className="muted">Task group</span>
                      <strong>{task.taskGroup}</strong>
                    </div>
                    <div>
                      <span className="muted">Last done</span>
                      <strong>{formatLastCompletedAge(task.lastCompleted, parseBoardDayDate(activeBoardDay))}</strong>
                    </div>
                    <div>
                      <span className="muted">Next</span>
                      <strong>{formatNextScheduleTiming(task.suggestedDue, parseBoardDayDate(activeBoardDay))}</strong>
                    </div>
                    <div>
                      <span className="muted">Standby</span>
                      <strong>{task.standbySuitability?.score ?? 0}/100 · {task.standbySuitability?.label ?? 'Unrated'}</strong>
                    </div>
                    <div>
                      <span className="muted">Estimated time</span>
                      <strong>{task.estimatedMinutes ?? '—'} min</strong>
                    </div>
                  </div>
                  {renderTaskEditButton(task)}
                </div>
              </details>
            );
          }) : (
            <div className="task-row unscheduled-task-empty">
              <div>
                <strong>Everything for this facility is already on today&apos;s board</strong>
                <div className="muted">No extra facility tasks sitting outside today&apos;s run.</div>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
});

export default function HomePage() {
  const [activeTaskCard, setActiveTaskCard] = useState(null);
  const [activeAssignGroup, setActiveAssignGroup] = useState(null);
  const [assigningGroupKey, setAssigningGroupKey] = useState('');
  const [suggestingTaskKey, setSuggestingTaskKey] = useState('');
  const [acceptedSuggestedTaskIds, setAcceptedSuggestedTaskIds] = useState({});
  const [assignmentError, setAssignmentError] = useState('');
  const [saveState, setSaveState] = useState('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [boardView, setBoardView] = useState('tasks');
  const [selectedBoardDay, setSelectedBoardDay] = useState(null);
  const [dashboardBoard, setDashboardBoard] = useState(null);
  const [dashboardSource, setDashboardSource] = useState(null);
  const [dashboardTimeZone, setDashboardTimeZone] = useState(DEFAULT_APP_TIME_ZONE);
  const [dashboardStaffOrderSettings, setDashboardStaffOrderSettings] = useState({ daily: {}, periodic: {} });
  const [taskLibraryCards, setTaskLibraryCards] = useState(demoTaskCardTemplates);
  const [managerSummary, setManagerSummary] = useState(null);
  const [activeMobileFacilityIndex, setActiveMobileFacilityIndex] = useState(0);
  const assignmentGridRef = useRef(null);
  const pendingAssignmentsRef = useRef(new Map());
  const pendingFlushTimerRef = useRef(null);
  const saveInFlightRef = useRef(null);
  const mutationCounterRef = useRef(0);

  async function loadDashboardBoard() {
    const response = await fetch('/api/dashboard-board', { cache: 'no-store' }).catch(() => null);
    const payload = response && response.ok ? await response.json().catch(() => null) : null;

    if (payload?.board) {
      const boardDays = payload.board?.days ?? [];
      const timeZone = payload.timeZone ?? payload.board?.timeZone ?? DEFAULT_APP_TIME_ZONE;
      const todayBoardDay = getTodayBoardDayKey(timeZone);
      setDashboardBoard(payload.board);
      setDashboardSource(payload.source ?? null);
      setDashboardTimeZone(timeZone);
      setManagerSummary(payload.summary ?? null);
      setSelectedBoardDay((current) => {
        if (current && boardDays.includes(current)) {
          return current;
        }

        const todayIndex = boardDays.indexOf(todayBoardDay);
        if (todayIndex !== -1) {
          return boardDays[todayIndex];
        }

        return boardDays[boardDays.length - 1] ?? null;
      });
    }
  }

  useEffect(() => {
    document.body.classList.toggle('modal-open', Boolean(activeTaskCard));
    return () => document.body.classList.remove('modal-open');
  }, [activeTaskCard]);

  useEffect(() => {
    document.body.classList.toggle('modal-open', Boolean(activeAssignGroup));
    return () => document.body.classList.remove('modal-open');
  }, [activeAssignGroup]);

  useEffect(() => {
    let cancelled = false;

    loadDashboardBoard().catch(() => {});
    fetch('/api/dashboard-staff-order', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!cancelled && payload?.settings) {
          setDashboardStaffOrderSettings(payload.settings);
        }
      })
      .catch(() => {});

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadDashboardBoard().catch(() => {});
      }
    }, ADMIN_BOARD_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => () => {
    if (pendingFlushTimerRef.current) {
      clearTimeout(pendingFlushTimerRef.current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/task-library', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.cards) && payload.cards.length) {
          setTaskLibraryCards(payload.cards);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const liveRuntimeData = dashboardSource === 'prisma';
  const boardDays = liveRuntimeData ? (dashboardBoard?.days ?? []) : [];
  const activeBoardDay = boardDays.includes(selectedBoardDay)
    ? selectedBoardDay
    : (boardDays.includes(getTodayBoardDayKey(dashboardTimeZone))
      ? getTodayBoardDayKey(dashboardTimeZone)
      : (boardDays[boardDays.length - 1] ?? null));
  const activeBoardDayIndex = activeBoardDay ? boardDays.indexOf(activeBoardDay) : -1;
  const dashboardAssignments = useMemo(() => (
    liveRuntimeData && dashboardBoard
      ? buildDashboardAssignmentsFromBoard(dashboardBoard, activeBoardDay)
      : []
  ), [dashboardBoard, activeBoardDay, liveRuntimeData]);
  const visibleAssignments = dashboardAssignments;
  const showingFutureBoardDay = isFutureBoardDay(activeBoardDay, boardDays, dashboardTimeZone);
  const assignmentPresentationData = useMemo(
    () => buildAssignmentPresentationData(visibleAssignments, {
      baseDate: parseBoardDayDate(activeBoardDay),
      showProgress: !showingFutureBoardDay,
      forceScheduledStatuses: showingFutureBoardDay,
      taskTemplates: taskLibraryCards,
      dashboardStaffOrderSettings,
    }),
    [visibleAssignments, showingFutureBoardDay, activeBoardDay, taskLibraryCards, dashboardStaffOrderSettings],
  );
  const staffAssignmentOptions = useMemo(
    () => (dashboardBoard?.staff ?? []).filter((staff) => staff && staff !== 'Unallocated'),
    [dashboardBoard],
  );

  useEffect(() => {
    setActiveMobileFacilityIndex(0);
    if (assignmentGridRef.current) {
      assignmentGridRef.current.scrollTo({ left: 0, behavior: 'auto' });
    }
  }, [activeBoardDay, assignmentPresentationData.length]);

  function handleAssignmentGridScroll(event) {
    const element = event.currentTarget;
    const card = element.querySelector('.facility-board-card');

    if (!card) {
      return;
    }

    const cardWidth = card.getBoundingClientRect().width;
    if (!cardWidth) {
      return;
    }

    const nextIndex = Math.round(element.scrollLeft / (cardWidth + 14));
    const boundedIndex = Math.max(0, Math.min(assignmentPresentationData.length - 1, nextIndex));
    setActiveMobileFacilityIndex(boundedIndex);
  }

  function openAssignGroup(tasks = []) {
    if (!tasks.length) {
      return;
    }

    const recommendation = getRecommendedStaffSummary(tasks);

    setAssignmentError('');
    setActiveAssignGroup({
      key: tasks.map((task) => task.id).sort().join('::'),
      taskIds: tasks.map((task) => task.id),
      expectedUpdatedAtById: Object.fromEntries(tasks.map((task) => [task.id, task.updatedAt ?? null])),
      title: tasks[0]?.taskGroup ?? 'Task group',
      zone: tasks[0]?.zone ?? '',
      status: formatGroupStatusLabel(tasks),
      recommendation,
    });
  }

  function handleReorderSectionStaff(facilityName, sectionKey, nextOrder) {
    setDashboardStaffOrderSettings((current) => {
      const nextSettings = {
        ...current,
        [sectionKey]: {
          ...(current?.[sectionKey] || {}),
          [facilityName]: nextOrder,
        },
      };

      fetch('/api/dashboard-staff-order', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: nextSettings }),
      }).catch(() => {});

      return nextSettings;
    });
  }

  function applyAssignmentPreview(taskIds, staffName) {
    setDashboardBoard((current) => {
      if (!current?.cards?.length) {
        return current;
      }

      const targetIds = new Set(taskIds);
      return {
        ...current,
        cards: current.cards.map((card) => (
          targetIds.has(card.id)
            ? { ...card, staff: staffName }
            : card
        )),
      };
    });
  }

  function applySuggestedAssignment(task) {
    const effectiveRecommendedStaff = getEffectiveRecommendedStaff(task, { alwaysShowRecommendation: true });

    if (!task?.id || !effectiveRecommendedStaff) {
      return;
    }

    const change = {
      key: `suggested::${task.id}`,
      taskIds: [task.id],
      expectedUpdatedAtById: { [task.id]: task.updatedAt ?? null },
      staff: effectiveRecommendedStaff,
      mutationId: ++mutationCounterRef.current,
    };

    setAssignmentError('');
    setSuggestingTaskKey(task.id);
    setAcceptedSuggestedTaskIds((current) => ({
      ...current,
      [task.id]: true,
    }));
    applyAssignmentPreview(change.taskIds, change.staff);
    queueAssignmentSave(change);
  }

  function queueAssignmentSave(change) {
    pendingAssignmentsRef.current.set(change.key, change);
    setSaveState('pending');
    setSaveMessage('Unsaved changes…');

    if (pendingFlushTimerRef.current) {
      clearTimeout(pendingFlushTimerRef.current);
    }

    pendingFlushTimerRef.current = setTimeout(() => {
      flushPendingAssignments().catch(() => {});
    }, 900);
  }

  async function postAssignmentChange(change, keepalive = false) {
    const response = await fetch('/api/dashboard-board', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'assignGroup',
        cardIds: change.taskIds,
        expectedUpdatedAtById: change.expectedUpdatedAtById,
        staff: change.staff,
      }),
      keepalive,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || 'Unable to assign staff');
    }

    return payload;
  }

  async function flushPendingAssignments(options = {}) {
    const { keepalive = false } = options;
    const queuedChanges = [...pendingAssignmentsRef.current.values()];

    if (!queuedChanges.length) {
      return;
    }

    if (!keepalive && saveInFlightRef.current) {
      return saveInFlightRef.current;
    }

    if (pendingFlushTimerRef.current) {
      clearTimeout(pendingFlushTimerRef.current);
      pendingFlushTimerRef.current = null;
    }

    if (keepalive) {
      queuedChanges.forEach((change) => {
        fetch('/api/dashboard-board', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'assignGroup',
            cardIds: change.taskIds,
            expectedUpdatedAtById: change.expectedUpdatedAtById,
            staff: change.staff,
          }),
          keepalive: true,
        }).catch(() => {});
      });
      return;
    }

    const run = (async () => {
      setSaveState('saving');
      setSaveMessage('Saving…');

      try {
        for (const change of queuedChanges) {
          const latestQueued = pendingAssignmentsRef.current.get(change.key);
          if (!latestQueued || latestQueued.mutationId !== change.mutationId) {
            continue;
          }

          const payload = await postAssignmentChange(change);
          pendingAssignmentsRef.current.delete(change.key);
          setDashboardBoard((current) => applyAssignmentResultToBoard(current, payload, change.staff));
          if (change.taskIds.length === 1) {
            setSuggestingTaskKey((current) => (current === change.taskIds[0] ? '' : current));
          }
        }

        setSaveState('saved');
        setSaveMessage('Saved');
        loadDashboardBoard().catch(() => {});
      } catch (error) {
        pendingAssignmentsRef.current.clear();
        setSaveState('error');
        setSaveMessage(error?.message || 'Save failed');
        setAssignmentError(error?.message || 'Unable to assign staff');
        setAcceptedSuggestedTaskIds((current) => {
          if (!suggestingTaskKey) {
            return current;
          }

          const next = { ...current };
          delete next[suggestingTaskKey];
          return next;
        });
        setSuggestingTaskKey('');
        await loadDashboardBoard().catch(() => {});
      } finally {
        saveInFlightRef.current = null;
      }
    })();

    saveInFlightRef.current = run;
    return run;
  }

  useEffect(() => {
    function flushOnPageLeave() {
      flushPendingAssignments({ keepalive: true }).catch(() => {});
    }

    window.addEventListener('pagehide', flushOnPageLeave);
    window.addEventListener('beforeunload', flushOnPageLeave);

    return () => {
      window.removeEventListener('pagehide', flushOnPageLeave);
      window.removeEventListener('beforeunload', flushOnPageLeave);
    };
  }, []);

  async function assignGroupToStaff(staffName) {
    if (!activeAssignGroup?.taskIds?.length || !dashboardBoard) {
      return;
    }

    const currentAssignGroup = activeAssignGroup;
    const existingQueued = pendingAssignmentsRef.current.get(currentAssignGroup.key);
    const expectedUpdatedAtById = existingQueued?.expectedUpdatedAtById ?? currentAssignGroup.expectedUpdatedAtById;
    const queuedChange = {
      key: currentAssignGroup.key,
      taskIds: currentAssignGroup.taskIds,
      expectedUpdatedAtById,
      staff: staffName,
      mutationId: ++mutationCounterRef.current,
    };

    setAssigningGroupKey(currentAssignGroup.key);
    setAssignmentError('');
    setActiveAssignGroup(null);
    applyAssignmentPreview(currentAssignGroup.taskIds, staffName);
    queueAssignmentSave(queuedChange);

    setTimeout(() => {
      setAssigningGroupKey((current) => (current === currentAssignGroup.key ? '' : current));
    }, 150);
  }

  return (
    <main className="page dashboard-page">
      <section>
        {!liveRuntimeData && (
          <div className="card" style={{ marginBottom: 16 }}>
            <strong>Live operational data unavailable</strong>
            <div className="muted">
              The board is no longer falling back to polished demo operations data here. Once the runtime data path is stable, this view will populate from live records.
            </div>
          </div>
        )}

        <div className="dashboard-board-view-bar card">
          <div>
            <strong>Main board layout</strong>
            <div className="muted">Switch the main 3-column facility board between task flow and staff allocation views.</div>
          </div>
          <div className="dashboard-board-view-actions">
            <details className="dashboard-settings-menu">
              <summary className="button secondary slim dashboard-settings-trigger">
                Settings menu
                <span aria-hidden="true">⌄</span>
              </summary>
              <div className="dashboard-settings-dropdown">
                <Link className="dashboard-settings-link" href="/admin/settings">Open settings</Link>
                <Link className="dashboard-settings-link" href="/cleaner">Open staff landing</Link>
                <Link className="dashboard-settings-link" href="/admin/manager">Open manager view</Link>
                <Link className="dashboard-settings-link" href="/admin/inbox">Open operations inbox</Link>
                <Link className="dashboard-settings-link" href="/admin/task-cards">Task cards</Link>
                <Link className="dashboard-settings-link" href="/admin/facilities">Facilities</Link>
                <Link className="dashboard-settings-link" href="/admin/staff">Staff</Link>
              </div>
            </details>
            <button
              type="button"
              className={`button ${boardView === 'tasks' ? 'primary' : 'secondary'} slim`}
              onClick={() => setBoardView('tasks')}
            >
              Task view
            </button>
            <button
              type="button"
              className={`button ${boardView === 'staff' ? 'primary' : 'secondary'} slim`}
              onClick={() => setBoardView('staff')}
            >
              Staff view
            </button>
          </div>
        </div>

        <div className="assignment-grid" ref={assignmentGridRef} onScroll={handleAssignmentGridScroll}>
        {assignmentPresentationData.map((assignment) => (
          <FacilityBoardCard
            key={assignment.id}
            assignment={assignment}
            activeBoardDay={activeBoardDay}
            boardView={boardView}
            staffMeta={dashboardBoard?.staffMeta}
            onOpenTaskCard={setActiveTaskCard}
            onOpenAssignStaff={liveRuntimeData ? openAssignGroup : null}
            onApplySuggestedStaff={liveRuntimeData ? applySuggestedAssignment : null}
            assigningGroupKey={assigningGroupKey}
            suggestingTaskKey={suggestingTaskKey}
            acceptedSuggestedTaskIds={acceptedSuggestedTaskIds}
            onReorderSectionStaff={liveRuntimeData ? handleReorderSectionStaff : null}
          />
        ))}
        </div>
      </section>

      <section className="dashboard-utility-bar card">
        <div className="dashboard-update-card dashboard-update-card-inline">
          <span className="muted">Last deploy</span>
          <strong>{formatDeployTimestamp(deployStatus.deployedAt, dashboardTimeZone)}</strong>
          <div className="dashboard-update-meta">
            <span className="update-pill">{deployStatus.version ?? 'manual'}</span>
            <span className="muted">{deployStatus.summary ?? 'Manual deploy'}</span>
          </div>
        </div>
        {saveState !== 'idle' ? (
          <div className="dashboard-update-meta">
            <span className="muted">{saveMessage}</span>
          </div>
        ) : null}
      </section>

      <div className="sticky-board-action-bar">
        <button
          type="button"
          className="button secondary slim"
          onClick={() => setSelectedBoardDay(boardDays[activeBoardDayIndex - 1] ?? activeBoardDay)}
          disabled={activeBoardDayIndex <= 0}
        >
          ← Prev
        </button>
        <div className="sticky-board-center-stack">
          <div className="sticky-board-date">{formatBoardDateLabel(activeBoardDay, dashboardTimeZone)}</div>
          <button
            type="button"
            className="button secondary slim sticky-board-today-button"
            onClick={() => setSelectedBoardDay(boardDays.find((day) => day === getTodayBoardDayKey(dashboardTimeZone)) ?? activeBoardDay)}
            disabled={!boardDays.includes(getTodayBoardDayKey(dashboardTimeZone)) || activeBoardDay === getTodayBoardDayKey(dashboardTimeZone)}
          >
            Back to today
          </button>
        </div>
        <button
          type="button"
          className="button secondary slim"
          onClick={() => setSelectedBoardDay(boardDays[activeBoardDayIndex + 1] ?? activeBoardDay)}
          disabled={activeBoardDayIndex === -1 || activeBoardDayIndex >= boardDays.length - 1}
        >
          Next →
        </button>
      </div>

      {activeTaskCard && (
        <div className="modal-backdrop" role="presentation" onClick={() => setActiveTaskCard(null)}>
          <div className="fullscreen-checklist task-card-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-task-card-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header compact-modal-header">
              <div>
                <span className="badge">Task card details</span>
                <h2 id="dashboard-task-card-modal-title">{activeTaskCard.title}</h2>
                <strong>{activeTaskCard.facility}</strong>
              </div>
              <div className="cta-row no-top-gap">
                {activeTaskCard.templateId && (
                  <Link
                    className="button secondary"
                    href={`/admin/task-cards?templateId=${encodeURIComponent(activeTaskCard.templateId)}`}
                  >
                    Edit template
                  </Link>
                )}
                <button type="button" className="button secondary close-modal-button" onClick={() => setActiveTaskCard(null)}>Close</button>
              </div>
            </div>

            <div className="task-card-modal-grid">
              <div className="task-card-modal-section task-card-modal-section-span-2">
                <span className="muted">Instance</span>
                <strong>{activeTaskCard.instanceCode ?? '—'}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Status</span>
                <strong>{formatTaskLabel(activeTaskCard.status)}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Shift</span>
                <strong>{activeTaskCard.shift}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Assigned staff</span>
                <strong>{activeTaskCard.staff ?? 'Unallocated'}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Facility</span>
                <strong>{activeTaskCard.facility}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Zone</span>
                <strong>{activeTaskCard.zone}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Task group</span>
                <strong>{activeTaskCard.taskGroup}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Job order</span>
                <strong>{activeTaskCard.jobOrderNumber ? `#${activeTaskCard.jobOrderNumber}` : '—'}</strong>
              </div>

              <div className="task-card-modal-section task-card-modal-section-span-2">
                <span className="muted">Template</span>
                <strong>{activeTaskCard.templateId ?? '—'}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Requirement</span>
                <strong>{formatRequirement(activeTaskCard)}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Priority type</span>
                <strong>{activeTaskCard.frequencyType ?? '—'}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Frequency</span>
                <strong>{activeTaskCard.frequency ?? '—'}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Recurrence basis</span>
                <strong>{formatCadenceMode(activeTaskCard)}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Anchored day</span>
                <strong>{formatDesignatedDay(activeTaskCard)}</strong>
              </div>
              <div className="task-card-modal-section">
                <span className="muted">Estimated time required</span>
                <strong>{formatEstimatedMinutes(activeTaskCard)}</strong>
              </div>
              <div className="task-card-modal-section task-card-modal-section-span-2">
                <span className="muted">Notes</span>
                <strong>{activeTaskCard.notes ?? `${activeTaskCard.taskGroup} · ${activeTaskCard.zone} · ${activeTaskCard.facility}`}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeAssignGroup && (
        <div className="modal-backdrop" role="presentation" onClick={() => setActiveAssignGroup(null)}>
          <div className="fullscreen-checklist task-card-modal" role="dialog" aria-modal="true" aria-labelledby="assign-staff-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header compact-modal-header">
              <div>
                <span className="badge">Assign staff</span>
                <h2 id="assign-staff-modal-title">{activeAssignGroup.status} · {activeAssignGroup.title}</h2>
                <strong>{activeAssignGroup.zone || 'Select a staff member'}</strong>
              </div>
              <div className="cta-row no-top-gap">
                <button type="button" className="button secondary close-modal-button" onClick={() => setActiveAssignGroup(null)}>Close</button>
              </div>
            </div>

            <div className="task-card-modal-grid">
              {assignmentError ? (
                <div className="task-card-modal-section task-card-modal-section-span-2">
                  <strong>Assignment not saved</strong>
                  <div className="muted">{assignmentError}</div>
                </div>
              ) : null}
              {activeAssignGroup.recommendation ? (
                <div className="task-card-modal-section task-card-modal-section-span-2">
                  <strong>Suggested assignee: {activeAssignGroup.recommendation.staff}</strong>
                  <div className="muted">
                    Based on recent completion history for this selection — {activeAssignGroup.recommendation.staff} is the top match for {activeAssignGroup.recommendation.taskCount} of {activeAssignGroup.recommendation.recommendedTaskCount} tasks with history.
                  </div>
                </div>
              ) : (
                <div className="task-card-modal-section task-card-modal-section-span-2">
                  <strong>No history recommendation yet</strong>
                  <div className="muted">Once tasks build completion history, the system will suggest the staff member who completed them most often.</div>
                </div>
              )}
              {staffAssignmentOptions.map((staff) => (
                <button
                  key={staff}
                  type="button"
                  className={`button ${activeAssignGroup.recommendation?.staff === staff ? 'success' : 'primary'}`}
                  disabled={assigningGroupKey === activeAssignGroup.key}
                  onClick={() => assignGroupToStaff(staff)}
                >
                  {assigningGroupKey === activeAssignGroup.key
                    ? 'Saving…'
                    : activeAssignGroup.recommendation?.staff === staff
                      ? `Assign to ${staff} (recommended)`
                      : `Assign to ${staff}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
