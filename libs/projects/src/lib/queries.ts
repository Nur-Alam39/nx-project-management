export const qk = {
  me: ['auth', 'me'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  tasks: (projectId: string) => ['projects', projectId, 'tasks'] as const,
  members: (projectId: string) => ['projects', projectId, 'members'] as const,
  workflowStatuses: (projectId: string) =>
    ['projects', projectId, 'workflow-statuses'] as const,
};
