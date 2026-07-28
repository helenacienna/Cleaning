import Link from 'next/link';
import { getPrisma } from '../../../lib/prisma';
import { getOperationalWindow } from '../../../lib/operational-window.mjs';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Task Organisation · Cienna Cleaning',
};

const STATUS_GROUPS = {
  open: new Set(['upcoming', 'due', 'unscheduled', 'scheduled', 'in_progress', 'overdue', 'carried_forward']),
  done: new Set(['completed', 'skipped', 'cancelled']),
};

function formatLabel(value = '') {
  return String(value || '—').replace(/_/g, ' ');
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Australia/Brisbane',
  }).format(new Date(value));
}

function countBy(items = [], getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item) || 'Other';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function getActiveTemplates(templates = []) {
  return templates.filter((template) => template.active !== false);
}

function buildFacilityRows(facilities = [], templates = [], taskInstances = []) {
  return facilities.map((facility) => {
    const facilityTemplates = templates.filter((template) => template.facilityId === facility.id);
    const activeTemplates = getActiveTemplates(facilityTemplates);
    const facilityInstances = taskInstances.filter((instance) => (
      instance.facilityId === facility.id || instance.plannedFacilityId === facility.id
    ));
    const openTasks = facilityInstances.filter((instance) => STATUS_GROUPS.open.has(instance.status));
    const extraTasks = facilityInstances.filter((instance) => instance.sourceType === 'ad_hoc' || instance.isExceptionTask || instance.manuallyCreated);
    const defaultRoute = facility.cleaningRoutes?.find((route) => route.isDefault) ?? facility.cleaningRoutes?.[0] ?? null;

    return {
      id: facility.id,
      name: facility.name,
      zones: facility.zones?.length ?? 0,
      groups: facility.taskGroups?.length ?? 0,
      templates: activeTemplates.length,
      inactiveTemplates: facilityTemplates.length - activeTemplates.length,
      openTasks: openTasks.length,
      extraTasks: extraTasks.length,
      routeName: defaultRoute?.name ?? 'No route saved',
      routeItems: defaultRoute?.items?.length ?? 0,
    };
  });
}

function buildZoneRows(templates = []) {
  const zones = new Map();
  getActiveTemplates(templates).forEach((template) => {
    const key = template.zoneId;
    if (!zones.has(key)) {
      zones.set(key, {
        id: key,
        facility: template.facility?.name ?? 'Unknown facility',
        zone: template.zone?.name ?? 'Unknown zone',
        groups: new Set(),
        daily: 0,
        weekly: 0,
        monthly: 0,
        other: 0,
        total: 0,
      });
    }
    const row = zones.get(key);
    row.groups.add(template.taskGroup?.name ?? 'Other');
    row.total += 1;
    if (template.recurrenceType === 'daily') row.daily += 1;
    else if (template.recurrenceType === 'weekly') row.weekly += 1;
    else if (template.recurrenceType === 'monthly') row.monthly += 1;
    else row.other += 1;
  });

  return [...zones.values()]
    .map((row) => ({ ...row, groups: row.groups.size }))
    .sort((left, right) => `${left.facility} ${left.zone}`.localeCompare(`${right.facility} ${right.zone}`));
}

function buildStaffRows(staff = [], taskInstances = []) {
  return staff.map((member) => {
    const assigned = taskInstances.filter((instance) => instance.assignedStaffId === member.id);
    return {
      id: member.id,
      name: member.fullName,
      role: member.role,
      openTasks: assigned.filter((instance) => STATUS_GROUPS.open.has(instance.status)).length,
      dueTasks: assigned.filter((instance) => instance.status === 'due' || instance.status === 'overdue').length,
      extraTasks: assigned.filter((instance) => instance.sourceType === 'ad_hoc' || instance.isExceptionTask || instance.manuallyCreated).length,
    };
  }).sort((left, right) => left.name.localeCompare(right.name));
}

