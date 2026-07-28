'use client';

import { useState } from 'react';

export default function ReportActions({ emailHref, backHref = '/cleaner', reportPayload = null }) {
  const [emailState, setEmailState] = useState({ sending: false, message: '', error: '' });

  function goBackToChecklist() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = backHref;
  }

  async function emailPdfReport() {
    if (!reportPayload || emailState.sending) return;
    setEmailState({ sending: true, message: '', error: '' });

    try {
      const response = await fetch('/api/reports/daily/email-pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ report: reportPayload }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not email PDF report.');
      }
      setEmailState({ sending: false, message: 'PDF emailed to supervisor.', error: '' });
    } catch (error) {
      setEmailState({ sending: false, message: '', error: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <div className="daily-report-actions no-print">
      <button className="button secondary" type="button" onClick={goBackToChecklist}>
        Back to checklist
      </button>
      <button className="button primary" type="button" onClick={() => window.print()}>
        Print / save PDF
      </button>
      <button className="button secondary" type="button" onClick={emailPdfReport} disabled={!reportPayload || emailState.sending}>
        {emailState.sending ? 'Emailing PDF…' : 'Email supervisor PDF'}
      </button>
      {emailState.error ? <div className="tone-red daily-report-email-status">{emailState.error}</div> : null}
      {emailState.message ? <div className="tone-green daily-report-email-status">{emailState.message}</div> : null}
      <a className="button secondary daily-report-mailto-fallback" href={emailHref}>
        Email link fallback
      </a>
    </div>
  );
}
