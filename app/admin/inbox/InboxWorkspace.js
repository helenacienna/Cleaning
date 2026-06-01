'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

function toneForKind(kind) {
  if (kind === 'alert') return 'status-carried-forward';
  if (kind === 'status') return 'status-photo-required';
  return 'status-completed';
}

export default function InboxWorkspace({ initialThreads, initialThread, source, senderOptions = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedThread, setSelectedThread] = useState(initialThread);
  const [threads, setThreads] = useState(initialThreads);
  const [senderStaffCode, setSenderStaffCode] = useState(senderOptions[0]?.value ?? 'MGR001');
  const [messageBody, setMessageBody] = useState('');
  const [composerState, setComposerState] = useState({ saving: false, error: '', success: '' });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setThreads(initialThreads);
  }, [initialThreads]);

  useEffect(() => {
    setSelectedThread(initialThread);
  }, [initialThread]);

  useEffect(() => {
    if (!selectedThread?.id) return;

    fetch(`/api/inbox/threads/${selectedThread.id}/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ participantStaffCode: senderOptions[0]?.value ?? null }),
    }).catch(() => null);
  }, [selectedThread?.id, senderOptions]);

  const threadMap = useMemo(() => new Map(threads.map((thread) => [thread.id, thread])), [threads]);

  async function handleSelectThread(threadId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('thread', threadId);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!selectedThread?.id || !messageBody.trim()) {
      return;
    }

    setComposerState({ saving: true, error: '', success: '' });

    const response = await fetch(`/api/inbox/threads/${selectedThread.id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ senderStaffCode, body: messageBody.trim() }),
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
    setComposerState({ saving: false, error: '', success: source === 'demo' ? 'Saved as demo reply.' : 'Reply sent.' });
  }

  return (
    <section className="inbox-shell">
      <aside className="card inbox-sidebar">
        <div className="panel-title">
          <div>
            <h3>Threads</h3>
            <p className="muted">Operational work, escalations, and manager discussions.</p>
          </div>
          <span className="badge">{threads.length}</span>
        </div>

        <div className="inbox-thread-list">
          {threads.map((thread) => {
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
        </div>
      </aside>

      <div className="card inbox-main-column">
        {selectedThread ? (
          <>
            <div className="inbox-thread-header">
              <div>
                <span className="badge">{selectedThread.scope || 'internal thread'}</span>
                <h2>{selectedThread.title}</h2>
                {selectedThread.subtitle && <p className="muted">{selectedThread.subtitle}</p>}
              </div>
              <div className="flag-row">
                <span className="flag">{selectedThread.participantCount} participants</span>
                <span className="flag">{selectedThread.messageCount ?? selectedThread.messages?.length ?? 0} messages</span>
                <span className="flag">{selectedThread.status}</span>
              </div>
            </div>

            <div className="inbox-message-stream">
              {(selectedThread.messages ?? []).map((message) => (
                <article className="inbox-message-card" key={message.id}>
                  <div className="inbox-message-meta">
                    <div>
                      <strong>{message.senderName}</strong>
                      <span className="muted">{message.formattedTime}</span>
                    </div>
                    <span className={`task-status ${toneForKind(message.kind)}`}>{message.kind}</span>
                  </div>
                  <div className="inbox-message-body">{message.body}</div>
                </article>
              ))}
            </div>

            <form className="inbox-composer" onSubmit={handleSendMessage}>
              <div className="inbox-composer-toolbar">
                <label className="field-label inbox-field-compact">
                  <span>Reply as</span>
                  <select value={senderStaffCode} onChange={(event) => setSenderStaffCode(event.target.value)}>
                    {senderOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <div className="muted">{source === 'demo' ? 'Demo mode keeps the no-DB fallback alive.' : 'Messages write into the internal inbox tables.'}</div>
              </div>
              <textarea
                className="inbox-composer-input"
                rows={4}
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder="Write a clear operational update…"
              />
              <div className="inbox-composer-actions">
                <div>
                  {composerState.error && <div className="tone-red">{composerState.error}</div>}
                  {composerState.success && <div className="tone-green">{composerState.success}</div>}
                </div>
                <button className="button primary" type="submit" disabled={composerState.saving || isPending || !messageBody.trim()}>
                  {composerState.saving ? 'Sending…' : 'Send reply'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="inbox-empty-state">
            <strong>No thread selected.</strong>
            <p className="muted">Pick a conversation from the left to open the operational detail.</p>
          </div>
        )}
      </div>

      <aside className="card inbox-detail-column">
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
                  : 'Internal collaboration thread for managers and supervisors.'}
              </strong>
            </div>
            <div className="cta-row">
              <Link className="button secondary" href="/admin/manager">Back to manager view</Link>
              <Link className="button secondary" href="/admin/daily-hierarchy">Open organiser board</Link>
            </div>
          </div>
        ) : (
          <div className="muted">No operational thread loaded yet.</div>
        )}
      </aside>
    </section>
  );
}
