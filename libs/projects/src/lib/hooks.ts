'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  addProjectMember,
  createProject,
  createTask,
  deleteProject,
  fetchProject,
  fetchProjectMembers,
  fetchProjects,
  fetchTasks,
  removeProjectMember,
  updateProject,
  updateTask,
} from './projects-api';
import {
  fetchMe,
  loginRequest,
  logoutRequest,
  registerRequest,
} from './auth-api';
import type {
  Project,
  ProjectRole,
  ProjectStatus,
  Task,
  TaskStatus,
  User,
} from './types';
import { qk } from './queries';

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => fetchMe(),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => loginRequest(email, password),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => registerRequest(email, password),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => logoutRequest(),
    onSuccess: () => {
      qc.setQueryData(qk.me, null);
      void qc.invalidateQueries({ queryKey: qk.projects });
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: qk.projects,
    queryFn: () => fetchProjects(),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.project(id) : ['projects', 'noop'],
    queryFn: () => fetchProject(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.projects }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{
        name: string;
        description: string | null;
        status: ProjectStatus;
      }>;
    }) => updateProject(id, patch),
    onSuccess: (data: Project) => {
      void qc.invalidateQueries({ queryKey: qk.projects });
      void qc.invalidateQueries({ queryKey: qk.project(data.id) });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.projects }),
  });
}

export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? qk.tasks(projectId) : ['projects', 'tasks', 'noop'],
    queryFn: () => fetchTasks(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? qk.members(projectId) : ['projects', 'members', 'noop'],
    queryFn: () => fetchProjectMembers(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      email,
    }: {
      projectId: string;
      email: string;
    }) => addProjectMember(projectId, email),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: qk.members(variables.projectId) });
    },
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      userId,
    }: {
      projectId: string;
      userId: string;
    }) => removeProjectMember(projectId, userId),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: qk.members(variables.projectId) });
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      title,
      description,
      status,
      startDate,
      endDate,
      assigneeId,
    }: {
      projectId: string;
      title: string;
      description?: string | null;
      status?: TaskStatus;
      startDate?: string | null;
      endDate?: string | null;
      assigneeId?: string | null;
    }) =>
      createTask(projectId, {
        title,
        description,
        status,
        startDate,
        endDate,
        assigneeId,
      }),
    onSuccess: (_data: Task, variables) => {
      void qc.invalidateQueries({ queryKey: qk.tasks(variables.projectId) });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      taskId,
      patch,
    }: {
      projectId: string;
      taskId: string;
      patch: Partial<{
        title: string;
        description: string | null;
        done: boolean;
        status: TaskStatus;
        startDate: string | null;
        endDate: string | null;
        assigneeId: string | null;
      }>;
    }) => updateTask(projectId, taskId, patch),
    onSuccess: (_data: Task, variables) => {
      void qc.invalidateQueries({ queryKey: qk.tasks(variables.projectId) });
    },
  });
}

export type {
  Project,
  ProjectRole,
  ProjectStatus,
  Task,
  TaskStatus,
  User,
};
