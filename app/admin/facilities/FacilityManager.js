'use client';

import { useState } from 'react';

export default function FacilityManager({ initialFacilities = [], source = 'unavailable' }) {
  const [facilities, setFacilities] = useState(initialFacilities);
  const [state, setState] = useState({ savingId: null, error: '', success: '' });
  const liveDataAvailable = source === 'prisma';

  function updateFacility(facilityId, field, value) {
    setFacilities((current) => current.map((facility) => (
      facility.id === facilityId ? { ...facility, [field]: value } : facility
    )));
  }

  async function saveFacility(facility) {
    setState({ savingId: facility.id, error: '', success: '' });

    const response = await fetch(`/api/facilities/${facility.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: facility.name,
        active: facility.active,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.facility) {
      setState({ savingId: null, error: payload?.error || 'Unable to save facility.', success: '' });
      return;
    }

    setFacilities((current) => current.map((item) => (item.id === payload.facility.id ? payload.facility : item)));
    setState({ savingId: null, error: '', success: `Saved ${payload.facility.name}.` });
  }

  return (
    <section className="card admin-calendar-shell">
      <div className="panel-title">
        <div>
          <h3>Facility settings</h3>
          <p className="muted">Rename active facilities and control what appears across the app.</p>
        </div>
        <span className="badge">{liveDataAvailable ? 'Live facility settings' : 'Live data unavailable'}</span>
      </div>

      {!liveDataAvailable && (
        <section className="card" style={{ marginBottom: 16 }}>
          <strong>Facility settings unavailable</strong>
          <div className="muted">This screen needs live database access before facility names can be edited.</div>
        </section>
      )}

      <div className="task-card-manager-list">
        {facilities.map((facility) => (
          <article className="task-card-editor" key={facility.id}>
            <div className="panel-title" style={{ marginBottom: 12 }}>
              <div>
                <h4>{facility.facilityCode}</h4>
                <p className="muted">Update the display name used around the app.</p>
              </div>
              <span className={`badge ${facility.active ? '' : 'tone-red'}`}>{facility.active ? 'Active' : 'Inactive'}</span>
            </div>

            <div className="task-detail-grid" style={{ marginBottom: 12 }}>
              <label className="field-label">
                <span>Name</span>
                <input
                  type="text"
                  value={facility.name}
                  onChange={(event) => updateFacility(facility.id, 'name', event.target.value)}
                  disabled={!liveDataAvailable || state.savingId === facility.id}
                />
              </label>

              <label className="field-label">
                <span>Status</span>
                <select
                  value={facility.active ? 'active' : 'inactive'}
                  onChange={(event) => updateFacility(facility.id, 'active', event.target.value === 'active')}
                  disabled={!liveDataAvailable || state.savingId === facility.id}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className="cta-row">
              <button
                type="button"
                className="button primary"
                onClick={() => saveFacility(facility)}
                disabled={!liveDataAvailable || state.savingId === facility.id || !facility.name.trim()}
              >
                {state.savingId === facility.id ? 'Saving…' : 'Save facility'}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        {state.error && <div className="tone-red">{state.error}</div>}
        {state.success && <div className="tone-green">{state.success}</div>}
      </div>
    </section>
  );
}
