import { NextResponse } from 'next/server';
import { getTaskCardLibraryData } from '../../../lib/app-data';

export async function GET() {
  const payload = await getTaskCardLibraryData();
  return NextResponse.json({ ok: true, ...payload });
}
