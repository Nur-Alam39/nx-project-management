export function taskJson(task: {
  id: string;
  title: string;
  description: string | null;
  done: boolean;
  status: string;
  statusId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  assigneeId: string | null;
  createdAt: Date;
  projectId: string;
  assignee?: { id: string; email: string } | null;
  workflowStatus?: {
    id: string;
    key: string;
    name: string;
    order: number;
    isCompleted: boolean;
    isArchived: boolean;
    color: string | null;
  } | null;
}) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    done: task.done,
    status: task.status,
    statusId: task.statusId,
    workflowStatus: task.workflowStatus
      ? {
          id: task.workflowStatus.id,
          key: task.workflowStatus.key,
          name: task.workflowStatus.name,
          order: task.workflowStatus.order,
          isCompleted: task.workflowStatus.isCompleted,
          isArchived: task.workflowStatus.isArchived,
          color: task.workflowStatus.color,
        }
      : null,
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
