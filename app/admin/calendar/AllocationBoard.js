'use client';

import { useMemo, useState } from 'react';

function formatJobOrder(jobOrder) {
  return String(jobOrder).padStart(3, '0');
}

function getOrderLanes(cards, selectedDay) {
  const dayOrders = cards
    .filter((card) => card.day === selectedDay && card.staff !== 'Unallocated')
    .map((card) => card.jobOrder);

  const maxOrder = dayOrders.length ? Math.max(...dayOrders, 10) : 10;
  const laneCount = Math.ceil(maxOrder / 10);

  return Array.from({ length: laneCount }, (_, index) => {
    const start = index * 10 + 1;
    const end = start + 9;
    return {
      key: `${start}-${end}`,
      start,
      end,
      label: `Jobs ${formatJobOrder(start)}–${formatJobOrder(end)}`,
    };
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

export default function AllocationBoard({ board }) {
  const [cards, setCards] = useState(board.cards);
  const [view, setView] = useState('weekly');
  const [selectedDay, setSelectedDay] = useState(board.days[0]);

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

  const assignedCount = cards.filter((card) => card.staff !== 'Unallocated').length;
  const unallocatedCount = cards.length - assignedCount;
  const dailyStaff = board.staff.filter((staff) => staff !== 'Unallocated');
  const orderLanes = useMemo(() => getOrderLanes(cards, selectedDay), [cards, selectedDay]);

  return (
    <section className="card allocation-board-shell">
      <div className="admin-calendar-header">
        <div>
          <h2>Task card allocation board</h2>
          <p className="muted">Switch view to see every task card, including unallocated work. Drag cards between staff and days.</p>
        </div>
        <div className="admin-calendar-controls">
          <span className="badge">{cards.length} task cards</span>
          <span className="badge">{assignedCount} allocated</span>
          <span className="badge">{unallocatedCount} unallocated</span>
          <button className={`button ${view === 'weekly' ? 'primary' : 'secondary'}`} type="button" onClick={() => setView('weekly')}>Weekly board</button>
          <button className={`button ${view === 'daily' ? 'primary' : 'secondary'}`} type="button" onClick={() => setView('daily')}>Daily staff view</button>
          <span className="button primary">Save allocations</span>
        </div>
      </div>

      {view === 'daily' && (
        <div className="daily-board-panel">
          <div className="daily-board-toolbar">
            <div>
              <h3>Daily hierarchy view</h3>
              <p className="muted">Each staff member keeps the shared job-order scroll, but the work is now nested by facility, zone, task group, and individual task card.</p>
            </div>
            <div className="day-switcher">
              {board.days.map((day) => (
                <button className={`button ${selectedDay === day ? 'primary' : 'secondary'}`} type="button" key={day} onClick={() => setSelectedDay(day)}>{day}</button>
              ))}
            </div>
          </div>

          <div className="daily-timeline-scroll">
            <div className="daily-timeline-grid">
              <div className="daily-time-head">Job order</div>
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

              {orderLanes.map((lane) => (
                <div className="daily-time-row" key={lane.key}>
                  <div className="daily-time-cell">{lane.label}</div>
                  {dailyStaff.map((staff) => {
                    const laneCards = cards
                      .filter((card) => card.staff === staff && card.day === selectedDay && card.jobOrder >= lane.start && card.jobOrder <= lane.end)
                      .sort((a, b) => a.jobOrder - b.jobOrder);
                    const facilities = groupHierarchy(laneCards);

                    return (
                      <div className="daily-timeline-cell hierarchy-cell" key={`${lane.key}-${staff}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, staff, selectedDay)}>
                        {facilities.map((facility) => (
                          <section className="hierarchy-facility-box" key={`${staff}-${lane.key}-${facility.facilityName}`}>
                            <div className="hierarchy-box-title hierarchy-facility-title">
                              <strong>{facility.facilityName}</strong>
                              <span>{laneCards.length} tasks in lane</span>
                            </div>

                            <div className="hierarchy-zone-stack">
                              {facility.zones.map((zone) => (
                                <article className="hierarchy-zone-box" key={`${facility.facilityName}-${zone.zoneName}`}>
                                  <div className="hierarchy-box-title">
                                    <strong>{zone.zoneName}</strong>
                                    <span>{zone.groups.reduce((sum, group) => sum + group.cards.length, 0)} tasks</span>
                                  </div>

                                  <div className="hierarchy-group-stack">
                                    {zone.groups.map((group) => (
                                      <div className="hierarchy-group-box" key={`${zone.zoneName}-${group.groupName}`}>
                                        <div className="hierarchy-box-title">
                                          <strong>{group.groupName}</strong>
                                          <span>{group.cards.length} cards</span>
                                        </div>

                                        <div className="hierarchy-task-stack">
                                          {group.cards.map((card) => (
                                            <div className={`allocation-card daily-task-card ${card.type === 'critical' ? 'calendar-critical' : 'calendar-suggestive'}`} draggable onDragStart={(event) => handleDragStart(event, card.id)} key={card.id}>
                                              <span className="job-order-pill">#{formatJobOrder(card.jobOrder)}</span>
                                              <strong>{card.title}</strong>
                                              <span>{card.taskGroup}</span>
                                              <small>{card.facility} · {card.zone}</small>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
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
