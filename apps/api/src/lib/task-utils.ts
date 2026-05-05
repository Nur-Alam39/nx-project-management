const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done', 'cancelled'] as const;

export function normalizeTaskStatus(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const s = String(raw);
  return TASK_STATUSES.includes(s as (typeof TASK_STATUSES)[number])
    ? s
    : undefined;
}

export function taskJson(task: {
  id: string;
  title: string;
  description: string | null;
  done: boolean;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  assigneeId: string | null;
  createdAt: Date;
  projectId: string;
  assignee?: { id: string; email: string } | null;
}) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    done: task.done,
    status: task.status,
    startDate: task.startDate ? task.startDate.toISOString() : null,
    endDate: task.endDate ? task.endDate.toISOString() : null,
    assigneeId: task.assigneeId,
    assignee: task.assignee
      ? { id: task.assignee.id, email: task.assignee.email }
      : null,
    createdAt: task.createdAt.toISOString(),
    projectId: task.projectId,
  };
}
