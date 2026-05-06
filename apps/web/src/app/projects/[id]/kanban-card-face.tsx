import type { ReactNode } from 'react';
import type { Task } from '@nx-projects/projects';

export function KanbanCardFace({
  task,
  trailing,
}: {
  task: Task;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-md font-medium">{task.title}</span>
        </div>
        {task.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">{task.assignee?.email ?? 'Unassigned'}</p>
      </div>
      {trailing}
    </div>
  );
}
