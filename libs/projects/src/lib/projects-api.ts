import { apiFetch, parseJsonOrThrow } from './http';
import type {
  Project,
  ProjectMembersResponse,
  ProjectStatus,
  Task,
  TaskStatus,
} from './types';

export async function fetchProjects(): Promise<Project[]> {
  const res = await apiFetch('/projects');
  return parseJsonOrThrow<Project[]>(res);
}

export async function fetchProject(id: string): Promise<Project> {
  const res = await apiFetch(`/projects/${id}`);
  return parseJsonOrThrow<Project>(res);
}

export async function createProject(input: {
  name: string;
  description?: string;
  status?: ProjectStatus;
}): Promise<Project> {
  const res = await apiFetch('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow<Project>(res);
}

export async function updateProject(
  id: string,
  input: Partial<{ name: string; description: string | null; status: ProjectStatus }>
): Promise<Project> {
  const res = await apiFetch(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow<Project>(res);
}

export async function deleteProject(id: string): Promise<void> {
  const res = await apiFetch(`/projects/${id}`, { method: 'DELETE' });
  if (!res.ok) await parseJsonOrThrow(res);
}

export async function fetchTasks(projectId: string): Promise<Task[]> {
  const res = await apiFetch(`/projects/${projectId}/tasks`);
  return parseJsonOrThrow<Task[]>(res);
}

export async function fetchProjectMembers(
  projectId: string
): Promise<ProjectMembersResponse> {
  const res = await apiFetch(`/projects/${projectId}/members`);
  return parseJsonOrThrow<ProjectMembersResponse>(res);
}

export async function addProjectMember(
  projectId: string,
  email: string
): Promise<{ userId: string; email: string }> {
  const res = await apiFetch(`/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return parseJsonOrThrow<{ userId: string; email: string }>(res);
}

export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<void> {
  const res = await apiFetch(`/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) await parseJsonOrThrow(res);
}

export async function createTask(
  projectId: string,
  input: {
    title: string;
    description?: string | null;
    status?: TaskStatus;
    startDate?: string | null;
    endDate?: string | null;
    assigneeId?: string | null;
  }
): Promise<Task> {
  const res = await apiFetch(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow<Task>(res);
}

export async function updateTask(
  projectId: string,
  taskId: string,
  input: Partial<{
    title: string;
    description: string | null;
    done: boolean;
    status: TaskStatus;
    startDate: string | null;
    endDate: string | null;
    assigneeId: string | null;
  }>
): Promise<Task> {
  const res = await apiFetch(`/projects/${projectId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow<Task>(res);
}
