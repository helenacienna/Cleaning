'use client';

import { useMemo, useState } from 'react';
import { DEFAULT_DAY_ROSTER, DEFAULT_SHIFT, WEEKDAY_OPTIONS, formatRosterWindow, normalizeWeeklyRoster } from '../../../lib/staff-roster';

const EMPTY_NEW_STAFF = {
  fullName: '',
  phone: '',
};

const FULL_WEEKDAY_LABELS = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function buildEmptyWeek() {
  return normalizeWeeklyRoster({});
}

function nextStaffCode(staff = []) {
  const maxValue = staff.reduce((highest, member) => {
    const match = String(member.staffCode ?? '').match(/(\d+)$/);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);
  return `STF${String(maxValue + 1).padStart(3, '0')}`;
}

function buildPayload(member) {
  return {
    staffCode: String(member.staffCode ?? '').trim().toUpperCase(),
    fullName: String(member.fullName ?? '').trim(),
    role: String(member.role ?? 'cleaner').trim() || 'cleaner',
    phone: String(member.phone ?? '').trim(),
    preferredTimeWindow: '',
    preferredShiftLabel: '',
    availabilityNotes: '',
    weeklyAvailability: normalizeWeeklyRoster(member.weeklyAvailability),
    active: member.active !== false,
  };
}

function facilityLabel(shift, facilitiesById) {
  if (shift.facilityId && facilitiesById[shift.facilityId]) {
    return facilitiesById[shift.facilityId].name;
  }
  return shift.facilityName || 'Select location';
}

function ensureDayEnabled(day) {
  const normalized = { ...DEFAULT_DAY_ROSTER, ...(day ?? {}) };
  const hasShift = Array.isArray(normalized.shifts) && normalized.shifts.length > 0;
  return {
    ...normalized,
    enabled: Boolean(normalized.enabled || normalized.start || normalized.finish || hasShift),
  };
}

function formatTimeRange(start, finish) {
  if (start && finish) {
    return `${start}–${finish}`;
  }
  return start || finish || '';
}

function buildDaySummary(dayKey, roster, facilitiesById) {
  const dayRoster = ensureDayEnabled(roster?.[dayKey]);
  const dayTime = formatTimeRange(dayRoster.start, dayRoster.finish);
  const runParts = (dayRoster.shifts ?? [])
    .filter((shift) => shift.facilityId || shift.facilityName || shift.start || shift.finish)
    .map((shift) => {
      const label = facilityLabel(shift, facilitiesById);
      const time = formatTimeRange(shift.start, shift.finish);
      return time ? `${label} ${time}` : label;
    });

  if (!dayTime && runParts.length === 0) {
    return null;
  }

  return {
    dayLabel: FULL_WEEKDAY_LABELS[dayKey] ?? dayKey,
    text: [dayTime, ...runParts].filter(Boolean).join(' · '),
  };
}

export default function StaffManager({ initialStaff = [], facilityOptions = [], source = 'unavailable' }) {
  const [staff, setStaff] = useState(initialStaff);
  const [newStaff, setNewStaff] = useState(EMPTY_NEW_STAFF);
  const [editingStaffId, setEditingStaffId] = useState('');
  const [state, setState] = useState({ creating: false, savingId: '', error: '', success: '' });
  const liveDataAvailable = source === 'prisma';

  const facilitiesById = useMemo(
    () => Object.fromEntries(facilityOptions.map((facility) => [facility.id, facility])),
    [facilityOptions],
  );

  function updateStaff(staffId, field, value) {
    setStaff((current) => current.map((member) => (
      member.id === staffId ? { ...member, [field]: value } : member
    )));
  }

  function updateDay(staffId, dayKey, field, value) {
    setStaff((current) => current.map((member) => {
      if (member.id !== staffId) {
        return member;
      }
      const currentDay = ensureDayEnabled(member.weeklyAvailability?.[dayKey]);
      const nextDay = ensureDayEnabled({ ...currentDay, [field]: value });
      return {
        ...member,
        weeklyAvailability: {
          ...(member.weeklyAvailability ?? {}),
          [dayKey]: nextDay,
        },
      };
    }));
  }

  function addSubShift(staffId, dayKey) {
    setStaff((current) => current.map((member) => {
      if (member.id !== staffId) {
        return member;
      }
      const currentDay = ensureDayEnabled(member.weeklyAvailability?.[dayKey]);
      return {
        ...member,
        weeklyAvailability: {
          ...(member.weeklyAvailability ?? {}),
          [dayKey]: {
            ...currentDay,
            enabled: true,
            shifts: [...(currentDay.shifts ?? []), DEFAULT_SHIFT],
          },
        },
      };
    }));
  }

  function removeSubShift(staffId, dayKey, shiftIndex) {
    setStaff((current) => current.map((member) => {
      if (member.id !== staffId) {
        return member;
      }
      const currentDay = ensureDayEnabled(member.weeklyAvailability?.[dayKey]);
      const nextShifts = (currentDay.shifts ?? []).filter((_, index) => index !== shiftIndex);
      return {
        ...member,
        weeklyAvailability: {
          ...(member.weeklyAvailability ?? {}),
          [dayKey]: ensureDayEnabled({ ...currentDay, shifts: nextShifts }),
        },
      };
    }));
  }

  function updateSubShift(staffId, dayKey, shiftIndex, field, value) {
    setStaff((current) => current.map((member) => {
      if (member.id !== staffId) {
        return member;
      }
      const currentDay = ensureDayEnabled(member.weeklyAvailability?.[dayKey]);
      const nextShifts = (currentDay.shifts ?? []).map((shift, index) => {
        if (index !== shiftIndex) {
          return shift;
        }
        if (field === 'facilityId') {
          return {
            ...shift,
            facilityId: value,
            facilityName: facilitiesById[value]?.name ?? '',
          };
        }
        return { ...shift, [field]: value };
      });
      return {
        ...member,
        weeklyAvailability: {
          ...(member.weeklyAvailability ?? {}),
          [dayKey]: ensureDayEnabled({ ...currentDay, shifts: nextShifts }),
        },
      };
    }));
  }

  async function saveStaff(member) {
    setState({ creating: false, savingId: member.id, error: '', success: '' });

    const response = await fetch(`/api/staff/${member.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload(member)),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.staff) {
      setState({ creating: false, savingId: '', error: payload?.error || 'Unable to save staff member.', success: '' });
      return;
    }

    setStaff((current) => current.map((item) => (
      item.id === payload.staff.id ? { ...item, ...payload.staff } : item
    )));
    setState({ creating: false, savingId: '', error: '', success: `Saved ${payload.staff.fullName}.` });
  }

  async function createStaff() {
    const fullName = String(newStaff.fullName ?? '').trim();
    if (!fullName) {
      setState((current) => ({ ...current, error: 'Name is required.', success: '' }));
      return;
    }

    setState({ creating: true, savingId: '', error: '', success: '' });
    const response = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        staffCode: nextStaffCode(staff),
        fullName,
        role: 'cleaner',
        phone: String(newStaff.phone ?? '').trim(),
        weeklyAvailability: buildEmptyWeek(),
        active: true,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.staff) {
      setState({ creating: false, savingId: '', error: payload?.error || 'Unable to create staff member.', success: '' });
      return;
    }

    setStaff((current) => [...current, payload.staff].sort((left, right) => left.fullName.localeCompare(right.fullName)));
    setNewStaff(EMPTY_NEW_STAFF);
    setState({ creating: false, savingId: '', error: '', success: `Added ${payload.staff.fullName}.` });
  }

  return (
    <section className="card admin-calendar-shell">
      <div className="panel-title">
        <div>
          <h3>Weekly roster</h3>
        </div>
      </div>

      {!liveDataAvailable && (
        <section className="card" style={{ marginBottom: 16 }}>
          <strong>Roster unavailable</strong>
          <div className="muted">This screen needs live database access before the weekly roster can be edited.</div>
        </section>
      )}

      <article className="task-card-editor" style={{ marginBottom: 16 }}>
        <div className="panel-title" style={{ marginBottom: 12 }}>
          <div>
            <h4>Weekly schedule list</h4>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {staff.map((member) => {
            const daySummaries = WEEKDAY_OPTIONS
              .map((day) => buildDaySummary(day.key, member.weeklyAvailability, facilitiesById))
              .filter(Boolean);
            const isEditing = editingStaffId === member.id;

            return (
              <section key={member.id} style={staffCardStyle}>
                <div style={staffSummaryRowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
                      <strong style={{ fontSize: 15 }}>{member.fullName || 'Unnamed staff member'}</strong>
                      {member.phone && <span className="muted" style={{ fontSize: 12 }}>{member.phone}</span>}
                      <span className="muted" style={{ fontSize: 11 }}>{member.staffCode}</span>
                    </div>
                    <div style={scheduleSummaryStyle}>
                      {daySummaries.length > 0 ? (
                        daySummaries.map((summary) => (
                          <span key={`${member.id}-${summary.dayLabel}`} style={schedulePillStyle}>
                            <strong>{summary.dayLabel.slice(0, 3)}</strong> {summary.text}
                          </span>
                        ))
                      ) : (
                        <span className="muted">No scheduled times set for this week.</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button secondary slim"
                    onClick={() => setEditingStaffId(isEditing ? '' : member.id)}
                    disabled={!liveDataAvailable || state.savingId === member.id}
                    style={{ minWidth: 72 }}
                  >
                    {isEditing ? 'Close' : 'Edit'}
                  </button>
                </div>

                {isEditing && (
                  <div style={editPanelStyle}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 10 }}>
                      <label className="field-label" style={{ margin: 0 }}>
                        <span>Name</span>
                        <input
                          type="text"
                          value={member.fullName}
                          onChange={(event) => updateStaff(member.id, 'fullName', event.target.value)}
                          disabled={!liveDataAvailable || state.savingId === member.id}
                          placeholder="Staff name"
                        />
                      </label>
                      <label className="field-label" style={{ margin: 0 }}>
                        <span>Phone</span>
                        <input
                          type="text"
                          value={member.phone ?? ''}
                          onChange={(event) => updateStaff(member.id, 'phone', event.target.value)}
                          disabled={!liveDataAvailable || state.savingId === member.id}
                          placeholder="Phone"
                        />
                      </label>
                    </div>

                    <div style={weekdayEditGridStyle}>
                      {WEEKDAY_OPTIONS.map((day) => {
                        const dayRoster = ensureDayEnabled(member.weeklyAvailability?.[day.key]);
                        return (
                          <div key={`${member.id}-${day.key}`} style={dayEditCardStyle}>
                            <div style={{ fontSize: 12, fontWeight: 800 }}>{FULL_WEEKDAY_LABELS[day.key] ?? day.label}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                              <input
                                type="time"
                                value={dayRoster.start ?? ''}
                                onChange={(event) => updateDay(member.id, day.key, 'start', event.target.value)}
                                disabled={!liveDataAvailable || state.savingId === member.id}
                                style={compactInputStyle}
                                aria-label={`${day.label} start`}
                              />
                              <input
                                type="time"
                                value={dayRoster.finish ?? ''}
                                onChange={(event) => updateDay(member.id, day.key, 'finish', event.target.value)}
                                disabled={!liveDataAvailable || state.savingId === member.id}
                                style={compactInputStyle}
                                aria-label={`${day.label} finish`}
                              />
                            </div>

                            <div style={{ display: 'grid', gap: 5 }}>
                              {(dayRoster.shifts ?? []).map((shift, shiftIndex) => (
                                <div key={`${member.id}-${day.key}-${shiftIndex}`} style={runEditCardStyle}>
                                  <select
                                    value={shift.facilityId ?? ''}
                                    onChange={(event) => updateSubShift(member.id, day.key, shiftIndex, 'facilityId', event.target.value)}
                                    disabled={!liveDataAvailable || state.savingId === member.id}
                                    style={compactInputStyle}
                                  >
                                    <option value="">Location</option>
                                    {facilityOptions.map((facility) => (
                                      <option key={`${member.id}-${day.key}-${shiftIndex}-${facility.id}`} value={facility.id}>{facility.name}</option>
                                    ))}
                                  </select>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 4 }}>
                                    <input
                                      type="time"
                                      value={shift.start ?? ''}
                                      onChange={(event) => updateSubShift(member.id, day.key, shiftIndex, 'start', event.target.value)}
                                      disabled={!liveDataAvailable || state.savingId === member.id}
                                      style={compactInputStyle}
                                      aria-label={`${day.label} run start`}
                                    />
                                    <input
                                      type="time"
                                      value={shift.finish ?? ''}
                                      onChange={(event) => updateSubShift(member.id, day.key, shiftIndex, 'finish', event.target.value)}
                                      disabled={!liveDataAvailable || state.savingId === member.id}
                                      style={compactInputStyle}
                                      aria-label={`${day.label} run finish`}
                                    />
                                    <button
                                      type="button"
                                      className="button secondary slim"
                                      style={compactIconButtonStyle}
                                      onClick={() => removeSubShift(member.id, day.key, shiftIndex)}
                                      disabled={!liveDataAvailable || state.savingId === member.id}
                                      aria-label={`Remove ${day.label} run`}
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button
                                type="button"
                                className="button secondary slim"
                                style={compactButtonStyle}
                                onClick={() => addSubShift(member.id, day.key)}
                                disabled={!liveDataAvailable || state.savingId === member.id}
                              >
                                Add run
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="cta-row" style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className="button primary slim"
                        onClick={() => saveStaff(member)}
                        disabled={!liveDataAvailable || state.savingId === member.id || !String(member.fullName ?? '').trim()}
                      >
                        {state.savingId === member.id ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </article>

      <article className="task-card-editor" style={{ marginBottom: 16 }}>
        <div className="panel-title" style={{ marginBottom: 12 }}>
          <div>
            <h4>Add new staff member</h4>
            <p className="muted">New staff are added below the weekly roster so the working schedule stays first.</p>
          </div>
          <span className="badge">Simple details</span>
        </div>

        <div className="task-detail-grid" style={{ marginBottom: 12 }}>
          <label className="field-label">
            <span>Name</span>
            <input
              type="text"
              value={newStaff.fullName}
              onChange={(event) => setNewStaff((current) => ({ ...current, fullName: event.target.value }))}
              disabled={!liveDataAvailable || state.creating}
              placeholder="New staff member"
            />
          </label>

          <label className="field-label">
            <span>Phone</span>
            <input
              type="text"
              value={newStaff.phone}
              onChange={(event) => setNewStaff((current) => ({ ...current, phone: event.target.value }))}
              disabled={!liveDataAvailable || state.creating}
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="cta-row">
          <button
            type="button"
            className="button primary"
            onClick={createStaff}
            disabled={!liveDataAvailable || state.creating || !String(newStaff.fullName ?? '').trim()}
          >
            {state.creating ? 'Adding…' : 'Add staff member'}
          </button>
        </div>
      </article>
      <div style={{ marginTop: 12 }}>
        {state.error && <div className="tone-red">{state.error}</div>}
        {state.success && <div className="tone-green">{state.success}</div>}
      </div>
    </section>
  );
}
const staffCardStyle = {
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 14,
  padding: 12,
  background: 'rgba(15,23,42,0.32)',
};

const staffSummaryRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 12,
  alignItems: 'start',
};

const scheduleSummaryStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 8,
};

const schedulePillStyle = {
  display: 'inline-flex',
  gap: 4,
  alignItems: 'center',
  maxWidth: '100%',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 999,
  padding: '4px 8px',
  background: 'rgba(255,255,255,0.04)',
  fontSize: 11,
  lineHeight: 1.25,
};

const editPanelStyle = {
  marginTop: 12,
  paddingTop: 12,
  borderTop: '1px solid rgba(255,255,255,0.10)',
};

const weekdayEditGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 8,
};

const dayEditCardStyle = {
  display: 'grid',
  gap: 6,
  padding: 8,
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.03)',
};

const runEditCardStyle = {
  display: 'grid',
  gap: 4,
  padding: 6,
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
};

const compactInputStyle = {
  width: '100%',
  minWidth: 0,
  fontSize: 10,
  padding: '2px 4px',
  minHeight: 22,
};

const compactButtonStyle = {
  width: '100%',
  minHeight: 22,
  padding: '2px 6px',
  fontSize: 10,
};

const compactIconButtonStyle = {
  minWidth: 0,
  minHeight: 22,
  padding: '2px 4px',
  fontSize: 10,
};
