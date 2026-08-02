import Link from 'next/link';
import AuthStatus from '../AuthStatus';

export const metadata = {
  title: 'Help & setup · Cienna Cleaning',
};

const staffSteps = [
  'Open your staff name from the Cleaner work lists page.',
  'Tap Open active checklist, then work through each job in order.',
  'Grade each job from 1 to 5. Grades 1–2 need a before photo or note, then a corrected score and after photo when fixed.',
  'If reception drops, keep working. The app will show pending sync and send changes when online again.',
  'Before poor-signal work areas, scroll to the bottom of your staff page and tap Prepare device under Fast mode.',
];

const managerSteps = [
  'Use the main dashboard to review today’s facility work and completion progress.',
  'Use Staff admin for roster and staff setup changes.',
  'Use Task Card Organiser for task cards, requirements, routes, and order changes.',
  'Use reports to review checklist outcomes, issue photos, and resolved corrections.',
];

const readinessItems = [
  ['Fast mode', 'Prepare each staff device once, then repeat after major app or route changes.'],
  ['Offline sync', 'Do not clear browser data while pending sync is above 0. Use Sync details if an item gets stuck.'],
  ['Photos', 'Take issue and correction photos inside the checklist so they attach to the right task.'],
  ['Support', 'Record the staff name, device type, page, and exact message when reporting a problem.'],
];

export default function HelpPage() {
  return (
    <main className="page help-page">
      <section className="card help-hero">
        <span className="badge tone-green">Help & setup</span>
        <h1>Cienna Cleaning quick start</h1>
        <p className="muted">A short guide for staff, managers, and device setup. Keep this page simple enough for a new user to follow without training.</p>
        <AuthStatus />
        <div className="workflow-banner-actions">
          <Link className="button primary" href="/admin/setup">Open setup checklist</Link>
          <Link className="button primary" href="/cleaner">Open staff landing</Link>
          <Link className="button secondary" href="/">Open admin dashboard</Link>
        </div>
      </section>

      <section className="help-grid">
        <article className="card help-card">
          <span className="badge">Staff workflow</span>
          <h2>Cleaner quick start</h2>
          <ol className="help-step-list">
            {staffSteps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </article>

        <article className="card help-card">
          <span className="badge">Manager workflow</span>
          <h2>Admin quick start</h2>
          <ol className="help-step-list">
            {managerSteps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </article>
      </section>

      <section className="card help-card">
        <span className="badge tone-green">Device readiness</span>
        <h2>Prepare phones for speed and reliability</h2>
        <div className="help-readiness-list">
          {readinessItems.map(([title, body]) => (
            <div className="help-readiness-item" key={title}>
              <strong>{title}</strong>
              <span>{body}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
