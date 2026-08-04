'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StaffOnlinePanel({ staffStatuses = [] }) {
  const router = useRouter();
  const [state, setState] = useState({ staffCode: '', error: '' });
  const onlineCount = staffStatuses.filter((member) => member.online).length;

  async function handleMessage(member) {
    setState({ staffCode: member.staffCode, error: '' });
    const response = await fetch('/api/inbox/staff-direct', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ staffCode: member.staffCode }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.href) {
      setState({ staffCode: '', error: payload?.error || `Unable to open message thread for ${member.fullName}.` });
      return;
    }
    router.push(payload.href);
  }

  return (
    <section className="card admin-calendar-shell staff-online-status-shell facility-board-staff-online-shell">
      <div className="panel-title">
        <div>
          <h3>Staff online status</h3>
          <p className="muted">Active app sessions, recent task completion, and quick staff messages.</p>
        </div>
        <span className="badge">{onlineCount}/{staffStatuses.length} online</span>
      </div>

      {state.error ? <div className="tone-red" style={{ marginBottom: 10 }}>{state.error}</div> : null}

      {!staffStatuses.length ? (
        <div className="muted">No active staff records found yet.</div>
      ) : (
        <div className="staff-online-status-grid">
          {staffStatuses.map((member) => (
            <article className="staff-online-status-card" key={member.id}>
              <div className="staff-online-status-main">
                <span className={`staff-online-dot ${member.online ? 'staff-online-dot-on' : ''}`} aria-hidden="true" />
                <div>
                  <strong>{member.fullName}</strong>
                  <div className="muted">{member.roleLabel || member.role} · {member.staffCode}</div>
                </div>
              </div>
              <div className="staff-online-status-meta">
                <span className={`badge ${member.online ? 'tone-green' : ''}`}>{member.online ? 'Online now' : `Last seen ${member.lastSeenAgo}`}</span>
                {member.deviceCount ? <span className="flag">{member.deviceCount} device{member.deviceCount === 1 ? '' : 's'}</span> : null}
              </div>
              <div className="staff-last-task">
                <span className="muted">Last task</span>
                <strong>{member.lastTaskTitle || 'No completed tasks yet'}</strong>
                {member.lastTaskTitle ? <div className="muted">{[member.lastTaskFacility, member.lastTaskZone].filter(Boolean).join(' · ')} · {member.lastTaskAgo}</div> : null}
              </div>
              <button
                className="button primary slim staff-message-button"
                type="button"
                onClick={() => handleMessage(member)}
                disabled={state.staffCode === member.staffCode}
              >
                {state.staffCode === member.staffCode ? 'Opening…' : `Message ${member.fullName}`}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
