import type { UniqueIdentifier } from '@dnd-kit/core';
import type { Task, TaskStatus } from '@nx-projects/projects';

export const COLUMN_STATUSES: TaskStatus[] = [
  'todo',
  'in_progress',
  'review',
  'done',
  'cancelled',
];

export function taskStatusBadgeVariant(
  status: TaskStatus
): 'success' | 'planning' | 'completed' | 'archived' | 'secondary' | 'default' {
  switch (status) {
    case 'done':
      return 'completed';
    case 'in_progress':
      return 'success';
    case 'review':
      return 'planning';
    case 'cancelled':
      return 'archived';
    default:
      return 'secondary';
  }
}

export function formatStatusLabel(status: TaskStatus): string {
  return status.replace(/_/g, ' ');
}

/** Ordered task ids per column; iteration order of `tasks` defines order within each status. */
export function buildColumnTaskIds(tasks: Task[]): Record<TaskStatus, string[]> {
  const next = COLUMN_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: [] as string[] }),
    {} as Record<TaskStatus, string[]>
  );
  for (const t of tasks) {
    next[t.status].push(t.id);
  }
  return next;
}

export function cloneColumnTaskIds(
  cols: Record<TaskStatus, string[]>
): Record<TaskStatus, string[]> {
  const next = {} as Record<TaskStatus, string[]>;
  for (const s of COLUMN_STATUSES) {
    next[s] = [...cols[s]];
  }
  return next;
}

/** Stable signature for id + status; ignores reorder within the same status column. */
export function tasksIdStatusSignature(tasks: Task[]): string {
  return [...tasks]
    .map((t) => `${t.id}\0${t.status}`)
    .sort()
    .join('\n');
}

export function findColumnForItemId(
  id: UniqueIdentifier,
  columns: Record<TaskStatus, string[]>
): TaskStatus | null {
  const sid = String(id);
  // Resolve tasks before column ids so a task id never collides with a status key (e.g. "done").
  for (const status of COLUMN_STATUSES) {
    if (columns[status].includes(sid)) return status;
  }
  if ((COLUMN_STATUSES as readonly string[]).includes(sid)) {
    return sid as TaskStatus;
  }
  return null;
}

/** Cross-column move for multi-container sortable boards (see dnd-kit multiple sortable lists). */
export function moveTaskBetweenColumns(
  columns: Record<TaskStatus, string[]>,
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier
): Record<TaskStatus, string[]> | null {
  const activeContainer = findColumnForItemId(activeId, columns);
  const overContainer = findColumnForItemId(overId, columns);
  if (!activeContainer || !overContainer || activeContainer === overContainer) {
    return null;
  }

  const aid = String(activeId);
  const activeItems = [...columns[activeContainer]];
  const overItems = [...columns[overContainer]];
  const activeIndex = activeItems.indexOf(aid);
  if (activeIndex === -1) return null;

  activeItems.splice(activeIndex, 1);

  const overIsColumn = (COLUMN_STATUSES as readonly string[]).includes(String(overId));
  const insertIndex = overIsColumn
    ? overItems.length
    : (() => {
        const idx = overItems.indexOf(String(overId));
        return idx === -1 ? overItems.length : idx;
      })();

  overItems.splice(insertIndex, 0, aid);

  return {
    ...columns,
    [activeContainer]: activeItems,
    [overContainer]: overItems,
  };
}
