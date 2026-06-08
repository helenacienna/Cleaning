'use client';

import { useMemo, useState } from 'react';

const FREQUENCY_OPTIONS = [
  { value: 'none', label: 'None / manual' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

const PRIORITY_OPTIONS = [
  { value: 'Critical', label: 'Critical' },
  { value: 'Standard', label: 'Standard' },
  { value: 'Optional', label: 'Optional' },
];

const REQUIREMENT_OPTIONS = [
  'Standard',
  'Random photo eligible',
  'Comment on exception',
  'Forced photo',
];

function buildInitialDraft(card) {
  return {
    title: card.title,
    templateId: card.templateId,
    jobOrderNumber: card.jobOrderNumber,
    taskGroup: card.taskGroup,
    zone: card.zone,
    facility: card.facility,
    frequency: String(card.frequency ?? 'none').toLowerCase(),
    frequencyType: card.frequencyType === 'Suggestive' ? 'Standard' : card.frequencyType,
    cadenceMode: card.cadenceMode,
    designatedDay: card.designatedDay,
    required: card.required,
    estimatedMinutes: String(card.estimatedMinutes ?? ''),
    lastCompleted: card.lastCompleted,
    suggestedDue: card.suggestedDue,
    notes: card.notes,
    active: card.active,
  };
}

function formatEstimatedTimeRequired(estimatedMinutes) {
  const minutes = Number(estimatedMinutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '—';
  }
  return `${minutes} min`;
}

function formatRuntimeDate(value) {
  if (!value || value === '—') {
    return '—';
  }
  return value;
}

export default function TaskCardManager({ cards, zones }) {
  const [taskCards, setTaskCards] = useState(cards);
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('All zones');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedCard = taskCards.find((card) => card.id === selectedId) ?? taskCards[0] ?? null;
  const [draft, setDraft] = useState(selectedCard ? buildInitialDraft(selectedCard) : null);

  const filteredCards = useMemo(() => (
    taskCards.filter((card) => {
      const matchesSearch = !search || [card.title, card.taskGroup, card.zone, card.jobOrderNumber, card.templateId]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesZone = zoneFilter === 'All zones' || card.zone === zoneFilter;
      const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? card.active : !card.active);
      return matchesSearch && matchesZone && matchesStatus;
    })
  ), [taskCards, search, zoneFilter, statusFilter]);

  function handleSelect(card) {
    setSelectedId(card.id);
    setDraft(buildInitialDraft(card));
    setNotice('');
  }

  function handleDraftChange(field, value) {
    setDraft((existing) => ({ ...existing, [field]: value }));
  }

  async function handleSave() {
    if (!selectedCard || !draft || isSaving) {
      return;
    }

    setIsSaving(true);
    setNotice('');

    try {
      const response = await fetch(`/api/task-templates/${selectedCard.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draft),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.card) {
        throw new Error(payload?.error || 'Save failed');
      }

      setTaskCards((existing) => existing.map((card) => (
        card.id === selectedCard.id ? payload.card : card
      )));
      setDraft(buildInitialDraft(payload.card));
      setNotice(`Saved changes to ${payload.card.title}.`);
    } catch (error) {
      setNotice(error.message || 'Could not save task card.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!selectedCard || !draft) {
    return null;
  }

  return (
    <section className="card task-card-page-shell">
      <div className="admin-calendar-header">
        <div>
          <h2>Task cards</h2>
          <p className="muted">Manage reusable task card templates that feed organiser scheduling and runtime task instances.</p>
        </div>
        <div className="admin-calendar-controls">
          <span className="badge">{taskCards.length} templates</span>
          <span className="badge">{taskCards.filter((card) => card.active).length} active</span>
          <span className="button primary">Create task card</span>
        </div>
      </div>

      <div className="task-card-layout">
        <aside className="task-card-sidebar">
          <div className="task-card-filters">
            <label className="field-label">
              <span>Search</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find by title, group, zone or order" />
            </label>
            <div className="filter-row">
              <label className="field-label">
                <span>Zone</span>
                <select value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}>
                  <option>All zones</option>
                  {zones.map((zone) => <option key={zone}>{zone}</option>)}
                </select>
              </label>
              <label className="field-label">
                <span>Status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>All</option>
                </select>
              </label>
            </div>
          </div>

          <div className="task-card-list">
            {filteredCards.map((card) => (
              <button
                className={`task-card-list-item ${card.id === selectedCard.id ? 'selected-task-card' : ''}`}
                type="button"
                key={card.id}
                onClick={() => handleSelect(card)}
              >
                <div className="task-card-list-top">
                  <strong>{card.title}</strong>
                  <span className={`frequency-type ${card.frequencyType === 'Critical' ? 'frequency-critical' : 'frequency-suggestive'}`}>{card.frequencyType}</span>
                </div>
                <span className="muted">#{card.jobOrderNumber} · {card.taskGroup}</span>
                <span className="muted">{card.facility} · {card.zone}</span>
                <span className="muted">Estimated time: {formatEstimatedTimeRequired(card.estimatedMinutes)}</span>
                {card.frequency === 'weekly' && <span className="muted">Cadence: {card.cadenceMode} · Day: {card.designatedDay}</span>}
              </button>
            ))}
          </div>
        </aside>

        <div className="task-card-editor-shell">
          <div className="task-card-header-card">
            <div>
              <span className="muted">Template ID</span>
              <h3>{selectedCard.templateId}</h3>
            </div>
            <div className="task-card-chip-row">
              <span className="badge">Job #{draft.jobOrderNumber}</span>
              <span className="badge">{draft.facility}</span>
              <span className="badge">{draft.zone}</span>
              <span className="badge">{formatEstimatedTimeRequired(draft.estimatedMinutes)}</span>
              {draft.frequency === 'weekly' && <span className="badge">{draft.cadenceMode} · {draft.designatedDay}</span>}
            </div>
          </div>

          <div className="task-card-form-grid">
            <label className="field-label span-2">
              <span>Task title</span>
              <input value={draft.title} onChange={(event) => handleDraftChange('title', event.target.value)} />
            </label>
            <label className="field-label">
              <span>Job order number</span>
              <input value={draft.jobOrderNumber} onChange={(event) => handleDraftChange('jobOrderNumber', event.target.value)} />
            </label>
            <label className="field-label">
              <span>Task group</span>
              <input value={draft.taskGroup} disabled />
            </label>
            <label className="field-label">
              <span>Zone</span>
              <select value={draft.zone} disabled>
                {zones.map((zone) => <option key={zone}>{zone}</option>)}
              </select>
            </label>
            <label className="field-label">
              <span>Facility</span>
              <input value={draft.facility} disabled />
            </label>
            <label className="field-label">
              <span>Frequency</span>
              <select value={draft.frequency} onChange={(event) => handleDraftChange('frequency', event.target.value)}>
                {FREQUENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="field-label">
              <span>Priority type</span>
              <select value={draft.frequencyType} onChange={(event) => handleDraftChange('frequencyType', event.target.value)}>
                {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {draft.frequency === 'weekly' && (
              <>
                <label className="field-label">
                  <span>Weekly cadence</span>
                  <select value={draft.cadenceMode} onChange={(event) => handleDraftChange('cadenceMode', event.target.value)}>
                    <option>Anchored</option>
                    <option>Rolling</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>Designated day</span>
                  <select value={draft.designatedDay} onChange={(event) => handleDraftChange('designatedDay', event.target.value)}>
                    <option>MON</option>
                    <option>TUE</option>
                    <option>WED</option>
                    <option>THU</option>
                    <option>FRI</option>
                    <option>SAT</option>
                    <option>SUN</option>
                  </select>
                </label>
              </>
            )}
            <label className="field-label">
              <span>Requirement</span>
              <select value={draft.required} onChange={(event) => handleDraftChange('required', event.target.value)}>
                {REQUIREMENT_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="field-label">
              <span>Estimated time required (minutes)</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={draft.estimatedMinutes}
                onChange={(event) => handleDraftChange('estimatedMinutes', event.target.value)}
                placeholder="e.g. 12"
              />
            </label>
            <label className="field-label">
              <span>Last completed</span>
              <input value={formatRuntimeDate(draft.lastCompleted)} disabled />
            </label>
            <label className="field-label">
              <span>Suggested due</span>
              <input value={formatRuntimeDate(draft.suggestedDue)} disabled />
            </label>
            <label className="field-label span-2">
              <span>Notes / description</span>
              <textarea rows="5" value={draft.notes} onChange={(event) => handleDraftChange('notes', event.target.value)} />
            </label>
            <label className="checkbox-row span-2">
              <input type="checkbox" checked={draft.active} onChange={(event) => handleDraftChange('active', event.target.checked)} />
              <span>Task card is active and available for scheduling</span>
            </label>
          </div>

          <div className="task-card-actions">
            <div>
              {notice ? <span className="save-notice">{notice}</span> : <span className="muted">Saving now writes to the real task template record. Runtime status dates remain read-only here.</span>}
            </div>
            <div className="cta-row no-top-gap">
              <button className="button secondary" type="button" onClick={() => handleSelect(selectedCard)} disabled={isSaving}>Reset changes</button>
              <button className="button primary" type="button" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save task card'}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
