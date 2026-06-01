'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export default function CleanerInboxPanel({ threads = [], unreadCount = 0 }) {
  const [activeThreadId, setActiveThreadId] = useState(threads[0]?.id ?? null);
  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null,
    [activeThreadId, threads],
  );

  return (
    <section className="card cleaner-inbox-panel">
      <div className="panel-title">
        <div>
          <h2>Cleaner inbox</h2>
          <p className="muted">Shift updates, rework notices, and supervisor instructions in one mobile view.</p>
        </div>
        <div className="flag-row">
          <span className={`badge ${unreadCount ? 'tone-red' : ''}`}>{unreadCount} unread</span>
          <Link className="button secondary" href="/admin/inbox?audience=cleaner">Full inbox</Link>
        </div>
      </div>

      <div className="cleaner-inbox-shell">
        <div className="cleaner-inbox-thread-list">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              className={`inbox-thread-card ${thread.id === activeThread?.id ? 'inbox-thread-card-active' : ''}`}
              onClick={() => setActiveThreadId(thread.id)}
            >
              <div className="inbox-thread-card-top">
                <strong>{thread.title}</strong>
                <span className="muted">{thread.formattedTime}</span>
              </div>
              {thread.subtitle && <div className="muted">{thread.subtitle}</div>}
              <div className="inbox-thread-preview">{thread.lastMessagePreview}</div>
              <div className="flag-row">
                {thread.unreadCount ? <span className="task-status status-carried-forward">{thread.unreadCount} unread</span> : <span className="flag">Read</span>}
                <span className="flag">{thread.status}</span>
              </div>
            </button>
          ))}
        </div>

        {activeThread ? (
          <div className="cleaner-inbox-detail">
            <div className="builder-field strong-field">
              <span className="muted">Thread</span>
              <strong>{activeThread.title}</strong>
            </div>
            <div className="cleaner-inbox-message-list">
              {(activeThread.messages ?? []).slice(-4).map((message) => (
                <article className="inbox-message-card" key={message.id}>
                  <div className="inbox-message-meta">
                    <div>
                      <strong>{message.senderName}</strong>
                      <span className="muted">{message.formattedTime}</span>
                    </div>
                    <span className="task-status status-photo-required">{message.kind}</span>
                  </div>
                  <div className="inbox-message-body">{message.body}</div>
                  {message.attachments?.length ? (
                    <div className="inbox-message-attachments">
                      {message.attachments.map((attachment) => (
                        <a
                          key={`${message.id}-${attachment.url}`}
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
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