async function loadTaskOrganisationData() {
  const prisma = await getPrisma();
  if (!prisma) {
    return { source: 'unavailable', facilities: [], templates: [], staff: [], taskInstances: [] };
  }

  const window = getOperationalWindow({ timeZone: 'Australia/Brisbane' });
  const [facilities, templates, staff, taskInstances] = await Promise.all([
    prisma.facility.findMany({
      where: { active: true },
      include: {
        zones: { where: { active: true }, orderBy: { name: 'asc' } },
        taskGroups: { where: { active: true }, orderBy: { sequence: 'asc' } },
        cleaningRoutes: {
          where: { active: true },
          include: {
            items: {
              orderBy: { sequence: 'asc' },
              include: {
                taskTemplate: {
                  select: {
                    id: true,
                    title: true,
                    taskTemplateCode: true,
                  },
                },
              },
            },
          },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.taskTemplate.findMany({
      include: {
        facility: true,
        zone: true,
        taskGroup: true,
        status: true,
      },
      orderBy: [{ facilityId: 'asc' }, { zoneId: 'asc' }, { defaultSequence: 'asc' }],
    }),
    prisma.staff.findMany({
      where: { active: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.taskInstance.findMany({
      where: {
        OR: [
          { plannedRunDate: { gte: window.runDateGte, lte: window.runDateLte } },
          { dueAt: { gte: window.dueAtGte, lt: window.dueAtLt } },
          { shiftRun: { is: { runDate: { gte: window.runDateGte, lte: window.runDateLte } } } },
        ],
      },
      include: {
        facility: true,
        plannedFacility: true,
        zone: true,
        plannedZone: true,
        taskGroup: true,
        plannedTaskGroup: true,
        assignedStaff: true,
        shiftRun: true,
      },
      orderBy: [{ dueAt: 'asc' }, { sequence: 'asc' }],
    }),
  ]);

  return { source: 'prisma', facilities, templates, staff, taskInstances };
}

function StatCard({ label, value, note }) {
  return (
    <div className="card" style={statCardStyle}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <strong style={{ fontSize: 28 }}>{value}</strong>
      {note ? <div className="muted" style={{ fontSize: 12 }}>{note}</div> : null}
    </div>
  );
}

function LinkCard({ title, href, children }) {
  return (
    <Link href={href} className="card" style={linkCardStyle}>
      <strong>{title}</strong>
      <span className="muted" style={{ fontSize: 13 }}>{children}</span>
    </Link>
  );
}

function TaskTable({ children }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>{children}</table>
    </div>
  );
}

export default async function TaskOrganisationPage() {
  const { source, facilities, templates, staff, taskInstances } = await loadTaskOrganisationData();
  const activeTemplates = getActiveTemplates(templates);
  const openInstances = taskInstances.filter((instance) => STATUS_GROUPS.open.has(instance.status));
  const extraInstances = taskInstances.filter((instance) => instance.sourceType === 'ad_hoc' || instance.isExceptionTask || instance.manuallyCreated);
  const facilityRows = buildFacilityRows(facilities, templates, taskInstances);
  const zoneRows = buildZoneRows(templates);
  const staffRows = buildStaffRows(staff, taskInstances);
  const recurrenceCounts = countBy(activeTemplates, (template) => formatLabel(template.recurrenceType));
  const serviceCounts = countBy(activeTemplates, (template) => formatLabel(template.serviceType));
  const statusCounts = countBy(openInstances, (instance) => formatLabel(instance.status));

  return (
    <main className="page admin-calendar-page">
      <div className="topbar">
        <div className="brand">
          <p>Cienna Cleaning Admin</p>
          <h1>Task Organisation</h1>
        </div>
        <div className="badge-row">
          <Link className="button secondary" href="/">Back to dashboard</Link>
          <Link className="button secondary" href="/admin/task-cards">Task Admin</Link>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="panel-title" style={{ marginBottom: 8 }}>
          <div>
            <h3>Consolidated task organisation prototype</h3>
            <p className="muted">One read-only planning surface that brings the task library, facility routes, daily schedule, staff load, and extra tasks together. Existing pages stay untouched.</p>
          </div>
          <span className="badge">{source === 'prisma' ? 'Live data' : 'Data unavailable'}</span>
        </div>
        <div style={quickLinksStyle}>
          <LinkCard href="/admin/task-cards" title="Task library">Edit recurring/base task templates.</LinkCard>
          <LinkCard href="/" title="Daily board">Open the current live planning board.</LinkCard>
          <LinkCard href="/admin/staff" title="Staff roster">Review staff weekly times.</LinkCard>
          <LinkCard href="/admin/facilities" title="Facilities">Edit facilities and zones.</LinkCard>
        </div>
      </section>

      <section style={statGridStyle}>
        <StatCard label="Active task templates" value={activeTemplates.length} note={`${templates.length - activeTemplates.length} inactive`} />
        <StatCard label="Open scheduled tasks" value={openInstances.length} note={Object.entries(statusCounts).map(([key, count]) => `${key}: ${count}`).join(' · ') || 'None'} />
        <StatCard label="Extra / one-off tasks" value={extraInstances.length} note="Ad hoc, manual, or exception tasks in the current window" />
        <StatCard label="Facilities" value={facilities.length} note={`${zoneRows.length} active zones represented`} />
      </section>

      <section className="card" style={sectionStyle}>
        <div className="panel-title">
          <div>
            <h3>By facility</h3>
            <p className="muted">Combines task-template volume, live open work, extras, and saved route/order coverage.</p>
          </div>
        </div>
        <TaskTable>
          <thead>
            <tr>
              <th style={thStyle}>Facility</th>
              <th style={thStyle}>Zones</th>
              <th style={thStyle}>Task groups</th>
              <th style={thStyle}>Templates</th>
              <th style={thStyle}>Open tasks</th>
              <th style={thStyle}>Extras</th>
              <th style={thStyle}>Route/order</th>
            </tr>
          </thead>
          <tbody>
            {facilityRows.map((row) => (
              <tr key={row.id}>
                <td style={tdStyle}><strong>{row.name}</strong></td>
                <td style={tdStyle}>{row.zones}</td>
                <td style={tdStyle}>{row.groups}</td>
                <td style={tdStyle}>{row.templates}{row.inactiveTemplates ? <span className="muted"> / {row.inactiveTemplates} inactive</span> : null}</td>
                <td style={tdStyle}>{row.openTasks}</td>
                <td style={tdStyle}>{row.extraTasks}</td>
                <td style={tdStyle}>{row.routeName} <span className="muted">({row.routeItems} tasks)</span></td>
              </tr>
            ))}
          </tbody>
        </TaskTable>
      </section>

      <section className="card" style={sectionStyle}>
        <div className="panel-title">
          <div>
            <h3>By zone</h3>
            <p className="muted">Shows where the master task list is heaviest before we decide what should consolidate next.</p>
          </div>
        </div>
        <TaskTable>
          <thead>
            <tr>
              <th style={thStyle}>Facility</th>
              <th style={thStyle}>Zone</th>
              <th style={thStyle}>Groups</th>
              <th style={thStyle}>Daily</th>
              <th style={thStyle}>Weekly</th>
              <th style={thStyle}>Monthly</th>
              <th style={thStyle}>Other</th>
              <th style={thStyle}>Total</th>
            </tr>
          </thead>
          <tbody>
            {zoneRows.map((row) => (
              <tr key={row.id}>
                <td style={tdStyle}>{row.facility}</td>
                <td style={tdStyle}><strong>{row.zone}</strong></td>
                <td style={tdStyle}>{row.groups}</td>
                <td style={tdStyle}>{row.daily}</td>
                <td style={tdStyle}>{row.weekly}</td>
                <td style={tdStyle}>{row.monthly}</td>
                <td style={tdStyle}>{row.other}</td>
                <td style={tdStyle}>{row.total}</td>
              </tr>
            ))}
          </tbody>
        </TaskTable>
      </section>

      <section className="card" style={sectionStyle}>
        <div className="panel-title">
          <div>
            <h3>By staff</h3>
            <p className="muted">Current task load from the live schedule window. This helps test whether staff planning belongs in the same consolidated surface.</p>
          </div>
        </div>
        <TaskTable>
          <thead>
            <tr>
              <th style={thStyle}>Staff</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Open tasks</th>
              <th style={thStyle}>Due/overdue</th>
              <th style={thStyle}>Extras</th>
            </tr>
          </thead>
          <tbody>
            {staffRows.map((row) => (
              <tr key={row.id}>
                <td style={tdStyle}><strong>{row.name}</strong></td>
                <td style={tdStyle}>{formatLabel(row.role)}</td>
                <td style={tdStyle}>{row.openTasks}</td>
                <td style={tdStyle}>{row.dueTasks}</td>
                <td style={tdStyle}>{row.extraTasks}</td>
              </tr>
            ))}
          </tbody>
        </TaskTable>
      </section>

      <section className="card" style={sectionStyle}>
        <div className="panel-title">
          <div>
            <h3>Extra / one-off tasks</h3>
            <p className="muted">A single place to see ad hoc/manual/exception tasks before deciding whether they should stay separate or become part of the normal task library.</p>
          </div>
          <Link className="button secondary slim" href="/">Open daily board</Link>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {extraInstances.length ? extraInstances.slice(0, 20).map((task) => (
            <div key={task.id} style={extraTaskStyle}>
              <div>
                <strong>{task.titleSnapshot}</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  {(task.plannedFacility ?? task.facility)?.name ?? 'Unknown facility'} · {(task.plannedZone ?? task.zone)?.name ?? 'Unknown zone'} · {formatDate(task.plannedRunDate ?? task.dueAt)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge">{formatLabel(task.status)}</span>
                <div className="muted" style={{ fontSize: 12 }}>{task.assignedStaff?.fullName ?? 'Unallocated'}</div>
              </div>
            </div>
          )) : <div className="muted">No extra tasks in the current live schedule window.</div>}
        </div>
      </section>

      <section className="card" style={sectionStyle}>
        <div className="panel-title">
          <div>
            <h3>Library mix</h3>
            <p className="muted">Quick sanity check for whether the master list is shaped sensibly before deeper consolidation.</p>
          </div>
        </div>
        <div style={mixGridStyle}>
          <div>
            <strong>Frequency</strong>
            <ul style={listStyle}>{Object.entries(recurrenceCounts).map(([key, count]) => <li key={key}>{key}: {count}</li>)}</ul>
          </div>
          <div>
            <strong>Service type</strong>
            <ul style={listStyle}>{Object.entries(serviceCounts).map(([key, count]) => <li key={key}>{key}: {count}</li>)}</ul>
          </div>
          <div>
            <strong>Suggested next consolidation</strong>
            <ul style={listStyle}>
              <li>Keep this page read-only while evaluating the layout.</li>
              <li>Move route/order editing here next if the facility view feels right.</li>
              <li>Only retire old pages after the consolidated page proves easier to use.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

const statGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
  marginBottom: 16,
};

const statCardStyle = {
  display: 'grid',
  gap: 4,
};

const quickLinksStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
};

const linkCardStyle = {
  display: 'grid',
  gap: 6,
  textDecoration: 'none',
  color: 'inherit',
  border: '1px solid rgba(255,255,255,0.10)',
};

const sectionStyle = {
  marginBottom: 16,
};

const tableStyle = {
  width: '100%',
  minWidth: 760,
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle = {
  textAlign: 'left',
  padding: '8px 6px',
  borderBottom: '1px solid rgba(255,255,255,0.18)',
};

const tdStyle = {
  padding: '8px 6px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  verticalAlign: 'top',
};

const extraTaskStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 12,
  alignItems: 'start',
  padding: 10,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.03)',
};

const mixGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
};

const listStyle = {
  margin: '8px 0 0',
  paddingLeft: 18,
};
