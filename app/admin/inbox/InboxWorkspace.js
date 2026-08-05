'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const THREAD_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'operational_alert', label: 'Alerts' },
  { key: 'group', label: 'Groups' },
  { key: 'manual', label: 'Manual' },
];

const THREAD_STATUSES = ['open', 'watch', 'resolved'];

function toneForKind(kind) {
  if (kind === 'alert') return 'status-carried-forward';
  if (kind === 'status') return 'status-photo-required';
  return 'status-completed';
}

function matchesThreadFilter(thread, activeFilter) {
  if (activeFilter === 'unread') return thread.unreadCount > 0;
  if (activeFilter === 'manual') return thread.scope === 'manual';
  if (activeFilter === 'all') return true;
  return thread.type === activeFilter;
}

export default function InboxWorkspace({
  initialThreads,
  initialThread,
  source,
  senderOptions = [],
  participantOptions = [],
  audienceLabel = 'Manager',
}) {
  const liveDataAvailable = source === 'prisma';
  const isMaintenanceStyle = audienceLabel.toLowerCase() === 'staff';
  const isSimpleChat = true;
  const isContactChat = audienceLabel.toLowerCase() === 'staff';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedThread, setSelectedThread] = useState(initialThread);
  const [threads, setThreads] = useState(initialThreads);
  const [senderStaffCode, setSenderStaffCode] = useState(senderOptions[0]?.value ?? 'MGR001');
  const [messageBody, setMessageBody] = useState('');
  const [attachments, setAttachments] = useState([{ label: '', url: '' }]);
  const [searchValue, setSearchValue] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadForm, setNewThreadForm] = useState({
    title: '',
    subtitle: '',
    audience: audienceLabel.toLowerCase() === 'staff' ? 'staff' : 'manager',
    senderStaffCode: senderOptions[0]?.value ?? 'MGR001',
    participantStaffCodes: [],
  });
  const [composerState, setComposerState] = useState({ saving: false, error: '', success: '' });
  const [threadCreateState, setThreadCreateState] = useState({ saving: false, error: '', success: '' });
  const [statusState, setStatusState] = useState({ saving: false, error: '', success: '' });
  const [openingContact, setOpeningContact] = useState('');
  const [contactError, setContactError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setThreads(initialThreads);
  }, [initialThreads]);

  useEffect(() => {
    setSelectedThread(initialThread);
  }, [initialThread]);

  useEffect(() => {
    if (!senderOptions.length) return;
    setSenderStaffCode((current) => current || senderOptions[0].value);
    setNewThreadForm((current) => ({
      ...current,
      senderStaffCode: current.senderStaffCode || senderOptions[0].value,
    }));
  }, [senderOptions]);

  useEffect(() => {
    if (!selectedThread?.id) return;

    fetch(`/api/inbox/threads/${selectedThread.id}/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ participantStaffCode: senderOptions[0]?.value ?? null }),
    }).catch(() => null);

    setThreads((currentThreads) => currentThreads.map((thread) => (
      thread.id === selectedThread.id
        ? { ...thread, unreadCount: 0 }
        : thread
    )));
  }, [selectedThread?.id, senderOptions]);

  useEffect(() => {
    if (!liveDataAvailable) return undefined;

    const intervalId = window.setInterval(async () => {
      const audienceParam = audienceLabel.toLowerCase();
      const params = new URLSearchParams({ audience: audienceParam, limit: '20' });
      const threadsResponse = await fetch(`/api/inbox/threads?${params.toString()}`, { cache: 'no-store' }).catch(() => null);
      const threadsPayload = threadsResponse ? await threadsResponse.json().catch(() => null) : null;

      if (threadsResponse?.ok && Array.isArray(threadsPayload?.threads)) {
        setThreads(threadsPayload.threads);
      }

      if (selectedThread?.id) {
        const threadResponse = await fetch(`/api/inbox/threads/${selectedThread.id}/messages`, { cache: 'no-store' }).catch(() => null);
        const threadPayload = threadResponse ? await threadResponse.json().catch(() => null) : null;

        if (threadResponse?.ok && threadPayload?.thread) {
          setSelectedThread(threadPayload.thread);
        }
      }
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [selectedThread?.id, liveDataAvailable, audienceLabel]);

  const filteredThreads = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    return threads.filter((thread) => {
      if (!matchesThreadFilter(thread, activeFilter)) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [thread.title, thread.subtitle, thread.lastMessagePreview, thread.scope, thread.type]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [activeFilter, searchValue, threads]);

  const unreadCount = useMemo(
    () => threads.reduce((sum, thread) => sum + (thread.unreadCount ?? 0), 0),
    [threads],
  );

  const staffContacts = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    return participantOptions
      .filter((contact) => contact.value !== senderStaffCode)
      .filter((contact) => !term || contact.label.toLowerCase().includes(term))
      .map((contact) => {
        const matchingThread = threads.find((thread) => thread.type === 'direct' && thread.participants?.some((participant) => participant.staffCode === contact.value));
        return {
          ...contact,
          thread: matchingThread,
          unreadCount: matchingThread?.unreadCount ?? 0,
          preview: matchingThread?.lastMessagePreview ?? 'Tap to start a direct chat',
          formattedTime: matchingThread?.formattedTime ?? '',
          active: Boolean(selectedThread?.participants?.some((participant) => participant.staffCode === contact.value)),
        };
      });
  }, [participantOptions, searchValue, selectedThread?.participants, senderStaffCode, threads]);

  const filterCounts = useMemo(() => ({
    all: threads.length,
    unread: threads.filter((thread) => thread.unreadCount > 0).length,
    operational_alert: threads.filter((thread) => thread.type === 'operational_alert').length,
    group: threads.filter((thread) => thread.type === 'group').length,
    manual: threads.filter((thread) => thread.scope === 'manual').length,
  }), [threads]);

  const groupChats = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    return threads
      .filter((thread) => thread.type === 'group')
      .filter((thread) => !term || [thread.title, thread.subtitle, thread.lastMessagePreview].filter(Boolean).some((value) => value.toLowerCase().includes(term)));
  }, [searchValue, threads]);

  async function handleRefresh() {
    if (!liveDataAvailable) return;
    const audienceParam = audienceLabel.toLowerCase();
    const params = new URLSearchParams({ audience: audienceParam, limit: '20' });
    const threadsResponse = await fetch(`/api/inbox/threads?${params.toString()}`, { cache: 'no-store' }).catch(() => null);
    const threadsPayload = threadsResponse ? await threadsResponse.json().catch(() => null) : null;
    if (threadsResponse?.ok && Array.isArray(threadsPayload?.threads)) {
      setThreads(threadsPayload.threads);
    }
    if (selectedThread?.id) {
      const threadResponse = await fetch(`/api/inbox/threads/${selectedThread.id}/messages`, { cache: 'no-store' }).catch(() => null);
      const threadPayload = threadResponse ? await threadResponse.json().catch(() => null) : null;
      if (threadResponse?.ok && threadPayload?.thread) {
        setSelectedThread(threadPayload.thread);
      }
    }
  }

  function handleBack() {
    if (isMaintenanceStyle && selectedThread?.id && window.matchMedia('(max-width: 760px)').matches) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('thread');
      startTransition(() => {
        router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
      });
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    router.push(audienceLabel.toLowerCase() === 'staff' ? '/cleaner' : '/');
  }

  async function handleSelectThread(threadId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('thread', threadId);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  async function handleSelectContact(contact) {
    if (!contact?.value || openingContact) return;
    setOpeningContact(contact.value);
    setContactError('');
    const response = await fetch('/api/inbox/staff-direct', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ staffCode: contact.value }),
    });
    const payload = await response.json().catch(() => null);
    setOpeningContact('');
    if (!response.ok || !payload?.href) {
      setContactError(payload?.error || `Unable to open chat with ${contact.label}.`);
      return;
    }
    router.push(payload.href);
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!selectedThread?.id || !messageBody.trim()) {
      return;
    }

    setComposerState({ saving: true, error: '', success: '' });

    const messageAttachments = attachments
      .map((item) => ({ label: item.label.trim(), url: item.url.trim(), type: 'link' }))
      .filter((item) => item.label && item.url);

    const response = await fetch(`/api/inbox/threads/${selectedThread.id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ senderStaffCode, body: messageBody.trim(), attachments: messageAttachments }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setComposerState({ saving: false, error: payload?.error || 'Unable to send message.', success: '' });
      return;
    }

    const newMessage = payload?.message;
    if (newMessage) {
      const nextThread = {
        ...(selectedThread || {}),
        lastMessageAt: newMessage.createdAt,
        lastMessagePreview: newMessage.body,
        formattedTime: newMessage.formattedTime,
        messages: [...(selectedThread?.messages ?? []), newMessage],
      };

      setSelectedThread(nextThread);
      setThreads((currentThreads) => {
        const existing = currentThreads.find((thread) => thread.id === selectedThread.id);
        const merged = {
          ...(existing || selectedThread),
          lastMessageAt: newMessage.createdAt,
          lastMessagePreview: newMessage.body,
          formattedTime: newMessage.formattedTime,
          unreadCount: 0,
        };
        return [merged, ...currentThreads.filter((thread) => thread.id !== selectedThread.id)];
      });
    }

    setMessageBody('');
    setAttachments([{ label: '', url: '' }]);
    setComposerState({ saving: false, error: '', success: 'Reply sent.' });
  }

  function updateAttachment(index, field, value) {
    setAttachments((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  function addAttachmentRow() {
    setAttachments((current) => [...current, { label: '', url: '' }]);
  }

  function removeAttachmentRow(index) {
    setAttachments((current) => (current.length === 1 ? [{ label: '', url: '' }] : current.filter((_, itemIndex) => itemIndex !== index)));
  }

  async function handleStatusChange(status) {
    if (!selectedThread?.id || selectedThread.status === status) {
      return;
    }

    setStatusState({ saving: true, error: '', success: '' });

    const response = await fetch(`/api/inbox/threads/${selectedThread.id}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.thread) {
      setStatusState({ saving: false, error: payload?.error || 'Unable to update thread status.', success: '' });
      return;
    }

    setSelectedThread(payload.thread);
    setThreads((currentThreads) => currentThreads.map((thread) => (thread.id === payload.thread.id ? payload.thread : thread)));
    setStatusState({ saving: false, error: '', success: `Thread marked ${status}.` });
  }

  async function handleCreateThread(event) {
    event.preventDefault();

    if (!newThreadForm.title.trim()) {
      setThreadCreateState({ saving: false, error: 'Thread title is required.', success: '' });
      return;
    }

    setThreadCreateState({ saving: true, error: '', success: '' });

    const response = await fetch('/api/inbox/threads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: newThreadForm.title.trim(),
        subtitle: newThreadForm.subtitle.trim(),
        audience: newThreadForm.audience,
        senderStaffCode: newThreadForm.senderStaffCode,
        participantStaffCodes: newThreadForm.participantStaffCodes,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.thread) {
      setThreadCreateState({ saving: false, error: payload?.error || 'Unable to create thread.', success: '' });
      return;
    }

    const createdThread = payload.thread;
    setThreads((currentThreads) => [createdThread, ...currentThreads.filter((thread) => thread.id !== createdThread.id)]);
    setSelectedThread(createdThread);
    setShowNewThread(false);
    setSearchValue('');
    setActiveFilter('all');
    setNewThreadForm({
      title: '',
      subtitle: '',
      audience: audienceLabel.toLowerCase() === 'staff' ? 'staff' : 'manager',
      senderStaffCode: senderOptions[0]?.value ?? 'MGR001',
      participantStaffCodes: [],
    });
    setThreadCreateState({ saving: false, error: '', success: 'Thread created.' });
    const params = new URLSearchParams(searchParams.toString());
    params.set('thread', createdThread.id);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleParticipantToggle(staffCode) {
    setNewThreadForm((current) => ({
      ...current,
      participantStaffCodes: current.participantStaffCodes.includes(staffCode)
        ? current.participantStaffCodes.filter((item) => item !== staffCode)
        : [...current.participantStaffCodes, staffCode],
    }));
  }

  return (
    <section className={`inbox-shell google-chat-shell ${isMaintenanceStyle ? 'maintenance-chat-shell' : ''} ${selectedThread ? 'thread-open' : ''}`}>
      <aside className="card inbox-sidebar">
        {isMaintenanceStyle ? (
          <div className="maintenance-chat-topbar">
            <div className="maintenance-chat-brand">
              <span className="maintenance-chat-logo">CC</span>
              <div>
                <strong>Staff</strong>
                <span>Choose a contact</span>
              </div>
            </div>
            <div className="maintenance-chat-actions">
              <button className="top-action" type="button" onClick={handleBack}>← Back</button>
              <button className="top-action" type="button" onClick={handleRefresh} disabled={!liveDataAvailable}>Refresh</button>
            </div>
          </div>
        ) : (
          <div className="panel-title">
            <div>
              <h3>Conversations</h3>
              <p className="muted">Open a conversation to read and reply.</p>
            </div>
            <span className="badge">{threads.length}</span>
          </div>
        )}

        {isMaintenanceStyle && <div className="threads-head">Staff</div>}

        <div className="inbox-sidebar-tools">
          <label className="inbox-search-field">
            <span className="muted">Search</span>
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={isContactChat ? 'Search staff…' : 'Search conversations…'}
              type="search"
            />
          </label>

          {!isSimpleChat && <div className="inbox-filter-row">
            {THREAD_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`inbox-filter-chip ${activeFilter === filter.key ? 'inbox-filter-chip-active' : ''}`}
                onClick={() => setActiveFilter(filter.key)}
                disabled={!liveDataAvailable}
              >
                <span>{filter.label}</span>
                <strong>{filterCounts[filter.key] ?? 0}</strong>
              </button>
            ))}
          </div>}

          <div className="inbox-sidebar-actions">
            <span className={`badge ${unreadCount ? 'tone-red' : ''}`}>{unreadCount} unread</span>
            {!isContactChat && <button className="button secondary" type="button" onClick={() => setShowNewThread((current) => !current)} disabled={!liveDataAvailable}>
              {showNewThread ? 'Close' : 'New chat'}
            </button>}
          </div>
        </div>

        {showNewThread && liveDataAvailable && (
          <form className="inbox-new-thread-card" onSubmit={handleCreateThread}>
            <div className="panel-title" style={{ marginBottom: 0 }}>
              <div>
                <h4>{isMaintenanceStyle ? 'New staff message' : 'New internal thread'}</h4>
                <p className="muted">Start a clean operational conversation inside the platform.</p>
              </div>
            </div>

            <label className="inbox-search-field">
              <span className="muted">Title</span>
              <input
                value={newThreadForm.title}
                onChange={(event) => setNewThreadForm((current) => ({ ...current, title: event.target.value }))}
                placeholder={isMaintenanceStyle ? 'Example: Message for Tony' : 'Example: North foyer follow-up' }
                type="text"
              />
            </label>

            <label className="inbox-search-field">
              <span className="muted">Opening note</span>
              <textarea
                rows={3}
                value={newThreadForm.subtitle}
                onChange={(event) => setNewThreadForm((current) => ({ ...current, subtitle: event.target.value }))}
                placeholder="State the issue, expectation, or next step clearly…"
              />
            </label>

            {!isMaintenanceStyle && <div className="inbox-new-thread-grid">
              <label className="field-label inbox-field-compact">
                <span>Audience</span>
                <select value={newThreadForm.audience} onChange={(event) => setNewThreadForm((current) => ({ ...current, audience: event.target.value }))}>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="cleaner">Cleaner</option>
                </select>
              </label>

              <label className="field-label inbox-field-compact">
                <span>Send as</span>
                <select value={newThreadForm.senderStaffCode} onChange={(event) => setNewThreadForm((current) => ({ ...current, senderStaffCode: event.target.value }))}>
                  {senderOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>}

            <div className="inbox-picker-block">
              <span className="muted">Participants</span>
              <div className="inbox-participant-picker">
                {participantOptions.map((option) => {
                  const isSelected = newThreadForm.participantStaffCodes.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`inbox-picker-chip ${isSelected ? 'inbox-picker-chip-active' : ''}`}
                      onClick={() => handleParticipantToggle(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="inbox-composer-actions">
              <div>
                {threadCreateState.error && <div className="tone-red">{threadCreateState.error}</div>}
                {threadCreateState.success && <div className="tone-green">{threadCreateState.success}</div>}
              </div>
              <button className="button primary" type="submit" disabled={threadCreateState.saving || isPending || !liveDataAvailable}>
                {threadCreateState.saving ? 'Creating…' : 'Create thread'}
              </button>
            </div>
          </form>
        )}

        <div className={`inbox-thread-list ${isContactChat ? 'contact-list' : ''}`}>
          {isContactChat && groupChats.length ? (
            <div className="chat-list-section">
              <div className="chat-list-section-title">Group chats</div>
              {groupChats.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className={`inbox-thread-card contact-card group-chat-card ${thread.id === selectedThread?.id ? 'inbox-thread-card-active' : ''}`}
                  onClick={() => handleSelectThread(thread.id)}
                >
                  <span className="contact-avatar group-avatar">#</span>
                  <span className="contact-main">
                    <span className="inbox-thread-card-top">
                      <strong>{thread.title}</strong>
                      <span className="muted">{thread.formattedTime}</span>
                    </span>
                    <span className="muted contact-role">Group chat · {thread.participantCount} people</span>
                    <span className="inbox-thread-preview">{thread.lastMessagePreview}</span>
                  </span>
                  {thread.unreadCount ? <span className="contact-unread">{thread.unreadCount}</span> : null}
                </button>
              ))}
            </div>
          ) : null}

          {isContactChat ? (
            <div className="chat-list-section">
              <div className="chat-list-section-title">Staff</div>
              {staffContacts.map((contact) => (
            <button
              key={contact.value}
              type="button"
              className={`inbox-thread-card contact-card ${contact.active ? 'inbox-thread-card-active' : ''}`}
              onClick={() => handleSelectContact(contact)}
              disabled={openingContact === contact.value}
            >
              <span className="contact-avatar">{contact.label.split(' ')[0]?.slice(0, 1) || 'S'}</span>
              <span className="contact-main">
                <span className="inbox-thread-card-top">
                  <strong>{contact.label.split(' · ')[0]}</strong>
                  <span className="muted">{openingContact === contact.value ? 'Opening…' : contact.formattedTime}</span>
                </span>
                <span className="muted contact-role">{contact.label.split(' · ')[1] || 'Staff'}</span>
                <span className="inbox-thread-preview">{contact.preview}</span>
              </span>
              {contact.unreadCount ? <span className="contact-unread">{contact.unreadCount}</span> : null}
            </button>
              ))}
            </div>
          ) : filteredThreads.map((thread) => {
            const isActive = thread.id === selectedThread?.id;
            return (
              <button
                key={thread.id}
                type="button"
                className={`inbox-thread-card ${isActive ? 'inbox-thread-card-active' : ''}`}
                onClick={() => handleSelectThread(thread.id)}
              >
                <div className="inbox-thread-card-top">
                  <strong>{thread.title}</strong>
                  <span className="muted">{thread.formattedTime}</span>
                </div>
                {thread.subtitle && <div className="muted">{thread.subtitle}</div>}
                <div className="inbox-thread-preview">{thread.lastMessagePreview}</div>
                <div className="flag-row">
                  <span className="flag">{thread.type.replace('_', ' ')}</span>
                  <span className="flag">{thread.participantCount} people</span>
                  {thread.unreadCount ? <span className="task-status status-carried-forward">{thread.unreadCount} unread</span> : <span className="flag">Read</span>}
                </div>
              </button>
            );
          })}
          {contactError ? <div className="inbox-empty-list tone-red">{contactError}</div> : null}
          {!liveDataAvailable && <div className="inbox-empty-list muted">Live inbox data is unavailable.</div>}
          {liveDataAvailable && isContactChat && !staffContacts.length && <div className="inbox-empty-list muted">No staff match this search.</div>}
          {liveDataAvailable && !isContactChat && !filteredThreads.length && <div className="inbox-empty-list muted">No conversations match this search.</div>}
        </div>
      </aside>

      <div className="card inbox-main-column">
        {selectedThread ? (
          <>
            <div className="inbox-thread-header">
              <div>
                {!isMaintenanceStyle && <span className="badge">{selectedThread.scope || 'internal thread'}</span>}
                <h2>{selectedThread.title}</h2>
                {selectedThread.subtitle && <p className="muted">{selectedThread.subtitle}</p>}
              </div>
              <div className="flag-row">
                <span className="flag">{selectedThread.participantCount} participants</span>
                <span className="flag">{selectedThread.messageCount ?? selectedThread.messages?.length ?? 0} messages</span>
                {!isMaintenanceStyle && <span className="flag">{selectedThread.status}</span>}
              </div>
            </div>

            {!isSimpleChat && <div className="inbox-status-row">
              {THREAD_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`inbox-filter-chip ${selectedThread.status === status ? 'inbox-filter-chip-active' : ''}`}
                  onClick={() => handleStatusChange(status)}
                  disabled={statusState.saving || !liveDataAvailable}
                >
                  {status}
                </button>
              ))}
              <div className="muted">
                {statusState.error || statusState.success || (liveDataAvailable ? 'Use status to keep threads open, watched, or resolved.' : 'Status changes are disabled until live inbox data is available.')}
              </div>
            </div>}

            <div className="inbox-message-stream">
              {(selectedThread.messages ?? []).map((message) => {
                const isOwnMessage = message.senderKey === `staff:${senderStaffCode}`;
                return (
                <article className={`inbox-message-card ${isMaintenanceStyle ? (isOwnMessage ? 'msg admin' : 'msg resident') : ''}`} key={message.id}>
                  <div className="inbox-message-meta">
                    <div>
                      <strong>{message.senderName}</strong>
                      <span className="muted">{message.formattedTime}</span>
                    </div>
                    <span className={`task-status ${toneForKind(message.kind)}`}>{message.kind}</span>
                  </div>
                  <div className="inbox-message-body">{message.body}</div>
                  {message.attachments?.length ? (
                    <div className="inbox-message-attachments">
                      {message.attachments.map((attachment) => (
                        <a
                          key={`${message.id}-${attachment.url}-${attachment.label}`}
                          className="inbox-attachment-link"
                          href={attachment.url}
                          target={attachment.url.startsWith('http') ? '_blank' : undefined}
                          rel={attachment.url.startsWith('http') ? 'noreferrer' : undefined}
                        >
                          {attachment.label}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </article>
                );
              })}
            </div>

            <form className="inbox-composer" onSubmit={handleSendMessage}>
              {!isSimpleChat && <div className="inbox-composer-toolbar">
                <label className="field-label inbox-field-compact">
                  <span>Reply as</span>
                  <select value={senderStaffCode} onChange={(event) => setSenderStaffCode(event.target.value)} disabled={!liveDataAvailable}>
                    {senderOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <div className="muted">{liveDataAvailable ? 'Live refresh runs every 15 seconds for active threads.' : 'Replying is disabled until live inbox data is available.'}</div>
              </div>}
              <textarea
                className="inbox-composer-input"
                rows={4}
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder="Message…"
                disabled={!liveDataAvailable}
              />
              {!isSimpleChat && <div className="inbox-attachment-block">
                <div className="panel-title" style={{ marginBottom: 0 }}>
                  <div>
                    <h4>Attachments</h4>
                    <p className="muted">Add links to evidence, checklists, or related operational screens.</p>
                  </div>
                  <button className="button secondary" type="button" onClick={addAttachmentRow} disabled={!liveDataAvailable}>Add link</button>
                </div>

                <div className="inbox-attachment-list">
                  {attachments.map((item, index) => (
                    <div className="inbox-attachment-row" key={`attachment-${index}`}>
                      <input
                        value={item.label}
                        onChange={(event) => updateAttachment(index, 'label', event.target.value)}
                        placeholder="Label"
                        type="text"
                        disabled={!liveDataAvailable}
                      />
                      <input
                        value={item.url}
                        onChange={(event) => updateAttachment(index, 'url', event.target.value)}
                        placeholder="/admin/inbox or https://…"
                        type="text"
                        disabled={!liveDataAvailable}
                      />
                      <button className="button secondary" type="button" onClick={() => removeAttachmentRow(index)} disabled={!liveDataAvailable}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>}
              <div className="inbox-composer-actions">
                <div>
                  {composerState.error && <div className="tone-red">{composerState.error}</div>}
                  {composerState.success && <div className="tone-green">{composerState.success}</div>}
                </div>
                <button className="button primary" type="submit" disabled={composerState.saving || isPending || !messageBody.trim() || !liveDataAvailable}>
                  {composerState.saving ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="inbox-empty-state">
            <strong>Choose a chat</strong>
            <p className="muted">Select a staff member or group chat from the list to open the conversation.</p>
          </div>
        )}
      </div>

      {!isSimpleChat && <aside className="card inbox-detail-column">
        <div className="panel-title">
          <div>
            <h3>Thread detail</h3>
            <p className="muted">Professional, in-app operational communications.</p>
          </div>
        </div>

        {selectedThread ? (
          <div className="inbox-detail-stack">
            <div className="builder-field strong-field">
              <span className="muted">Audience</span>
              <strong>{selectedThread.audience}</strong>
            </div>
            <div className="builder-field strong-field">
              <span className="muted">Live state</span>
              <strong>{selectedThread.unreadCount ? `${selectedThread.unreadCount} unread for this audience` : 'Fully read'}</strong>
            </div>
            <div className="builder-field">
              <span className="muted">Participants</span>
              <div className="inbox-participant-list">
                {selectedThread.participants?.map((participant) => (
                  <div className="inbox-participant-row" key={participant.key}>
                    <strong>{participant.name}</strong>
                    <span className="muted">{participant.role}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="builder-field">
              <span className="muted">Why it exists</span>
              <strong>
                {selectedThread.type === 'operational_alert'
                  ? 'System-generated operational alert that can now be handled inside the app.'
                  : selectedThread.scope === 'manual'
                    ? 'Manager-created internal thread for clean, direct operational coordination.'
                    : 'Internal collaboration thread for managers and supervisors.'}
              </strong>
            </div>
            <div className="cta-row">
              <Link className="button secondary" href="/admin/manager">Back to manager view</Link>
              <Link className="button secondary" href="/">Open dashboard</Link>
            </div>
          </div>
        ) : (
          <div className="muted">No operational thread loaded yet.</div>
        )}
      </aside>}
    </section>
  );
}
