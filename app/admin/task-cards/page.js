import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Task Admin retired · Cienna Cleaning',
};

export default function RetiredTaskCardsPage() {
  redirect('/facility-board/cienna?view=order');
}
