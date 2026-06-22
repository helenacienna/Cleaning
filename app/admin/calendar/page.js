import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Legacy board retired · Cienna Cleaning',
};

export default function AdminCalendarPage() {
  redirect('/');
}
