'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ForceTodayRedirect({ enabled = false, href = '' }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || !href) {
      return;
    }

    router.replace(href);
  }, [enabled, href, router]);

  return null;
}
