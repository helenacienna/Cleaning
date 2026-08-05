'use client';

import Link from 'next/link';

export default function StaffOnlinePanel({ staffStatuses = [] }) {
  const onlineCount = staffStatuses.filter((member) => member.online).length;

  return (
    <section className="card admin-calendar-shell staff-online-status-shell facility-board-staff-online-shell">
      <div className="panel-title">
        <div>
          <h3>Staff online status</h3>
          <p className="muted">Active app sessions, recent task completion, and quick staff messages.</p>
        </div>
        <span className="badge">{onlineCount}/{staffStatuses.length} online</span>
      </div>

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
              <Link className="button primary slim staff-message-button" href="/admin/inbox?audience=staff">
                Chat
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
