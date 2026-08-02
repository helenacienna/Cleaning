import PeriodReportPage from '../PeriodReportPage';
import { buildMonthlyPeriod, buildWeeklyPeriod } from '../../../lib/report-summary';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Monthly Report · Cienna Cleaning',
};

export default async function MonthlyReportPage({ searchParams }) {
  const params = await searchParams;
  const period = buildMonthlyPeriod(typeof params?.month === 'string' ? params.month : '');
  const week = buildWeeklyPeriod('');
  return <PeriodReportPage period={period} routePath="/reports/monthly" compareHref={`/reports/weekly?week=${week.paramValue}`} title="Monthly operations report" />;
}
