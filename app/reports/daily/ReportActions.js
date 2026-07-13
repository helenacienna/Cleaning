'use client';

export default function ReportActions({ emailHref }) {
  return (
    <div className="daily-report-actions no-print">
      <button className="button primary" type="button" onClick={() => window.print()}>
        Print / save PDF
      </button>
      <a className="button secondary" href={emailHref}>
        Email supervisor
      </a>
    </div>
  );
}
