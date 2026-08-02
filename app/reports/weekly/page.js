import PeriodReportPage from '../PeriodReportPage';
import { buildMonthlyPeriod, buildWeeklyPeriod } from '../../../lib/report-summary';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Weekly Report · Cienna Cleaning',
};

export default async function WeeklyReportPage({ searchParams }) {
  const params = await searchParams;
  const period = buildWeeklyPeriod(typeof params?.week === 'string' ? params.week : '');
  const month = buildMonthlyPeriod('');
  return <PeriodReportPage period={period} routePath="/reports/weekly" compareHref={`/reports/monthly?month=${month.paramValue}`} title="Weekly operations report" />;
}
