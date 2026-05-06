import { connection } from 'next/server';
import { Suspense } from 'react';
import ProjectDetailPage from './project-detail-client';

export default async function ProjectPage() {
  await connection();
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-[100dvh] items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ProjectDetailPage />
    </Suspense>
  );
}
