import PeriodReportPage from '../PeriodReportPage';
import { buildMonthlyPeriod, buildWeeklyPeriod } from '../../../lib/report-summary';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Building Manager Report · Cienna Cleaning',
};

export default async function BuildingManagerReportPage({ searchParams }) {
  const params = await searchParams;
  const type = params?.type === 'weekly' ? 'weekly' : 'monthly';
  const period = type === 'weekly'
    ? buildWeeklyPeriod(typeof params?.week === 'string' ? params.week : '')
    : buildMonthlyPeriod(typeof params?.month === 'string' ? params.month : '');
  const oppositePeriod = type === 'weekly' ? buildMonthlyPeriod('') : buildWeeklyPeriod('');
  const compareHref = type === 'weekly'
    ? `/reports/building-manager?type=monthly&month=${oppositePeriod.paramValue}`
    : `/reports/building-manager?type=weekly&week=${oppositePeriod.paramValue}`;

  return (
    <PeriodReportPage
      period={period}
      routePath={`/reports/building-manager?type=${type}`}
      compareHref={compareHref}
      title="Building manager report"
      reportHeading={`Building manager ${type} report`}
      includeFacilityStaff
      managerReport
    />
  );
}
