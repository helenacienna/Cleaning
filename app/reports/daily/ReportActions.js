'use client';

export default function ReportActions({ emailHref, backHref = '/cleaner' }) {
  function goBackToChecklist() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = backHref;
  }

  return (
    <div className="daily-report-actions no-print">
      <button className="button secondary" type="button" onClick={goBackToChecklist}>
        Back to checklist
      </button>
      <button className="button primary" type="button" onClick={() => window.print()}>
        Print / save PDF
      </button>
      <a className="button secondary" href={emailHref}>
        Email supervisor
      </a>
    </div>
  );
}
