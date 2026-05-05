'use client';

import { useMe } from '@nx-projects/projects';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function IndexPage() {
  const { data, isPending } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    if (data) router.replace('/projects');
    else router.replace('/login');
  }, [data, isPending, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Loading…
    </div>
  );
}
