'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { makeCleanerShiftAssignmentId } from '../../../data/demo-data';

const STORAGE_KEY = 'cienna-allocation-board-state-v1';

function formatBoardDayLabel(dayKey) {
  if (!dayKey) {
    return 'No day';
  }

  const date = new Date(`${dayKey}T00:00:00+10:00`);
  if (Number.isNaN(date.getTime())) {
    return dayKey;
  }

  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Australia/Brisbane',
  }).replace(',', '');
}

function parseBoardDay(dayKey) {
  if (!dayKey) {
    return null;
  }

  const date = new Date(`${dayKey}T00:00:00+10:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatBoardMonthLabel(dayKey) {
  const date = parseBoardDay(dayKey);
  if (!date) {
    return 'Unknown month';
  }

  return date.toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Brisbane',
  });
}

function addBoardDays(dayKey, days) {
  const date = parseBoardDay(dayKey);
  if (!date) {
    return dayKey;
  }

  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toLocaleDateString('en-CA', {
    timeZone: 'Australia/Brisbane',
  });
}

function getBoardMonthKey(dayKey) {
  return String(dayKey || '').slice(0, 7);
}

function getDefaultBoardDay(days) {
  if (!days.length) {
    return null;
  }

  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Australia/Brisbane',
  });

  return days.find((day) => day >= today) ?? days[days.length - 1] ?? days[0];
}

function clampBoardDay(days, preferredDay, fallbackDay = null) {
  if (!days.length) {
    return null;
  }

  if (preferredDay && days.includes(preferredDay)) {
    return preferredDay;
  }

  if (preferredDay) {
    return days.find((day) => day >= preferredDay) ?? days[days.length - 1];
  }

  return fallbackDay && days.includes(fallbackDay) ? fallbackDay : days[0];
}

function getVisibleBoardDays(days, anchorDay, windowSize = 14) {
  if (!days.length) {
    return [];
  }

  const safeAnchorDay = clampBoardDay(days, anchorDay, days[0]);
  if (!safeAnchorDay) {
    return [];
  }

  const windowEndDay = addBoardDays(safeAnchorDay, windowSize - 1);
  return days.filter((day) => day >= safeAnchorDay && day <= windowEndDay);
}

function formatJobOrder(jobOrder) {
  return String(jobOrder).padStart(3, '0');
}

function slugifyFacility(name = '') {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseShiftWindow(shiftWindow = '') {
  const baseWindow = shiftWindow.split('·')[0].trim();
  const [startText, endText] = baseWindow.split('–').map((part) => part?.trim());
  return {
    startMinutes: parseClockLabel(startText),
    endMinutes: parseClockLabel(endText),
  };
}

function parseClockLabel(label = '') {
  const match = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hours !== 12) {
    hours += 12;
  }
  if (meridiem === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

function formatMinutes(minutes) {
  const safeMinutes = Math.max(0, minutes ?? 0);
  let hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  if (hours === 0) {
    hours = 12;
  }
  return `${hours}:${String(mins).padStart(2, '0')} ${meridiem}`;
}

function getTimeLanes(staffMeta = {}) {
  const parsedWindows = Object.values(staffMeta)
    .map((meta) => parseShiftWindow(meta.shiftWindow))
    .filter((window) => window.startMinutes !== null && window.endMinutes !== null);

  const defaultStart = 6 * 60;
  const defaultEnd = 17 * 60;
  const startMinutes = parsedWindows.length ? Math.min(...parsedWindows.map((window) => window.startMinutes)) : defaultStart;
  const endMinutes = parsedWindows.length ? Math.max(...parsedWindows.map((window) => window.endMinutes)) : defaultEnd;
  const slotMinutes = 60;
  const laneCount = Math.max(1, Math.ceil((endMinutes - startMinutes) / slotMinutes));

  return Array.from({ length: laneCount }, (_, index) => {
    const laneStart = startMinutes + index * slotMinutes;
    const laneEnd = Math.min(laneStart + slotMinutes, endMinutes);
    return {
      index,
      key: `${laneStart}-${laneEnd}`,
      startMinutes: laneStart,
      endMinutes: laneEnd,
      label: `${formatMinutes(laneStart)} – ${formatMinutes(laneEnd)}`,
    };
  });
}

function getCardsForTimeLane(allCards, lane, shiftMeta) {
  const sortedCards = [...allCards].sort((a, b) => a.jobOrder - b.jobOrder);
  if (!sortedCards.length) {
    return [];
  }

  if (sortedCards.some((card) => Number.isInteger(card.laneIndex))) {
    return sortedCards.filter((card) => card.laneIndex === lane.index);
  }

  const shiftWindow = parseShiftWindow(shiftMeta?.shiftWindow);
  const shiftStart = shiftWindow.startMinutes ?? lane.startMinutes;
  const shiftEnd = shiftWindow.endMinutes ?? lane.endMinutes;
  const shiftDuration = Math.max(60, shiftEnd - shiftStart);

  return sortedCards.filter((card, index) => {
    const startOffset = Math.floor((index / sortedCards.length) * shiftDuration);
    const endOffset = Math.floor(((index + 1) / sortedCards.length) * shiftDuration);
    const cardStart = shiftStart + startOffset;
    const cardEnd = shiftStart + Math.max(endOffset, startOffset + 1);
    return cardStart < lane.endMinutes && cardEnd > lane.startMinutes;
  });
}

function groupHierarchy(cards) {
  const facilities = new Map();

  cards.forEach((card) => {
    if (!facilities.has(card.facility)) {
      facilities.set(card.facility, new Map());
    }

    const zones = facilities.get(card.facility);
    if (!zones.has(card.zone)) {
      zones.set(card.zone, new Map());
    }

    const groups = zones.get(card.zone);
    const groupName = card.groupName || card.taskGroup;
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }

    groups.get(groupName).push(card);
  });

  return Array.from(facilities.entries()).map(([facilityName, zones]) => ({
    facilityName,
    zones: Array.from(zones.entries()).map(([zoneName, groups]) => ({
      zoneName,
      groups: Array.from(groups.entries()).map(([groupName, groupCards]) => ({
        groupName,
        cards: groupCards.sort((a, b) => a.jobOrder - b.jobOrder),
      })),
    })),
  }));
}

function getCompletionStats(cards) {
  const completed = cards.filter((card) => card.status === 'completed').length;
  const total = cards.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

function buildFacilityRuns(staffCards, timeLanes, shiftMeta) {
  const laneDetails = timeLanes.map((lane) => {
    const laneCards = getCardsForTimeLane(staffCards, lane, shiftMeta);
    const facilities = groupHierarchy(laneCards);
    const facilityKey = facilities.map((facility) => facility.facilityName).join('|') || '__empty__';
    return { lane, laneCards, facilities, facilityKey };
  });

  return laneDetails.reduce((runs, detail) => {
    const lastRun = runs[runs.length - 1];
    if (lastRun && lastRun.facilityKey === detail.facilityKey) {
      lastRun.details.push(detail);
      return runs;
    }

    runs.push({ facilityKey: detail.facilityKey, details: [detail] });
    return runs;
  }, []);
}

function getCardStateClass(card) {
  if (card.status === 'completed') {
    return 'allocation-card-completed';
  }
  if (card.reworkRequired || card.hasOpenIssue || card.status === 'carried-forward') {
    return 'allocation-card-issue';
  }
  return 'allocation-card-active';
}

function getCardStatusLabel(card) {
  if (card.reworkRequired || card.managerAction === 'reassign') {
    return 'Needs rework';
  }
  if (card.hasOpenIssue) {
    return 'Issue raised';
  }
  if (card.status === 'completed') {
    return 'Completed';
  }
  if (card.status === 'in-progress') {
    return 'In progress';
  }
  if (card.status === 'carried-forward') {
    return 'Carry forward';
  }
  if (card.status === 'scheduled') {
    return 'Scheduled';
  }
  return 'Pending';
}

function getCardDetailItems(card) {
  return [
    { label: 'Status', value: getCardStatusLabel(card) },
    { label: 'Score', value: card.auditScore ? `${card.auditScore}/5` : 'Not scored yet' },
    { label: 'Facility', value: card.facility },
    { label: 'Zone', value: card.zone },
    { label: 'Group', value: card.groupName || card.taskGroup },
    { label: 'Type', value: card.type === 'critical' ? 'Critical' : 'Suggestive' },
  ];
}

function reorderCards(cards, cardId, updates, targetCardId = null) {
  const movingCard = cards.find((card) => card.id === cardId);
  if (!movingCard) {
    return cards;
  }

  const remainingCards = cards.filter((card) => card.id !== cardId);
  const updatedCard = { ...movingCard, ...updates };

  if (!targetCardId) {
    return remainingCards.map((card) => ({ ...card })).concat(updatedCard);
  }

  const targetIndex = remainingCards.findIndex((card) => card.id === targetCardId);
  if (targetIndex === -1) {
    return remainingCards.concat(updatedCard);
  }

  const nextCards = [...remainingCards];
  nextCards.splice(targetIndex, 0, updatedCard);

  return nextCards.map((card, index) => ({
    ...card,
    jobOrder: index + 1,
  }));
}

export default function AllocationBoard({
  board,
  initialView = 'weekly',
  lockView = false,
  title = 'Task card organiser board',
  description = 'Switch view to see every task card, including unallocated work. Drag cards between staff, days, and groups.',
}) {
  const useLocalDrafts = board.source !== 'prisma';
  const initialStoredState = typeof window !== 'undefined' && useLocalDrafts ? (() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })() : null;

  const [cards, setCards] = useState(() => {
    if (typeof window === 'undefined') {
      return board.cards;
    }

    return Array.isArray(initialStoredState?.cards) ? initialStoredState.cards : board.cards;
  });
  const [view, setView] = useState(initialView);
  const defaultBoardDay = getDefaultBoardDay(board.days);
  const [selectedDay, setSelectedDay] = useState(defaultBoardDay);
  const [rangeAnchorDay, setRangeAnchorDay] = useState(defaultBoardDay);
  const [hierarchyMode, setHierarchyMode] = useState('nested');
  const [openGroups, setOpenGroups] = useState({});
  const [openZoneGroups, setOpenZoneGroups] = useState({});
  const [expandedCards, setExpandedCards] = useState({});
  const [activeDropKey, setActiveDropKey] = useState('');
  const [history, setHistory] = useState([]);
  const [shiftState, setShiftState] = useState(initialStoredState?.shiftState || 'draft');
  const [saveNotice, setSaveNotice] = useState(
    useLocalDrafts
      ? (initialStoredState?.cards ? 'Loaded organiser draft' : 'Draft ready')
      : 'Live organiser board',
  );

  function setCardsWithHistory(updater) {
    setCards((existing) => {
      const nextCards = typeof updater === 'function' ? updater(existing) : updater;
      setHistory((past) => [...past.slice(-19), existing]);
      return nextCards;
    });
  }

  async function syncRemoteBoard(nextCards, nextShiftState, fallbackMessage = 'Changes saved locally') {
    if (useLocalDrafts) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards: nextCards, shiftState: nextShiftState }));
      }
      setSaveNotice(fallbackMessage);
      return;
    }

    setSaveNotice('Saving to live organiser board…');

    try {
      const response = await fetch('/api/organiser-board', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cards: nextCards, shiftState: nextShiftState }),
      });

      if (!response.ok) {
        throw new Error('Unable to sync organiser board');
      }

      const result = await response.json();
      setSaveNotice(result.message || 'Live organiser board saved');
    } catch {
      setSaveNotice('Live sync failed — showing local changes');
    }
  }

  function persistCards(nextCards, message = 'Changes saved locally') {
    void syncRemoteBoard(nextCards, shiftState, message);
  }

  function persistShiftState(nextShiftState, message) {
    setShiftState(nextShiftState);
    void syncRemoteBoard(cards, nextShiftState, message);
  }

  function moveCard(cardId, updates, targetCardId = null) {
    setCardsWithHistory((existing) => {
      const nextCards = reorderCards(existing, cardId, updates, targetCardId);
      persistCards(nextCards);
      return nextCards;
    });
  }

  function undoLastMove() {
    setHistory((past) => {
      if (!past.length) {
        return past;
      }

      const previousCards = past[past.length - 1];
      setCards(previousCards);
      persistCards(previousCards, 'Reverted last change');
      return past.slice(0, -1);
    });
  }

  function resetBoard() {
    setHistory([]);
    setCards(board.cards);
    if (typeof window !== 'undefined' && useLocalDrafts) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setShiftState('draft');
    void syncRemoteBoard(board.cards, 'draft', useLocalDrafts ? 'Reset to original demo layout' : 'Reset to seeded organiser layout');
  }

  function handleDragStart(event, cardId) {
    event.dataTransfer.setData('text/plain', cardId);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(event, staff, day) {
    event.preventDefault();
    const cardId = event.dataTransfer.getData('text/plain');
    moveCard(cardId, { staff, day, laneIndex: 0 });
  }

  function handleHierarchyDrop(event, updates, targetCardId = null) {
    event.preventDefault();
    const cardId = event.dataTransfer.getData('text/plain');
    setActiveDropKey('');
    moveCard(cardId, updates, targetCardId);
  }

  function toggleGroup(groupKey) {
    setOpenGroups((existing) => ({ ...existing, [groupKey]: !existing[groupKey] }));
  }

  function toggleZoneGroups(zoneKey) {
    setOpenZoneGroups((existing) => ({ ...existing, [zoneKey]: !existing[zoneKey] }));
  }

  function toggleExpandedCard(cardId) {
    setExpandedCards((existing) => ({ ...existing, [cardId]: !existing[cardId] }));
  }

  const assignedCount = cards.filter((card) => card.staff !== 'Unallocated').length;
  const unallocatedCount = cards.length - assignedCount;
  const reworkCount = cards.filter((card) => card.reworkRequired || card.managerAction === 'reassign' || card.status === 'carried-forward').length;
  const visibleDays = useMemo(() => getVisibleBoardDays(board.days, rangeAnchorDay), [board.days, rangeAnchorDay]);
  const activeDays = visibleDays.length ? visibleDays : board.days;
  const activeSelectedDay = clampBoardDay(activeDays, selectedDay, activeDays[0]);
  const monthOptions = useMemo(() => {
    const seen = new Map();
    board.days.forEach((day) => {
      const monthKey = getBoardMonthKey(day);
      if (!seen.has(monthKey)) {
        seen.set(monthKey, {
          key: monthKey,
          label: formatBoardMonthLabel(day),
          firstDay: day,
        });
      }
    });
    return [...seen.values()];
  }, [board.days]);
  const activeMonthKey = getBoardMonthKey(activeSelectedDay ?? activeDays[0] ?? defaultBoardDay);
  const dailyStaff = useMemo(
    () => board.staff.filter((staff) => staff !== 'Unallocated' || cards.some((card) => card.staff === 'Unallocated' && card.day === activeSelectedDay)),
    [board.staff, cards, activeSelectedDay],
  );
  const timeLanes = useMemo(() => getTimeLanes(board.staffMeta), [board.staffMeta]);
  const planningWindowControls = (
    <div className="day-switcher">
      <button className="button secondary" type="button" onClick={() => setRangeAnchorDay(clampBoardDay(board.days, addBoardDays(rangeAnchorDay ?? defaultBoardDay, -14), defaultBoardDay))}>← 2 weeks</button>
      <select className="button secondary" value={activeMonthKey} onChange={(event) => {
        const nextMonth = monthOptions.find((option) => option.key === event.target.value);
        if (!nextMonth) {
          return;
        }
        setRangeAnchorDay(nextMonth.firstDay);
        setSelectedDay(nextMonth.firstDay);
      }}>
        {monthOptions.map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
      {activeDays.map((day) => (
        <button className={`button ${activeSelectedDay === day ? 'primary' : 'secondary'}`} type="button" key={day} onClick={() => setSelectedDay(day)}>{formatBoardDayLabel(day)}</button>
      ))}
      <button className="button secondary" type="button" onClick={() => {
        const nextDefaultDay = defaultBoardDay ?? board.days[0] ?? null;
        if (!nextDefaultDay) {
          return;
        }
        setRangeAnchorDay(nextDefaultDay);
        setSelectedDay(nextDefaultDay);
      }}>Today</button>
      <button className="button secondary" type="button" onClick={() => setRangeAnchorDay(clampBoardDay(board.days, addBoardDays(rangeAnchorDay ?? defaultBoardDay, 14), board.days[board.days.length - 1]))}>2 weeks →</button>
    </div>
  );

  return (
    <section className="card allocation-board-shell">
      <div className="admin-calendar-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <div className="admin-calendar-controls">
          <span className="badge">{cards.length} task cards</span>
          <span className="badge">{assignedCount} allocated</span>
          <span className="badge">{unallocatedCount} unallocated</span>
          <span className="badge">{reworkCount} rework</span>
          <span className={`badge ${shiftState === 'published' ? 'status-completed' : 'status-pending'}`}>{shiftState === 'published' ? 'Published shift' : 'Draft shift'}</span>
          <span className="badge">{saveNotice}</span>
          <button className="button secondary" type="button" onClick={undoLastMove} disabled={!history.length}>Undo</button>
          <button className="button secondary" type="button" onClick={resetBoard}>Reset layout</button>
          <button className={`button ${shiftState === 'draft' ? 'primary' : 'secondary'}`} type="button" onClick={() => persistShiftState('draft', 'Shift moved back to draft')}>Keep as draft</button>
          <button className={`button ${shiftState === 'published' ? 'primary' : 'secondary'}`} type="button" onClick={() => persistShiftState('published', 'Shift published from organiser board')}>Publish shift</button>
          {!lockView && (
            <>
              <button className={`button ${view === 'weekly' ? 'primary' : 'secondary'}`} type="button" onClick={() => setView('weekly')}>Weekly board</button>
              <button className={`button ${view === 'daily' ? 'primary' : 'secondary'}`} type="button" onClick={() => setView('daily')}>Daily staff view</button>
            </>
          )}
          <span className="button primary">Organiser board active</span>
        </div>
      </div>

      {view === 'daily' && (
        <div className="daily-board-panel">
          <div className="daily-board-toolbar">
            <div>
              <h3>Daily organiser view</h3>
              <p className="muted">Time lanes follow staff shift windows instead of fixed task times, while task order still shapes how work flows through the shift.</p>
            </div>
            <div className="daily-board-controls">
              <div className="view-switcher">
                <button className={`button ${hierarchyMode === 'nested' ? 'primary' : 'secondary'}`} type="button" onClick={() => setHierarchyMode('nested')}>Nested cards</button>
                <button className={`button ${hierarchyMode === 'compact' ? 'primary' : 'secondary'}`} type="button" onClick={() => setHierarchyMode('compact')}>Compact stack</button>
                <button className={`button ${hierarchyMode === 'sections' ? 'primary' : 'secondary'}`} type="button" onClick={() => setHierarchyMode('sections')}>Section bands</button>
              </div>
              {planningWindowControls}
            </div>
          </div>

          <div className="daily-timeline-scroll">
            <div className="daily-timeline-grid daily-timeline-grid-continuous">
              <div className="daily-time-head">Shift time</div>
              {dailyStaff.map((staff) => {
                const staffCards = cards.filter((card) => card.staff === staff && card.day === activeSelectedDay);
                const shiftMeta = board.staffMeta?.[staff];
                return (
                  <div className="daily-staff-head hierarchy-staff-head" key={staff}>
                    <div>
                      <strong>{staff}</strong>
                      <span>{shiftMeta?.shiftLabel ?? 'Flexible shift'}</span>
                    </div>
                    <span>{shiftMeta?.routeLabel ?? shiftMeta?.shiftWindow ?? `${staffCards.length} tasks`}</span>
                  </div>
                );
              })}

              <div className="daily-time-column">
                {timeLanes.map((lane) => (
                  <div className="daily-time-cell" key={lane.key}>{lane.label}</div>
                ))}
              </div>

              {dailyStaff.map((staff) => {
                const staffCards = cards
                  .filter((card) => card.staff === staff && card.day === activeSelectedDay)
                  .sort((a, b) => a.jobOrder - b.jobOrder);
                const shiftMeta = board.staffMeta?.[staff];
                const facilityRuns = buildFacilityRuns(staffCards, timeLanes, shiftMeta);

                return (
                  <div className="daily-staff-column" key={`column-${staff}`}>
                    {facilityRuns.map((run, runIndex) => {
                      if (run.facilityKey === '__empty__') {
                        return run.details.map((detail) => (
                          <div className={`daily-timeline-cell hierarchy-cell hierarchy-mode-${hierarchyMode} hierarchy-lane-segment`} key={`${staff}-empty-${detail.lane.key}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, staff, activeSelectedDay)}>
                            <span className="slot-empty">Drop</span>
                          </div>
                        ));
                      }

                      const facilityName = run.details[0].facilities[0]?.facilityName || 'Assigned facility';
                      const runTaskCount = run.details.reduce((sum, detail) => sum + detail.laneCards.length, 0);
                      const facilityProgress = getCompletionStats(run.details.flatMap((detail) => detail.laneCards));
                      const facilityChecklistId = makeCleanerShiftAssignmentId({
                        staff,
                        day: activeSelectedDay,
                        facility: facilityName,
                        zone: 'facility',
                      });

                      return (
                        <section className={`hierarchy-facility-box hierarchy-facility-box-continuous hierarchy-facility-${hierarchyMode} facility-theme-${slugifyFacility(facilityName)}`} key={`${staff}-${facilityName}-${runIndex}`}>
                          <div className="hierarchy-facility-title">
                            <div className={`hierarchy-facility-progress hierarchy-section-progress ${facilityProgress.percent === 100 ? 'complete' : ''}`}>
                              <span className="hierarchy-facility-progress-fill" style={{ width: `${facilityProgress.percent}%` }} />
                              <span className="hierarchy-facility-progress-copy">
                                <strong>{facilityName}</strong>
                                <strong>{facilityProgress.completed}/{facilityProgress.total} complete</strong>
                              </span>
                            </div>
                            <div className="hierarchy-facility-link-row">
                              <Link className="button secondary hierarchy-cleaner-link" href={`/scan/${facilityChecklistId}`}>
                                Open cleaner checklist
                              </Link>
                            </div>
                          </div>

                          <div className="daily-staff-lane-stack">
                            {run.details.map((detail) => (
                              <div className={`daily-timeline-cell hierarchy-cell hierarchy-mode-${hierarchyMode} hierarchy-lane-segment`} key={`${detail.lane.key}-${staff}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, staff, activeSelectedDay)}>
                                {detail.facilities.map((facility) => (
                                  <div className={`hierarchy-zone-stack hierarchy-zone-stack-${hierarchyMode}`} key={`${facility.facilityName}-${detail.lane.key}`}>
                                    {facility.zones.map((zone) => (
                                      <article className={`hierarchy-zone-box hierarchy-zone-${hierarchyMode}`} key={`${facility.facilityName}-${detail.lane.key}-${zone.zoneName}`}>
                                      {(() => {
                                        const zoneKey = `${staff}-${detail.lane.key}-${facility.facilityName}-${zone.zoneName}`;
                                        const zoneOpen = openZoneGroups[zoneKey];
                                        const zoneProgress = getCompletionStats(zone.groups.flatMap((group) => group.cards));
                                        const zoneNotifications = zone.groups
                                          .flatMap((group) => group.cards)
                                          .filter((card) => card.auditScore === 1);

                                        return (
                                          <>
                                            <div className="hierarchy-zone-row">
                                              <button className={`hierarchy-zone-toggle hierarchy-section-progress ${zoneProgress.percent === 100 ? 'complete' : ''}`} type="button" onClick={() => toggleZoneGroups(zoneKey)}>
                                                <span className="hierarchy-zone-progress-fill" style={{ width: `${zoneProgress.percent}%` }} />
                                                <span className="hierarchy-zone-toggle-copy">
                                                  <strong>{zone.zoneName}</strong>
                                                  <strong>{zoneProgress.completed}/{zoneProgress.total} complete</strong>
                                                </span>
                                              </button>
                                            </div>
                                            {zoneNotifications.length > 0 && (
                                              <div className="hierarchy-zone-notifications">
                                                {zoneNotifications.map((card) => (
                                                  <div className="hierarchy-zone-notification" key={`${card.id}-notification`}>
                                                    <strong>{card.title}</strong>
                                                    <span>{card.issueNote || getCardStatusLabel(card)}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {zoneOpen && (
                                              <div className={`hierarchy-group-stack hierarchy-group-stack-${hierarchyMode}`}>
                                                    {zone.groups.map((group) => (
                                                      <div className={`hierarchy-group-box hierarchy-group-${hierarchyMode}`} key={`${zone.zoneName}-${group.groupName}`}>
                                                        {(() => {
                                                      const groupKey = `${staff}-${detail.lane.key}-${zone.zoneName}-${group.groupName}`;
                                                      const progress = getCompletionStats(group.cards);
                                                      const isOpen = openGroups[groupKey];
                                                      const groupDropUpdates = {
                                                        staff,
                                                        day: activeSelectedDay,
                                                        laneIndex: detail.lane.index,
                                                        facility: facility.facilityName,
                                                        zone: zone.zoneName,
                                                        taskGroup: group.groupName,
                                                        groupName: group.groupName,
                                                        groupId: group.cards[0]?.groupId ?? `${staff}-${activeSelectedDay}-${facility.facilityName}-${zone.zoneName}-${group.groupName}`,
                                                        plannedFacility: facility.facilityName,
                                                        plannedZone: zone.zoneName,
                                                        plannedTaskGroup: group.groupName,
                                                      };
                                                      const dropKey = `${staff}-${activeSelectedDay}-${detail.lane.index}-${facility.facilityName}-${zone.zoneName}-${group.groupName}`;

                                                      return (
                                                        <>
                                                          <div className={`hierarchy-group-row hierarchy-drop-target ${activeDropKey === dropKey ? 'hierarchy-drop-target-active' : ''}`} onDragOver={(event) => {
                                                            event.preventDefault();
                                                            if (activeDropKey !== dropKey) setActiveDropKey(dropKey);
                                                          }} onDragLeave={() => {
                                                            if (activeDropKey === dropKey) setActiveDropKey('');
                                                          }} onDrop={(event) => handleHierarchyDrop(event, groupDropUpdates)}>
                                                            <button className={`hierarchy-group-toggle hierarchy-section-progress ${progress.percent === 100 ? 'complete' : ''}`} type="button" onClick={() => toggleGroup(groupKey)}>
                                                              <span className="hierarchy-group-progress-fill" style={{ width: `${progress.percent}%` }} />
                                                              <span className="hierarchy-group-toggle-copy">
                                                                <strong>{group.groupName}</strong>
                                                                <strong>{progress.completed}/{progress.total} complete</strong>
                                                              </span>
                                                            </button>
                                                          </div>

                                                          {isOpen && (
                                                            <div className={`hierarchy-task-stack hierarchy-task-stack-${hierarchyMode} hierarchy-drop-target ${activeDropKey === dropKey ? 'hierarchy-drop-target-active' : ''}`} onDragOver={(event) => {
                                                              event.preventDefault();
                                                              if (activeDropKey !== dropKey) setActiveDropKey(dropKey);
                                                            }} onDragLeave={() => {
                                                              if (activeDropKey === dropKey) setActiveDropKey('');
                                                            }} onDrop={(event) => handleHierarchyDrop(event, groupDropUpdates)}>
                                                              {group.cards.map((card) => {
                                                                const cardDropKey = `${dropKey}-${card.id}`;
                                                                const isExpanded = expandedCards[card.id];
                                                                return (
                                                                <div className={`allocation-card daily-task-card hierarchy-task-card hierarchy-task-card-${hierarchyMode} ${card.type === 'critical' ? 'calendar-critical' : 'calendar-suggestive'} ${getCardStateClass(card)} ${activeDropKey === cardDropKey ? 'hierarchy-card-drop-target-active' : ''} ${isExpanded ? 'allocation-card-expanded' : ''}`} draggable onDragStart={(event) => handleDragStart(event, card.id)} onDragOver={(event) => {
                                                                  event.preventDefault();
                                                                  if (activeDropKey !== cardDropKey) setActiveDropKey(cardDropKey);
                                                                }} onDragLeave={() => {
                                                                  if (activeDropKey === cardDropKey) setActiveDropKey('');
                                                                }} onDrop={(event) => handleHierarchyDrop(event, groupDropUpdates, card.id)} onClick={() => toggleExpandedCard(card.id)} onKeyDown={(event) => {
                                                                  if (event.key === 'Enter' || event.key === ' ') {
                                                                    event.preventDefault();
                                                                    toggleExpandedCard(card.id);
                                                                  }
                                                                }} role="button" tabIndex={0} aria-expanded={isExpanded} key={card.id}>
                                                                  <span className="hierarchy-drag-handle" aria-hidden="true">⋮⋮</span>
                                                                  <span className="job-order-pill">#{formatJobOrder(card.jobOrder)}</span>
                                                                  <strong>{card.title}</strong>
                                                                  <span>{card.taskGroup}</span>
                                                                  <small>{card.facility} · {card.zone} · {getCardStatusLabel(card)}</small>
                                                                  {isExpanded && (
                                                                    <div className="allocation-card-details">
                                                                      {getCardDetailItems(card).map((item) => (
                                                                        <div className="allocation-card-detail-row" key={`${card.id}-${item.label}`}>
                                                                          <span>{item.label}</span>
                                                                          <strong>{item.value}</strong>
                                                                        </div>
                                                                      ))}
                                                                      {card.issueNote ? <p className="allocation-card-note">{card.issueNote}</p> : null}
                                                                    </div>
                                                                  )}
                                                                </div>
                                                              )})}
                                                            </div>
                                                          )}
                                                        </>
                                                      );
                                                    })()}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </>
                                        );
                                      })()}
                                      </article>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view === 'weekly' && (
        <div className="daily-board-panel">
          <div className="daily-board-toolbar">
            <div>
              <h3>Weekly board window</h3>
              <p className="muted">Use the same active planning window controls here, then switch back to daily without losing your place.</p>
            </div>
            {planningWindowControls}
          </div>
          <div className="allocation-grid">
          <div className="allocation-corner">Staff / Day</div>
          {activeDays.map((day) => {
            const dayCount = cards.filter((card) => card.day === day).length;
            return <div className="allocation-day-head" key={day}><strong>{formatBoardDayLabel(day)}</strong><span>{dayCount} cards</span></div>;
          })}

          {board.staff.map((staff) => (
            <div className="allocation-row-fragment" key={staff}>
              <div className={`allocation-staff ${staff === 'Unallocated' ? 'unallocated-staff' : ''}`}>
                <strong>{staff}</strong>
                <span>{cards.filter((card) => card.staff === staff).length} cards</span>
              </div>
              {activeDays.map((day) => {
                const slotCards = cards
                  .filter((card) => card.staff === staff && card.day === day)
                  .sort((a, b) => a.jobOrder - b.jobOrder);
                const criticalCount = slotCards.filter((card) => card.type === 'critical').length;
                return (
                  <div className="allocation-slot" key={`${staff}-${day}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, staff, day)}>
                    <div className="allocation-slot-summary">
                      <strong>{slotCards.length}</strong>
                      <span>{criticalCount} critical</span>
                    </div>
                    {slotCards.map((card) => {
                      const isExpanded = expandedCards[card.id];
                      return (
                        <div className={`allocation-card ${card.type === 'critical' ? 'calendar-critical' : 'calendar-suggestive'} ${getCardStateClass(card)} ${isExpanded ? 'allocation-card-expanded' : ''}`} draggable onDragStart={(event) => handleDragStart(event, card.id)} onClick={() => toggleExpandedCard(card.id)} onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleExpandedCard(card.id);
                          }
                        }} role="button" tabIndex={0} aria-expanded={isExpanded} key={card.id}>
                          <strong>{card.title}</strong>
                          <span>#{formatJobOrder(card.jobOrder)} · {card.taskGroup}</span>
                          <small>{card.facility} · {card.zone} · {getCardStatusLabel(card)}</small>
                          {isExpanded && (
                            <div className="allocation-card-details">
                              {getCardDetailItems(card).map((item) => (
                                <div className="allocation-card-detail-row" key={`${card.id}-${item.label}`}>
                                  <span>{item.label}</span>
                                  <strong>{item.value}</strong>
                                </div>
                              ))}
                              {card.issueNote ? <p className="allocation-card-note">{card.issueNote}</p> : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!slotCards.length && <span className="slot-empty">Drop here</span>}
                  </div>
                );
              })}
            </div>
          ))}
          </div>
        </div>
      )}
    </section>
  );
}
