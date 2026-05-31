'use client';

import { useMemo, useState } from 'react';

function formatJobOrder(jobOrder) {
  return String(jobOrder).padStart(3, '0');
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

export default function AllocationBoard({
  board,
  initialView = 'weekly',
  lockView = false,
  title = 'Task card allocation board',
  description = 'Switch view to see every task card, including unallocated work. Drag cards between staff and days.',
}) {
  const [cards, setCards] = useState(board.cards);
  const [view, setView] = useState(initialView);
  const [selectedDay, setSelectedDay] = useState(board.days[0]);
  const [hierarchyMode, setHierarchyMode] = useState('nested');
  const [openGroups, setOpenGroups] = useState({});
  const [openZoneGroups, setOpenZoneGroups] = useState({});

  function moveCard(cardId, staff, day) {
    setCards((existing) => existing.map((card) => (
      card.id === cardId ? { ...card, staff, day } : card
    )));
  }

  function handleDragStart(event, cardId) {
    event.dataTransfer.setData('text/plain', cardId);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(event, staff, day) {
    event.preventDefault();
    const cardId = event.dataTransfer.getData('text/plain');
    moveCard(cardId, staff, day);
  }

  function toggleGroup(groupKey) {
    setOpenGroups((existing) => ({ ...existing, [groupKey]: !existing[groupKey] }));
  }

  function toggleZoneGroups(zoneKey) {
    setOpenZoneGroups((existing) => ({ ...existing, [zoneKey]: !existing[zoneKey] }));
  }

  const assignedCount = cards.filter((card) => card.staff !== 'Unallocated').length;
  const unallocatedCount = cards.length - assignedCount;
  const dailyStaff = board.staff.filter((staff) => staff !== 'Unallocated');
  const timeLanes = useMemo(() => getTimeLanes(board.staffMeta), [board.staffMeta]);

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
          {!lockView && (
            <>
              <button className={`button ${view === 'weekly' ? 'primary' : 'secondary'}`} type="button" onClick={() => setView('weekly')}>Weekly board</button>
              <button className={`button ${view === 'daily' ? 'primary' : 'secondary'}`} type="button" onClick={() => setView('daily')}>Daily staff view</button>
            </>
          )}
          <span className="button primary">Save allocations</span>
        </div>
      </div>

      {view === 'daily' && (
        <div className="daily-board-panel">
          <div className="daily-board-toolbar">
            <div>
              <h3>Daily hierarchy view</h3>
              <p className="muted">Time lanes follow staff shift windows instead of fixed task times, while task order still shapes how work flows through the shift.</p>
            </div>
            <div className="daily-board-controls">
              <div className="view-switcher">
                <button className={`button ${hierarchyMode === 'nested' ? 'primary' : 'secondary'}`} type="button" onClick={() => setHierarchyMode('nested')}>Nested cards</button>
                <button className={`button ${hierarchyMode === 'compact' ? 'primary' : 'secondary'}`} type="button" onClick={() => setHierarchyMode('compact')}>Compact stack</button>
                <button className={`button ${hierarchyMode === 'sections' ? 'primary' : 'secondary'}`} type="button" onClick={() => setHierarchyMode('sections')}>Section bands</button>
              </div>
              <div className="day-switcher">
                {board.days.map((day) => (
                  <button className={`button ${selectedDay === day ? 'primary' : 'secondary'}`} type="button" key={day} onClick={() => setSelectedDay(day)}>{day}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="daily-timeline-scroll">
            <div className="daily-timeline-grid">
              <div className="daily-time-head">Shift time</div>
              {dailyStaff.map((staff) => {
                const staffCards = cards.filter((card) => card.staff === staff && card.day === selectedDay);
                const shiftMeta = board.staffMeta?.[staff];
                return (
                  <div className="daily-staff-head hierarchy-staff-head" key={staff}>
                    <div>
                      <strong>{staff}</strong>
                      <span>{shiftMeta?.shiftLabel ?? 'Flexible shift'}</span>
                    </div>
                    <span>{shiftMeta?.shiftWindow ?? `${staffCards.length} tasks`}</span>
                  </div>
                );
              })}

              {timeLanes.map((lane) => (
                <div className="daily-time-row" key={lane.key}>
                  <div className="daily-time-cell">{lane.label}</div>
                  {dailyStaff.map((staff) => {
                    const staffCards = cards
                      .filter((card) => card.staff === staff && card.day === selectedDay)
                      .sort((a, b) => a.jobOrder - b.jobOrder);
                    const shiftMeta = board.staffMeta?.[staff];
                    const laneCards = getCardsForTimeLane(staffCards, lane, shiftMeta);
                    const facilities = groupHierarchy(laneCards);

                    return (
                      <div className={`daily-timeline-cell hierarchy-cell hierarchy-mode-${hierarchyMode}`} key={`${lane.key}-${staff}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, staff, selectedDay)}>
                        {facilities.map((facility) => (
                          <section className={`hierarchy-facility-box hierarchy-facility-${hierarchyMode}`} key={`${staff}-${lane.key}-${facility.facilityName}`}>
                            <div className="hierarchy-box-title hierarchy-facility-title">
                              <strong>{facility.facilityName}</strong>
                              <span>{laneCards.length} tasks in lane</span>
                            </div>

                            <div className={`hierarchy-zone-stack hierarchy-zone-stack-${hierarchyMode}`}>
                              {facility.zones.map((zone) => (
                                <article className={`hierarchy-zone-box hierarchy-zone-${hierarchyMode}`} key={`${facility.facilityName}-${zone.zoneName}`}>
                                  {(() => {
                                    const zoneKey = `${staff}-${lane.key}-${facility.facilityName}-${zone.zoneName}`;
                                    const zoneOpen = openZoneGroups[zoneKey];
                                    const zoneProgress = getCompletionStats(zone.groups.flatMap((group) => group.cards));

                                    return (
                                      <>
                                  <div className="hierarchy-zone-row">
                                    <div className="hierarchy-box-title hierarchy-zone-label">
                                      <strong>{zone.zoneName}</strong>
                                    </div>
                                    <button className={`hierarchy-zone-toggle ${zoneProgress.percent === 100 ? 'complete' : ''}`} type="button" onClick={() => toggleZoneGroups(zoneKey)}>
                                      <span className="hierarchy-zone-progress-fill" style={{ width: `${zoneProgress.percent}%` }} />
                                      <span className="hierarchy-zone-toggle-copy">
                                        <span>{zoneOpen ? 'Hide task groups' : 'Show task groups'}</span>
                                        <strong>{zoneProgress.completed}/{zoneProgress.total} complete</strong>
                                      </span>
                                    </button>
                                  </div>

                                  {zoneOpen && (
                                  <div className={`hierarchy-group-stack hierarchy-group-stack-${hierarchyMode}`}>
                                    {zone.groups.map((group) => (
                                      <div className={`hierarchy-group-box hierarchy-group-${hierarchyMode}`} key={`${zone.zoneName}-${group.groupName}`}>
                                        {(() => {
                                          const groupKey = `${staff}-${lane.key}-${zone.zoneName}-${group.groupName}`;
                                          const progress = getCompletionStats(group.cards);
                                          const isOpen = openGroups[groupKey];

                                          return (
                                            <>
                                        <div className="hierarchy-group-row">
                                          <div className="hierarchy-box-title hierarchy-group-label">
                                            <strong>{group.groupName}</strong>
                                          </div>

                                          <button className={`hierarchy-group-toggle ${progress.percent === 100 ? 'complete' : ''}`} type="button" onClick={() => toggleGroup(groupKey)}>
                                            <span className="hierarchy-group-progress-fill" style={{ width: `${progress.percent}%` }} />
                                            <span className="hierarchy-group-toggle-copy">
                                              <span>{isOpen ? 'Hide tasks' : 'Show tasks'}</span>
                                              <strong>{progress.completed}/{progress.total} complete</strong>
                                            </span>
                                          </button>
                                        </div>

                                        {isOpen && (
                                          <div className={`hierarchy-task-stack hierarchy-task-stack-${hierarchyMode}`}>
                                            {group.cards.map((card) => (
                                              <div className={`allocation-card daily-task-card hierarchy-task-card hierarchy-task-card-${hierarchyMode} ${card.type === 'critical' ? 'calendar-critical' : 'calendar-suggestive'}`} draggable onDragStart={(event) => handleDragStart(event, card.id)} key={card.id}>
                                                <span className="job-order-pill">#{formatJobOrder(card.jobOrder)}</span>
                                                <strong>{card.title}</strong>
                                                <span>{card.taskGroup}</span>
                                                <small>{card.facility} · {card.zone} · {card.status === 'completed' ? 'Completed' : card.status === 'in-progress' ? 'In progress' : 'Pending'}</small>
                                              </div>
                                            ))}
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
                          </section>
                        ))}
                        {!laneCards.length && <span className="slot-empty">Drop</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'weekly' && (
        <div className="allocation-grid">
          <div className="allocation-corner">Staff / Day</div>
          {board.days.map((day) => {
            const dayCount = cards.filter((card) => card.day === day).length;
            return <div className="allocation-day-head" key={day}><strong>{day}</strong><span>{dayCount} cards</span></div>;
          })}

          {board.staff.map((staff) => (
            <div className="allocation-row-fragment" key={staff}>
              <div className={`allocation-staff ${staff === 'Unallocated' ? 'unallocated-staff' : ''}`}>
                <strong>{staff}</strong>
                <span>{cards.filter((card) => card.staff === staff).length} cards</span>
              </div>
              {board.days.map((day) => {
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
                    {slotCards.map((card) => (
                      <div className={`allocation-card ${card.type === 'critical' ? 'calendar-critical' : 'calendar-suggestive'}`} draggable onDragStart={(event) => handleDragStart(event, card.id)} key={card.id}>
                        <strong>{card.title}</strong>
                        <span>#{formatJobOrder(card.jobOrder)} · {card.taskGroup}</span>
                        <small>{card.facility} · {card.zone}</small>
                      </div>
                    ))}
                    {!slotCards.length && <span className="slot-empty">Drop here</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
