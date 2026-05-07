import type { UniqueIdentifier } from '@dnd-kit/core';
import type { Task, WorkflowStatus } from '@nx-projects/projects';

export function taskStatusBadgeVariant(
  status: WorkflowStatus | null | undefined
): 'success' | 'planning' | 'completed' | 'archived' | 'secondary' | 'default' {
  if (!status) return 'secondary';
  if (status.isArchived) return 'archived';
  if (status.isCompleted) return 'completed';
  if (status.key.includes('progress') || status.key.includes('doing')) return 'success';
  if (status.key.includes('review') || status.key.includes('qa')) return 'planning';
  return 'secondary';
}

export function formatStatusLabel(status: WorkflowStatus): string {
  return status.name;
}

export function activeStatuses(statuses: WorkflowStatus[]): WorkflowStatus[] {
  return statuses.filter((s) => !s.isArchived).sort((a, b) => a.order - b.order);
}

function getColumnIds(statuses: WorkflowStatus[]): string[] {
  return activeStatuses(statuses).map((s) => s.id);
}

/** Ordered task ids per column; iteration order of `tasks` defines order within each status. */
export function buildColumnTaskIds(
  tasks: Task[],
  statuses: WorkflowStatus[]
): Record<string, string[]> {
  const next = Object.fromEntries(
    getColumnIds(statuses).map((statusId) => [statusId, [] as string[]])
  );
  for (const t of tasks) {
    if (t.statusId && next[t.statusId]) {
      next[t.statusId].push(t.id);
    }
  }
  return next;
}

export function cloneColumnTaskIds(
  cols: Record<string, string[]>,
  statuses: WorkflowStatus[]
): Record<string, string[]> {
  const next = Object.fromEntries(
    getColumnIds(statuses).map((statusId) => [statusId, [...(cols[statusId] ?? [])]])
  );
  return next;
}

/** Stable signature for id + status; ignores reorder within the same status column. */
export function tasksIdStatusSignature(tasks: Task[]): string {
  return [...tasks]
    .map((t) => `${t.id}\0${t.statusId ?? ''}`)
    .sort()
    .join('\n');
}

export function findColumnForItemId(
  id: UniqueIdentifier,
  columns: Record<string, string[]>,
  statuses: WorkflowStatus[]
): string | null {
  const sid = String(id);
  const columnIds = getColumnIds(statuses);
  for (const statusId of columnIds) {
    if ((columns[statusId] ?? []).includes(sid)) return statusId;
  }
  if (columnIds.includes(sid)) {
    return sid;
  }
  return null;
}

/** Cross-column move for multi-container sortable boards (see dnd-kit multiple sortable lists). */
export function moveTaskBetweenColumns(
  columns: Record<string, string[]>,
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  statuses: WorkflowStatus[]
): Record<string, string[]> | null {
  const activeContainer = findColumnForItemId(activeId, columns, statuses);
  const overContainer = findColumnForItemId(overId, columns, statuses);
  if (!activeContainer || !overContainer || activeContainer === overContainer) {
    return null;
  }

  const aid = String(activeId);
  const activeItems = [...(columns[activeContainer] ?? [])];
  const overItems = [...(columns[overContainer] ?? [])];
  const activeIndex = activeItems.indexOf(aid);
  if (activeIndex === -1) return null;

  activeItems.splice(activeIndex, 1);

  const overIsColumn = getColumnIds(statuses).includes(String(overId));
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

export function countTasksByStatusId(tasks: Task[], statuses: WorkflowStatus[]) {
  const next = Object.fromEntries(statuses.map((s) => [s.id, 0])) as Record<
    string,
    number
  >;
  for (const t of tasks) {
    if (t.statusId && next[t.statusId] !== undefined) {
      next[t.statusId] += 1;
    }
  }
  return next;
}
