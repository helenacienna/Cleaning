'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings));
}

function ThemeColorField({ label, value, onChange }) {
  return (
    <label className="field-label board-theme-colour-field">
      <span>{label}</span>
      <div className="board-theme-colour-input-row">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} />
        <input type="text" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} placeholder="#FFFFFF" />
      </div>
    </label>
  );
}

function StaffPreview({ name, theme }) {
  return (
    <span
      className="button slim board-theme-preview-chip"
      style={{ background: theme.background, borderColor: theme.border, color: theme.text }}
    >
      {name}
    </span>
  );
}

function SurfacePreview({ label, theme }) {
  return (
    <div className="board-theme-surface-preview" style={{ background: theme.background, borderColor: theme.border }}>
      <strong>{label}</strong>
      <span className="muted">Background + border preview</span>
    </div>
  );
}

export default function BoardThemeSettings({ initialSettings, initialTimeZone = 'Australia/Brisbane', timeZoneOptions = [], staffNames = [], facilityNames = [], source = 'unavailable' }) {
  const [settings, setSettings] = useState(() => cloneSettings(initialSettings));
  const [timeZone, setTimeZone] = useState(initialTimeZone);
  const [state, setState] = useState({ saving: false, error: '', success: '' });
  const liveDataAvailable = source === 'prisma';

  const sortedStaffNames = useMemo(() => [...staffNames].sort((a, b) => a.localeCompare(b)), [staffNames]);
  const sortedFacilityNames = useMemo(() => [...facilityNames].sort((a, b) => a.localeCompare(b)), [facilityNames]);

  function updateStaffTheme(name, field, value) {
    setSettings((current) => ({
      ...current,
      staff: {
        ...current.staff,
        [name]: {
          ...(current.staff?.[name] ?? {}),
          [field]: value,
        },
      },
    }));
  }

  function updateFacilityTheme(name, field, value) {
    setSettings((current) => ({
      ...current,
      facilities: {
        ...current.facilities,
        [name]: {
          ...(current.facilities?.[name] ?? {}),
          [field]: value,
        },
      },
    }));
  }

  function updateSectionTheme(sectionKey, field, value) {
    setSettings((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionKey]: {
          ...(current.sections?.[sectionKey] ?? {}),
          [field]: value,
        },
      },
    }));
  }

  async function saveSettings() {
    setState({ saving: true, error: '', success: '' });

    const response = await fetch('/api/app-settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ settings, timeZone }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.settings || !payload?.timeZone) {
      setState({ saving: false, error: payload?.error || 'Unable to save settings.', success: '' });
      return;
    }

    setSettings(cloneSettings(payload.settings));
    setTimeZone(payload.timeZone);
    setState({ saving: false, error: '', success: 'Settings saved.' });
  }

  return (
    <main className="page">
      <section className="card workflow-banner">
        <div>
          <span className="badge">Settings</span>
          <h1 style={{ margin: '12px 0 6px' }}>App settings</h1>
          <p className="muted">Control the business timezone plus staff tag colours, facility board colours, and the daily / periodic / extra tasks section colours.</p>
        </div>
        <div className="workflow-banner-actions">
          <Link className="button secondary" href="/">Back to main board</Link>
          <button type="button" className="button primary" onClick={saveSettings} disabled={!liveDataAvailable || state.saving}>
            {state.saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </section>

      {!liveDataAvailable && (
        <section className="card" style={{ marginBottom: 16 }}>
          <strong>Live settings unavailable</strong>
          <div className="muted">The app needs live database access before these settings can be saved.</div>
        </section>
      )}

      <section className="card board-theme-settings-card" style={{ marginBottom: 18 }}>
        <div className="panel-title">
          <div>
            <h3>Business timezone</h3>
            <p className="muted">This controls what the app treats as “today” for board dates, cleaner pages, and day rollovers.</p>
          </div>
        </div>
        <label className="field-label" style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <span>Timezone</span>
          <select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>
            {timeZoneOptions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="board-theme-settings-grid">
        <article className="card board-theme-settings-card">
          <div className="panel-title">
            <div>
              <h3>Staff name tags</h3>
              <p className="muted">These colours are used for staff assignment tags and related staff chips.</p>
            </div>
          </div>
          <div className="board-theme-settings-list">
            {sortedStaffNames.map((name) => {
              const theme = settings.staff?.[name];
              return (
                <div className="board-theme-settings-item" key={name}>
                  <div className="board-theme-settings-item-header">
                    <div>
                      <strong>{name}</strong>
                      <div className="muted">Tag background, border, and text colour.</div>
                    </div>
                    {theme ? <StaffPreview name={name} theme={theme} /> : null}
                  </div>
                  <div className="board-theme-input-grid">
                    <ThemeColorField label="Background" value={theme?.background ?? '#E2E8F0'} onChange={(value) => updateStaffTheme(name, 'background', value)} />
                    <ThemeColorField label="Border" value={theme?.border ?? '#94A3B8'} onChange={(value) => updateStaffTheme(name, 'border', value)} />
                    <ThemeColorField label="Text" value={theme?.text ?? '#0F172A'} onChange={(value) => updateStaffTheme(name, 'text', value)} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="card board-theme-settings-card">
          <div className="panel-title">
            <div>
              <h3>Facility boards</h3>
              <p className="muted">These colours control facility board card backgrounds and borders.</p>
            </div>
          </div>
          <div className="board-theme-settings-list">
            {sortedFacilityNames.map((name) => {
              const theme = settings.facilities?.[name];
              return (
                <div className="board-theme-settings-item" key={name}>
                  <div className="board-theme-settings-item-header">
                    <div>
                      <strong>{name}</strong>
                      <div className="muted">Facility background and border colour.</div>
                    </div>
                    {theme ? <SurfacePreview label={name} theme={theme} /> : null}
                  </div>
                  <div className="board-theme-input-grid board-theme-input-grid-2up">
                    <ThemeColorField label="Background" value={theme?.background ?? '#FFFFFF'} onChange={(value) => updateFacilityTheme(name, 'background', value)} />
                    <ThemeColorField label="Border" value={theme?.border ?? '#CBD5E1'} onChange={(value) => updateFacilityTheme(name, 'border', value)} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="card board-theme-settings-card">
        <div className="panel-title">
          <div>
            <h3>Section colours</h3>
            <p className="muted">Choose the colours for Daily, Periodic, and Extra tasks sections.</p>
          </div>
        </div>
        <div className="board-theme-settings-list board-theme-section-list">
          {[
            ['daily', 'Daily tasks'],
            ['periodic', 'Periodic tasks'],
            ['unscheduled', 'Extra tasks'],
          ].map(([sectionKey, label]) => {
            const theme = settings.sections?.[sectionKey];
            return (
              <div className="board-theme-settings-item" key={sectionKey}>
                <div className="board-theme-settings-item-header">
                  <div>
                    <strong>{label}</strong>
                    <div className="muted">Section background and border colour.</div>
                  </div>
                  {theme ? <SurfacePreview label={label} theme={theme} /> : null}
                </div>
                <div className="board-theme-input-grid board-theme-input-grid-2up">
                  <ThemeColorField label="Background" value={theme?.background ?? '#FFFFFF'} onChange={(value) => updateSectionTheme(sectionKey, 'background', value)} />
                  <ThemeColorField label="Border" value={theme?.border ?? '#CBD5E1'} onChange={(value) => updateSectionTheme(sectionKey, 'border', value)} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {(state.error || state.success) ? (
        <section className="card">
          {state.error ? <div className="tone-red">{state.error}</div> : null}
          {state.success ? <div className="tone-green">{state.success}</div> : null}
        </section>
      ) : null}
    </main>
  );
}
