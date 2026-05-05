'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@nx-projects/ui-components';
import {
  useAddProjectMember,
  useCreateTask,
  useDeleteProject,
  useMe,
  useProject,
  useProjectMembers,
  useRemoveProjectMember,
  useTasks,
  useUpdateProject,
  useUpdateTask,
  type ProjectStatus,
  type Task,
  type TaskStatus,
} from '@nx-projects/projects';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const STATUSES: ProjectStatus[] = [
  'planning',
  'active',
  'completed',
  'archived',
];

const TASK_STATUSES: TaskStatus[] = [
  'todo',
  'in_progress',
  'review',
  'done',
  'cancelled',
];

function isoDateToInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function taskStatusBadgeVariant(
  s: TaskStatus
): 'success' | 'planning' | 'completed' | 'archived' | 'secondary' | 'default' {
  switch (s) {
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

function statusVariant(
  s: ProjectStatus
): 'success' | 'planning' | 'completed' | 'archived' | 'default' {
  switch (s) {
    case 'active':
      return 'success';
    case 'planning':
      return 'planning';
    case 'completed':
      return 'completed';
    case 'archived':
      return 'archived';
    default:
      return 'default';
  }
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = typeof params['id'] === 'string' ? params['id'] : undefined;
  const { data: user, isPending: mePending, isError: meError } = useMe();
  const { data: project, isLoading, isError } = useProject(id);
  const update = useUpdateProject();
  const del = useDeleteProject();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { data: tasks, isLoading: tasksLoading } = useTasks(id);
  const { data: membersData, isLoading: membersLoading } = useProjectMembers(id);
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const router = useRouter();

  const [projectEditOpen, setProjectEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planning');

  const [memberEmail, setMemberEmail] = useState('');

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('todo');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskEndDate, setTaskEndDate] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');

  useEffect(() => {
    if (!mePending && (meError || user === null)) router.replace('/login');
  }, [mePending, meError, user, router]);

  useEffect(() => {
    if (project && projectEditOpen) {
      setName(project.name);
      setDescription(project.description ?? '');
      setStatus(project.status);
    }
  }, [project, projectEditOpen]);

  function openCreateTask() {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskStatus('todo');
    setTaskStartDate('');
    setTaskEndDate('');
    setTaskAssigneeId('');
    setTaskModalOpen(true);
  }

  function openEditTask(t: Task) {
    setEditingTaskId(t.id);
    setTaskTitle(t.title);
    setTaskDescription(t.description ?? '');
    setTaskStatus(t.status);
    setTaskStartDate(isoDateToInput(t.startDate));
    setTaskEndDate(isoDateToInput(t.endDate));
    setTaskAssigneeId(t.assigneeId ?? '');
    setTaskModalOpen(true);
  }

  async function onSaveProject(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    await update.mutateAsync({
      id,
      patch: {
        name: name.trim(),
        description: description.trim() || null,
        status,
      },
    });
    setProjectEditOpen(false);
  }

  async function onDelete() {
    if (!id || !globalThis.confirm('Delete this project?')) return;
    await del.mutateAsync(id);
    setProjectEditOpen(false);
    router.replace('/projects');
  }

  async function onSubmitTask(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    const title = taskTitle.trim();
    if (!title) return;
    const startIso =
      taskStartDate.trim() === '' ? null : new Date(taskStartDate + 'T12:00:00').toISOString();
    const endIso =
      taskEndDate.trim() === '' ? null : new Date(taskEndDate + 'T12:00:00').toISOString();
    const assignee =
      taskAssigneeId.trim() === '' ? null : taskAssigneeId.trim();
    if (editingTaskId) {
      await updateTask.mutateAsync({
        projectId: id,
        taskId: editingTaskId,
        patch: {
          title,
          description: taskDescription.trim() || null,
          status: taskStatus,
          startDate: startIso,
          endDate: endIso,
          assigneeId: assignee,
        },
      });
    } else {
      await createTask.mutateAsync({
        projectId: id,
        title,
        description: taskDescription.trim() || null,
        status: taskStatus,
        startDate: startIso,
        endDate: endIso,
        assigneeId: assignee,
      });
    }
    setTaskModalOpen(false);
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskStatus('todo');
    setTaskStartDate('');
    setTaskEndDate('');
    setTaskAssigneeId('');
  }

  async function onAddMember(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    const email = memberEmail.trim().toLowerCase();
    if (!email) return;
    await addMember.mutateAsync({ projectId: id, email });
    setMemberEmail('');
  }

  async function onRemoveMember(userId: string) {
    if (!id || !globalThis.confirm('Remove this team member?')) return;
    await removeMember.mutateAsync({ projectId: id, userId });
  }

  if (mePending || user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading project…
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <p className="text-destructive">Project not found.</p>
        <Link href="/projects" className="mt-4 inline-block text-primary underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const taskMutationPending = editingTaskId
    ? updateTask.isPending
    : createTask.isPending;
  const taskMutationError = editingTaskId ? updateTask.isError : createTask.isError;
  const taskMutationErr =
    (editingTaskId ? updateTask.error : createTask.error) ?? null;

  const isOwner = project.currentUserRole !== 'member';
  const assigneeOptions =
    membersData !== undefined
      ? [
          {
            userId: membersData.owner.userId,
            label: `${membersData.owner.email} (owner)`,
          },
          ...membersData.members.map((m) => ({
            userId: m.userId,
            label: m.email,
          })),
        ]
      : [];

  const selectClass =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/projects"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Projects
          </Link>
          <Badge variant={statusVariant(project.status)}>{project.status}</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-xl">{project.name}</CardTitle>
              <CardDescription>
                Created {new Date(project.createdAt).toLocaleString()}
              </CardDescription>
            </div>
            {isOwner ? (
              <Button type="button" variant="outline" onClick={() => setProjectEditOpen(true)}>
                Edit project
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {project.description?.trim() ? project.description : 'No description.'}
            </p>
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>Team</CardTitle>
              <CardDescription>
                {isOwner
                  ? 'Invite collaborators by email (they must already have an account).'
                  : 'People with access to this project.'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {membersLoading ? (
              <p className="text-sm text-muted-foreground">Loading team…</p>
            ) : membersData ? (
              <>
                <ul className="space-y-2">
                  <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="break-all">{membersData.owner.email}</span>
                    <Badge variant="outline">Owner</Badge>
                  </li>
                  {membersData.members.map((m) => (
                    <li
                      key={m.userId}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="break-all">{m.email}</span>
                      {isOwner ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={removeMember.isPending}
                          onClick={() => void onRemoveMember(m.userId)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Badge variant="secondary">Member</Badge>
                      )}
                    </li>
                  ))}
                </ul>
                {isOwner ? (
                  <form onSubmit={(ev) => void onAddMember(ev)} className="flex flex-wrap gap-2">
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      value={memberEmail}
                      onChange={(ev) => setMemberEmail(ev.target.value)}
                      className="min-w-[200px] flex-1"
                      autoComplete="email"
                    />
                    <Button type="submit" disabled={addMember.isPending}>
                      {addMember.isPending ? 'Adding…' : 'Add member'}
                    </Button>
                  </form>
                ) : null}
                {addMember.isError ? (
                  <p className="text-sm text-destructive">
                    {(addMember.error as Error)?.message ?? 'Could not add member'}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Could not load team.</p>
            )}
          </CardContent>
        </Card>

        <Dialog open={projectEditOpen} onOpenChange={setProjectEditOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit project</DialogTitle>
              <DialogDescription>Update details or delete this project.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(ev) => void onSaveProject(ev)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={description}
                  onChange={(ev) => setDescription(ev.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={status}
                  onChange={(ev) =>
                    setStatus(ev.target.value as ProjectStatus)
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {update.isError ? (
                <p className="text-sm text-destructive">
                  {(update.error as Error)?.message ?? 'Update failed'}
                </p>
              ) : null}
              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={del.isPending}
                  onClick={() => void onDelete()}
                >
                  {del.isPending ? 'Deleting…' : 'Delete'}
                </Button>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setProjectEditOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={update.isPending}>
                    {update.isPending ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Card className="mt-8">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>Tasks</CardTitle>
              <CardDescription>Work items for this project.</CardDescription>
            </div>
            <Button type="button" onClick={openCreateTask}>
              Add task
            </Button>
          </CardHeader>
          <CardContent>
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Task list
              </h3>
              {tasksLoading ? (
                <p className="text-sm text-muted-foreground">Loading tasks…</p>
              ) : !tasks?.length ? (
                <p className="text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                <ul className="space-y-3">
                  {tasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-card/50 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{t.title}</span>
                          <Badge variant={taskStatusBadgeVariant(t.status)}>
                            {t.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        {t.description ? (
                          <p className="text-sm text-muted-foreground">{t.description}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {t.startDate || t.endDate ? (
                            <>
                              {t.startDate
                                ? `Start ${new Date(t.startDate).toLocaleDateString()}`
                                : null}
                              {t.startDate && t.endDate ? ' · ' : null}
                              {t.endDate
                                ? `End ${new Date(t.endDate).toLocaleDateString()}`
                                : null}
                              {' · '}
                            </>
                          ) : null}
                          Assignee: {t.assignee?.email ?? '—'} · Created{' '}
                          {new Date(t.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditTask(t)}
                      >
                        Edit
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTaskId ? 'Edit task' : 'New task'}</DialogTitle>
              <DialogDescription>
                {editingTaskId
                  ? 'Update fields including status, schedule, and assignee.'
                  : 'Add a task with optional dates and owner.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(ev) => void onSubmitTask(ev)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-title-input">Title</Label>
                <Input
                  id="task-title-input"
                  placeholder="Task title"
                  value={taskTitle}
                  onChange={(ev) => setTaskTitle(ev.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-notes-input">Notes (optional)</Label>
                <Input
                  id="task-notes-input"
                  placeholder="Short description"
                  value={taskDescription}
                  onChange={(ev) => setTaskDescription(ev.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-status-input">Status</Label>
                <select
                  id="task-status-input"
                  className={selectClass}
                  value={taskStatus}
                  onChange={(ev) => setTaskStatus(ev.target.value as TaskStatus)}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="task-start">Start date</Label>
                  <Input
                    id="task-start"
                    type="date"
                    value={taskStartDate}
                    onChange={(ev) => setTaskStartDate(ev.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-end">End date</Label>
                  <Input
                    id="task-end"
                    type="date"
                    value={taskEndDate}
                    onChange={(ev) => setTaskEndDate(ev.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-assignee">Assignee</Label>
                <select
                  id="task-assignee"
                  className={selectClass}
                  value={taskAssigneeId}
                  onChange={(ev) => setTaskAssigneeId(ev.target.value)}
                >
                  <option value="">Unassigned</option>
                  {assigneeOptions.map((o) => (
                    <option key={o.userId} value={o.userId}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {taskMutationError ? (
                <p className="text-sm text-destructive">
                  {(taskMutationErr as Error)?.message ?? 'Request failed'}
                </p>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTaskModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={taskMutationPending}>
                  {taskMutationPending
                    ? editingTaskId
                      ? 'Saving…'
                      : 'Adding…'
                    : editingTaskId
                      ? 'Save'
                      : 'Add task'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
