export type ProjectStatus = 'planning' | 'active' | 'completed' | 'archived';

export type ProjectRole = 'owner' | 'member';

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  currentUserRole?: ProjectRole;
};

export type WorkflowStatus = {
  id: string;
  key: string;
  name: string;
  order: number;
  isCompleted: boolean;
  color: string | null;
  isArchived: boolean;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  done: boolean;
  status: string;
  statusId: string | null;
  workflowStatus: WorkflowStatus | null;
  startDate: string | null;
  endDate: string | null;
  assigneeId: string | null;
  assignee: { id: string; email: string } | null;
  createdAt: string;
  projectId: string;
};

export type ProjectMembersResponse = {
  owner: { userId: string; email: string };
  members: { userId: string; email: string }[];
};

export type User = {
  id: string;
  email: string;
};

export type ApiErrorBody = {
  message: string;
};
