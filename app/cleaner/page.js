import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatBoardDayKeyForTimeZone } from '../../lib/app-timezone.js';
import { getCleanerStaffLists } from '../../lib/cleaner-data';
import ForceTodayRedirect from './ForceTodayRedirect';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Staff landing · Cienna Cleaning',
};

function totalAcrossLists(lists = [], key) {
  return lists.reduce((sum, list) => sum + Number(list?.stats?.[key] ?? 0), 0);
}

function buildLandingDayHref(day, { historic = false } = {}) {
  if (!day) {
    return '/cleaner';
  }

  const params = new URLSearchParams({ day });
  if (historic) {
    params.set('view', 'history');
  }

  return `/cleaner?${params.toString()}`;
}

function buildStaffDayHref(staffSlug, day, { historic = false } = {}) {
  if (!day) {
    return `/cleaner/${staffSlug}`;
  }

  const params = new URLSearchParams({ day });
  if (historic) {
    params.set('view', 'history');
  }

  return `/cleaner/${staffSlug}?${params.toString()}`;
}

export default async function CleanerLandingPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const selectedDay = typeof resolvedSearchParams?.day === 'string' ? resolvedSearchParams.day : '';
  const allowHistoricView = resolvedSearchParams?.view === 'history';
  const { lists, source, timeZone } = await getCleanerStaffLists(selectedDay);
  const totalTasks = totalAcrossLists(lists, 'total');
  const totalCompleted = totalAcrossLists(lists, 'completed');
  const totalPhotoChecks = totalAcrossLists(lists, 'photoRequired');
  const availableBoardDays = [...new Set(lists.flatMap((list) => list.boardDays ?? []))].sort();
  const todayBoardDay = formatBoardDayKeyForTimeZone(new Date(), timeZone);
  const activeBoardDay = (selectedDay && availableBoardDays.includes(selectedDay))
    ? selectedDay
    : (availableBoardDays.includes(todayBoardDay)
      ? todayBoardDay
      : (lists.find((list) => list.activeBoardDay)?.activeBoardDay ?? null));
  const activeBoardDayIndex = availableBoardDays.findIndex((day) => day === activeBoardDay);
  const previousBoardDay = activeBoardDayIndex > 0 ? availableBoardDays[activeBoardDayIndex - 1] : null;
  const nextBoardDay = activeBoardDayIndex >= 0 && activeBoardDayIndex < availableBoardDays.length - 1 ? availableBoardDays[activeBoardDayIndex + 1] : null;
  const defaultStaffOpenDay = availableBoardDays.includes(todayBoardDay) ? todayBoardDay : activeBoardDay;
  const todayHref = availableBoardDays.includes(todayBoardDay) ? buildLandingDayHref(todayBoardDay) : null;
  const activeDayLabel = lists.find((list) => list.activeBoardDay === activeBoardDay)?.day
    ?? lists[0]?.day
    ?? 'Current run';

  if (todayHref && activeBoardDay !== todayBoardDay && (!selectedDay || !allowHistoricView)) {
    redirect(todayHref);
  }

  return (
    <main className="page dashboard-page compact-page">
      <ForceTodayRedirect enabled={Boolean(todayHref && activeBoardDay !== todayBoardDay && selectedDay && !allowHistoricView)} href={todayHref ?? ''} />
      <div className="mobile-shell">
        <section className="card scan-hero">
          <div className="scan-header">
            <div>
              <span className="badge">Staff landing</span>
              <h1>Cleaner work lists</h1>
              <p className="muted">Choose your name to open your personal work list.</p>
            </div>
            <div className="workflow-banner-actions">
              <Link className="button secondary" href="/">Admin dashboard</Link>
              <Link className="button secondary" href="/admin/staff">Staff admin</Link>
            </div>
          </div>

          <div className="stat-row">
            <span className="flag">{lists.length} staff lists</span>
            <span className="flag">{totalTasks} live tasks</span>
            <span className="flag">{source === 'prisma' ? 'Live runtime data' : 'Demo task content'}</span>
          </div>
        </section>

        <section className="card">
          <div className="task-detail-grid">
            <div>
              <span className="muted">Completed</span>
              <strong>{totalCompleted}</strong>
            </div>
            <div>
              <span className="muted">Remaining</span>
              <strong>{Math.max(0, totalTasks - totalCompleted)}</strong>
            </div>
            <div>
              <span className="muted">Photo checks</span>
              <strong>{totalPhotoChecks}</strong>
            </div>
            <div>
              <span className="muted">Entry style</span>
              <strong>Staff-first</strong>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="panel-title">
            <div>
              <h3>Choose staff member</h3>
              <p className="muted">Each list stays as one personal page, split by facility only when needed.</p>
            </div>
          </div>

          <div className="task-list">
            {lists.map((list) => (
              <Link className="task-row" href={buildStaffDayHref(list.id, defaultStaffOpenDay)} key={list.id}>
                <div>
                  <strong>{list.staff}</strong>
                  <div className="muted">{list.stats.facilities} facilities · {list.stats.total} tasks · {list.stats.completed} completed</div>
                  {list.roster?.summary ? <div className="muted">Roster: {list.roster.summary}</div> : null}
                </div>
                <div className="flag-row">
                  <span className="flag">{list.day ?? 'Current run'}</span>
                  <span className="flag">{list.shift}</span>
                  {list.roster?.status ? <span className="flag">{list.roster.status}</span> : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="sticky-board-action-bar sticky-board-action-bar-staff">
        {previousBoardDay ? (
          <Link className="button secondary slim" href={buildLandingDayHref(previousBoardDay, { historic: true })}>← Prev</Link>
        ) : (
          <span className="button secondary slim sticky-board-link-disabled" aria-disabled="true">← Prev</span>
        )}
        <div className="sticky-board-center-stack">
          <div className="sticky-board-date">{activeDayLabel}</div>
          {todayHref && activeBoardDay !== todayBoardDay ? (
            <Link className="button secondary slim sticky-board-today-button" href={todayHref}>Back to today</Link>
          ) : (
            <span className="button secondary slim sticky-board-today-button sticky-board-link-disabled" aria-disabled="true">Back to today</span>
          )}
        </div>
        {nextBoardDay ? (
          <Link className="button secondary slim" href={buildLandingDayHref(nextBoardDay, { historic: true })}>Next →</Link>
        ) : (
          <span className="button secondary slim sticky-board-link-disabled" aria-disabled="true">Next →</span>
        )}
      </div>
    </main>
  );
}
