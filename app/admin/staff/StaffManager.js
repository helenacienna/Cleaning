'use client';

import { useMemo, useState } from 'react';
import { DEFAULT_DAY_ROSTER, DEFAULT_SHIFT, WEEKDAY_OPTIONS, formatRosterWindow, normalizeWeeklyRoster } from '../../../lib/staff-roster';

const EMPTY_NEW_STAFF = {
  fullName: '',
  phone: '',
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

export default function StaffManager({ initialStaff = [], facilityOptions = [], source = 'unavailable' }) {
  const [staff, setStaff] = useState(initialStaff);
  const [newStaff, setNewStaff] = useState(EMPTY_NEW_STAFF);
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
          <p className="muted">Keep staff details light, then build each weekday as one day shift with one or more facility runs inside it.</p>
        </div>
        <span className="badge">{liveDataAvailable ? 'Live staff data' : 'Live data unavailable'}</span>
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
            <h4>Staff list</h4>
            <p className="muted">Only the basics for now: name and phone.</p>
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

      <article className="task-card-editor" style={{ marginBottom: 16 }}>
        <div className="panel-title" style={{ marginBottom: 12 }}>
          <div>
            <h4>Weekly spreadsheet</h4>
            <p className="muted">Rows are staff. Each day cell has one overall day shift plus stacked facility runs underneath.</p>
          </div>
          <span className="badge">Easy-read weekly view</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1900, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={headerCellStyle}>Staff</th>
                <th style={headerCellStyle}>Phone</th>
                {WEEKDAY_OPTIONS.map((day) => (
                  <th key={`head-${day.key}`} style={{ ...headerCellStyle, minWidth: 240 }}>{day.label}</th>
                ))}
                <th style={headerCellStyle}>Save</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id} style={{ verticalAlign: 'top', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <td style={bodyCellStyle}>
                    <div style={{ display: 'grid', gap: 8, minWidth: 170 }}>
                      <input
                        type="text"
                        value={member.fullName}
                        onChange={(event) => updateStaff(member.id, 'fullName', event.target.value)}
                        disabled={!liveDataAvailable || state.savingId === member.id}
                        placeholder="Staff name"
                      />
                      <div className="muted">{member.staffCode}</div>
                    </div>
                  </td>
                  <td style={bodyCellStyle}>
                    <input
                      type="text"
                      value={member.phone ?? ''}
                      onChange={(event) => updateStaff(member.id, 'phone', event.target.value)}
                      disabled={!liveDataAvailable || state.savingId === member.id}
                      placeholder="Phone"
                      style={{ minWidth: 140 }}
                    />
                  </td>
                  {WEEKDAY_OPTIONS.map((day) => {
                    const dayRoster = ensureDayEnabled(member.weeklyAvailability?.[day.key]);
                    return (
                      <td key={`${member.id}-${day.key}`} style={{ ...bodyCellStyle, minWidth: 240 }}>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={{ display: 'grid', gap: 6, padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>Day shift</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                              <input
                                type="time"
                                value={dayRoster.start ?? ''}
                                onChange={(event) => updateDay(member.id, day.key, 'start', event.target.value)}
                                disabled={!liveDataAvailable || state.savingId === member.id}
                              />
                              <input
                                type="time"
                                value={dayRoster.finish ?? ''}
                                onChange={(event) => updateDay(member.id, day.key, 'finish', event.target.value)}
                                disabled={!liveDataAvailable || state.savingId === member.id}
                              />
                            </div>
                            <div className="muted">{formatRosterWindow(dayRoster.start, dayRoster.finish) || 'No day shift set'}</div>
                          </div>

                          <div style={{ display: 'grid', gap: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>Facility runs</div>
                            {(dayRoster.shifts ?? []).map((shift, shiftIndex) => (
                              <div key={`${member.id}-${day.key}-${shiftIndex}`} style={{ display: 'grid', gap: 6, padding: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                                <select
                                  value={shift.facilityId ?? ''}
                                  onChange={(event) => updateSubShift(member.id, day.key, shiftIndex, 'facilityId', event.target.value)}
                                  disabled={!liveDataAvailable || state.savingId === member.id}
                                >
                                  <option value="">Select location</option>
                                  {facilityOptions.map((facility) => (
                                    <option key={`${member.id}-${day.key}-${shiftIndex}-${facility.id}`} value={facility.id}>{facility.name}</option>
                                  ))}
                                </select>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                  <input
                                    type="time"
                                    value={shift.start ?? ''}
                                    onChange={(event) => updateSubShift(member.id, day.key, shiftIndex, 'start', event.target.value)}
                                    disabled={!liveDataAvailable || state.savingId === member.id}
                                  />
                                  <input
                                    type="time"
                                    value={shift.finish ?? ''}
                                    onChange={(event) => updateSubShift(member.id, day.key, shiftIndex, 'finish', event.target.value)}
                                    disabled={!liveDataAvailable || state.savingId === member.id}
                                  />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                  <div className="muted" style={{ display: 'grid', gap: 2 }}>
                                    <div>• {facilityLabel(shift, facilitiesById)}</div>
                                    <div>{formatRosterWindow(shift.start, shift.finish) || 'No time set'}</div>
                                  </div>
                                  <button
                                    type="button"
                                    className="button secondary slim"
                                    onClick={() => removeSubShift(member.id, day.key, shiftIndex)}
                                    disabled={!liveDataAvailable || state.savingId === member.id}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="button secondary slim"
                              onClick={() => addSubShift(member.id, day.key)}
                              disabled={!liveDataAvailable || state.savingId === member.id}
                            >
                              Add facility run
                            </button>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td style={bodyCellStyle}>
                    <button
                      type="button"
                      className="button primary"
                      onClick={() => saveStaff(member)}
                      disabled={!liveDataAvailable || state.savingId === member.id || !String(member.fullName ?? '').trim()}
                    >
                      {state.savingId === member.id ? 'Saving…' : 'Save row'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <div style={{ marginTop: 12 }}>
        {state.error && <div className="tone-red">{state.error}</div>}
        {state.success && <div className="tone-green">{state.success}</div>}
      </div>
    </section>
  );
}

const headerCellStyle = {
  position: 'sticky',
  top: 0,
  background: 'var(--card, #111)',
  textAlign: 'left',
  padding: '10px 8px',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
};

const bodyCellStyle = {
  padding: 8,
};
