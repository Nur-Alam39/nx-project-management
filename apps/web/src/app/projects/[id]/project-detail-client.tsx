'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  FaArrowLeft,
  FaBoxArchive,
  FaCheck,
  FaCircleCheck,
  FaGripVertical,
  FaPenToSquare,
  FaPlus,
  FaXmark,
  Icon,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@nx-projects/ui-components';
import { ThemeToggle } from '@/components/theme-toggle';
import { ProjectKanban } from './project-kanban';
import { activeStatuses, countTasksByStatusId } from './kanban-helpers';
import {
  useAddProjectMember,
  useArchiveWorkflowStatus,
  useCreateWorkflowStatus,
  useCreateTask,
  useDeleteProject,
  useMe,
  useProject,
  useProjectMembers,
  useReorderWorkflowStatuses,
  useRemoveProjectMember,
  useTasks,
  useUpdateProject,
  useUpdateTask,
  useUpdateWorkflowStatus,
  useWorkflowStatuses,
  type ProjectStatus,
  type Task,
  type WorkflowStatus,
} from '@nx-projects/projects';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

/** Select value for “filter to tasks with no assignee” */
const TASK_FILTER_UNASSIGNED = '__unassigned__';

const STATUSES: ProjectStatus[] = [
  'planning',
  'active',
  'completed',
  'archived',
];

function isoDateToInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
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

function WorkflowStatusRow({
  statusRow,
  isOwner,
  isRenaming,
  editingStatusName,
  editingStatusColor,
  setEditingStatusName,
  setEditingStatusColor,
  onStartRename,
  onCancelRename,
  onSaveRename,
  onSetCompletedStatus,
  onArchiveStatus,
  pending,
  disableArchive,
}: {
  statusRow: WorkflowStatus;
  isOwner: boolean;
  isRenaming: boolean;
  editingStatusName: string;
  editingStatusColor: string;
  setEditingStatusName: (value: string) => void;
  setEditingStatusColor: (value: string) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onSaveRename: () => void;
  onSetCompletedStatus: () => void;
  onArchiveStatus: () => void;
  pending: boolean;
  disableArchive: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: statusRow.id,
    disabled: !isOwner || isRenaming,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded border border-border bg-card p-2 ${
        isDragging ? 'opacity-60 shadow-sm' : ''
      }`}
    >
      {isOwner ? (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Reorder ${statusRow.name}`}
          title="Drag to reorder"
          disabled={isRenaming}
          {...attributes}
          {...listeners}
        >
          <Icon icon={FaGripVertical} size={14} />
        </button>
      ) : null}
      {isRenaming ? (
        <div className="flex min-w-[10rem] flex-1 items-center gap-2">
          <Input
            value={editingStatusName}
            onChange={(ev) => setEditingStatusName(ev.target.value)}
            className="h-8 min-w-[10rem] flex-1"
            autoFocus
          />
          <Input
            type="color"
            value={editingStatusColor}
            onChange={(ev) => setEditingStatusColor(ev.target.value)}
            className="h-8 w-10 p-1"
            aria-label={`Color for ${statusRow.name}`}
            title="Pick status color"
          />
        </div>
      ) : (
        <span className="flex min-w-[10rem] flex-1 items-center gap-2 text-sm">
          <span
            className="inline-block h-3 w-3 rounded-full border border-border"
            style={{ backgroundColor: statusRow.color ?? '#94a3b8' }}
            aria-hidden="true"
          />
          {statusRow.name}
        </span>
      )}
      {statusRow.isCompleted ? <Badge variant="completed">Completed</Badge> : null}
      {isOwner ? (
        <div className="ml-auto flex items-center gap-1">
          {isRenaming ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={onSaveRename}
                disabled={pending}
                aria-label={`Save name for ${statusRow.name}`}
                title="Save rename"
              >
                <Icon icon={FaCheck} size={14} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={onCancelRename}
                aria-label={`Cancel rename for ${statusRow.name}`}
                title="Cancel rename"
              >
                <Icon icon={FaXmark} size={14} />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={onStartRename}
              aria-label={`Rename ${statusRow.name}`}
              title="Rename status"
            >
              <Icon icon={FaPenToSquare} size={14} />
            </Button>
          )}
          {!statusRow.isCompleted ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={onSetCompletedStatus}
              disabled={pending}
              aria-label={`Set ${statusRow.name} as completed`}
              title="Set as completed status"
            >
              <Icon icon={FaCircleCheck} size={14} />
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onArchiveStatus}
            disabled={disableArchive || pending}
            aria-label={`Archive ${statusRow.name}`}
            title="Archive status"
          >
            <Icon icon={FaBoxArchive} size={14} />
          </Button>
        </div>
      ) : null}
    </li>
  );
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
  const { data: workflowStatuses = [], isLoading: workflowLoading } =
    useWorkflowStatuses(id);
  const { data: membersData, isLoading: membersLoading } = useProjectMembers(id);
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const createWorkflowStatus = useCreateWorkflowStatus();
  const updateWorkflowStatus = useUpdateWorkflowStatus();
  const reorderWorkflowStatuses = useReorderWorkflowStatuses();
  const archiveWorkflowStatus = useArchiveWorkflowStatus();
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
  const [taskStatusId, setTaskStatusId] = useState('');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskEndDate, setTaskEndDate] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#64748b');
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStatusName, setEditingStatusName] = useState('');
  const [editingStatusColor, setEditingStatusColor] = useState('#64748b');
  const [workflowOrder, setWorkflowOrder] = useState<string[]>([]);

  const [taskFilterAssignee, setTaskFilterAssignee] = useState<string>('');

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

  const filteredTasks = useMemo(() => {
    if (!tasks?.length) return [];
    return tasks.filter((t) => {
      if (taskFilterAssignee === TASK_FILTER_UNASSIGNED) {
        if (t.assigneeId != null) return false;
      } else if (taskFilterAssignee) {
        if (t.assigneeId !== taskFilterAssignee) return false;
      }
      return true;
    });
  }, [tasks, taskFilterAssignee]);

  const orderedWorkflowStatuses = useMemo(
    () => activeStatuses(workflowStatuses),
    [workflowStatuses]
  );
  const workflowSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const workflowStatusById = useMemo(
    () => new Map(orderedWorkflowStatuses.map((s) => [s.id, s])),
    [orderedWorkflowStatuses]
  );
  const displayedWorkflowStatuses = useMemo(() => {
    if (workflowOrder.length === 0) {
      return orderedWorkflowStatuses;
    }
    return workflowOrder
      .map((statusId) => workflowStatusById.get(statusId))
      .filter((status): status is WorkflowStatus => status !== undefined);
  }, [workflowOrder, workflowStatusById, orderedWorkflowStatuses]);

  useEffect(() => {
    setWorkflowOrder(orderedWorkflowStatuses.map((s) => s.id));
  }, [orderedWorkflowStatuses]);

  useEffect(() => {
    if (!taskStatusId && orderedWorkflowStatuses.length > 0) {
      setTaskStatusId(orderedWorkflowStatuses[0].id);
    }
  }, [taskStatusId, orderedWorkflowStatuses]);

  const taskMetrics = useMemo(() => {
    const byStatus = countTasksByStatusId(tasks ?? [], orderedWorkflowStatuses);
    if (!tasks?.length) {
      return { total: 0, byStatus };
    }
    return { total: tasks.length, byStatus };
  }, [tasks, orderedWorkflowStatuses]);

  function openCreateTask() {
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskStatusId(orderedWorkflowStatuses[0]?.id ?? '');
    setTaskStartDate('');
    setTaskEndDate('');
    setTaskAssigneeId('');
    setTaskModalOpen(true);
  }

  function openEditTask(t: Task) {
    setEditingTaskId(t.id);
    setTaskTitle(t.title);
    setTaskDescription(t.description ?? '');
    setTaskStatusId(t.statusId ?? orderedWorkflowStatuses[0]?.id ?? '');
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
    if (!taskStatusId) return;
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
          statusId: taskStatusId,
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
        statusId: taskStatusId,
        startDate: startIso,
        endDate: endIso,
        assigneeId: assignee,
      });
    }
    setTaskModalOpen(false);
    setEditingTaskId(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskStatusId(orderedWorkflowStatuses[0]?.id ?? '');
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

  async function onCreateWorkflowStatus(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    const name = newStatusName.trim();
    if (!name) return;
    await createWorkflowStatus.mutateAsync({
      projectId: id,
      payload: { name, color: newStatusColor },
    });
    setNewStatusName('');
    setNewStatusColor('#64748b');
  }

  async function onSaveStatusRename(statusId: string) {
    if (!id) return;
    const next = editingStatusName.trim();
    if (!next) return;
    await updateWorkflowStatus.mutateAsync({
      projectId: id,
      statusId,
      patch: { name: next, color: editingStatusColor },
    });
    setEditingStatusId(null);
    setEditingStatusName('');
    setEditingStatusColor('#64748b');
  }

  async function onSetCompletedStatus(statusId: string) {
    if (!id) return;
    await updateWorkflowStatus.mutateAsync({
      projectId: id,
      statusId,
      patch: { isCompleted: true },
    });
  }

  async function onArchiveStatus(status: WorkflowStatus) {
    if (!id || !globalThis.confirm(`Archive "${status.name}"?`)) return;
    await archiveWorkflowStatus.mutateAsync({ projectId: id, statusId: status.id });
  }

  function onWorkflowDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!id || !over || active.id === over.id) return;

    const oldIndex = displayedWorkflowStatuses.findIndex((s) => s.id === active.id);
    const newIndex = displayedWorkflowStatuses.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const previousOrder = displayedWorkflowStatuses.map((s) => s.id);
    const reordered = arrayMove(displayedWorkflowStatuses, oldIndex, newIndex);
    const reorderedIds = reordered.map((s) => s.id);
    setWorkflowOrder(reorderedIds);
    void reorderWorkflowStatuses
      .mutateAsync({
        projectId: id,
        statusIds: reorderedIds,
      })
      .catch(() => {
        setWorkflowOrder(previousOrder);
      });
  }

  if (mePending || user === undefined) {
    return (
      <div className="flex h-full min-h-[100dvh] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) {
    return (
      <div className="flex h-full min-h-[100dvh] items-center justify-center px-4 text-center text-muted-foreground">
        Redirecting to sign in…
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[100dvh] items-center justify-center text-muted-foreground">
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

  const filterSelectClass =
    'flex h-8 min-h-8 min-w-0 rounded-md border border-input bg-transparent px-2 py-0 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="z-40 shrink-0 border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/projects"
              className="inline-flex shrink-0 items-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Back to projects"
            >
              <Icon icon={FaArrowLeft} size={18} />
            </Link>
            <span className="truncate font-medium text-xl">{project.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Badge variant={statusVariant(project.status)}>{project.status}</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-4 py-4">
        <Tabs defaultValue="dashboard" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="shrink-0 justify-start">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
          </TabsList>

          <TabsContent
            value="dashboard"
            className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain"
          >
            <div className="grid gap-3 sm:grid-cols-4 space-y-3">
              <div className="col-span-3">
                <Card className="shrink-0">
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{project.name}</CardTitle>
                      <CardDescription>
                        Created {new Date(project.createdAt).toLocaleString()}
                      </CardDescription>
                    </div>
                    {isOwner ? (
                      <Button type="button" variant="outline" onClick={() => setProjectEditOpen(true)}>
                        <Icon icon={FaPenToSquare} size={16} />
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
                <div className="grid gap-3 sm:grid-cols-2 my-3">
                  <Card className="h-full">
                    <CardHeader className="pb-2 pt-4">
                      <CardDescription>Total tasks</CardDescription>
                      <CardTitle className="text-2xl tabular-nums">{taskMetrics.total}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2 pt-4">
                      <CardDescription>Team size</CardDescription>
                      <CardTitle className="text-2xl tabular-nums">
                        {membersLoading ? (
                          <span className="text-muted-foreground">…</span>
                        ) : membersData ? (
                          1 + membersData.members.length
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>
                <Card>
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <CardDescription>Tasks by status</CardDescription>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {taskMetrics.total} total
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-4 pb-4 sm:flex-row sm:items-center">
                    <div className="relative h-40 w-40 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={
                              taskMetrics.total > 0
                                ? orderedWorkflowStatuses
                                    .map((s) => ({
                                      id: s.id,
                                      name: s.name,
                                      value: taskMetrics.byStatus[s.id] ?? 0,
                                      color: s.color ?? '#94a3b8',
                                    }))
                                    .filter((d) => d.value > 0)
                                : [{ id: '__empty__', name: 'No tasks', value: 1, color: 'var(--muted)' }]
                            }
                            dataKey="value"
                            nameKey="name"
                            innerRadius="65%"
                            outerRadius="100%"
                            paddingAngle={taskMetrics.total > 0 ? 2 : 0}
                            stroke="none"
                            isAnimationActive={false}
                          >
                            {(taskMetrics.total > 0
                              ? orderedWorkflowStatuses
                                  .map((s) => ({
                                    id: s.id,
                                    color: s.color ?? '#94a3b8',
                                    value: taskMetrics.byStatus[s.id] ?? 0,
                                  }))
                                  .filter((d) => d.value > 0)
                              : [{ id: '__empty__', color: 'hsl(var(--muted))' }]
                            ).map((entry) => (
                              <Cell key={entry.id} fill={entry.color} />
                            ))}
                          </Pie>
                          {taskMetrics.total > 0 ? (
                            <Tooltip
                              cursor={false}
                              contentStyle={{
                                background: 'hsl(var(--popover))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: 8,
                                fontSize: 12,
                                padding: '6px 10px',
                              }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                              formatter={(value: number, name: string) => [
                                `${value} (${((value / taskMetrics.total) * 100).toFixed(0)}%)`,
                                name,
                              ]}
                            />
                          ) : null}
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-semibold tabular-nums leading-none">
                          {taskMetrics.total}
                        </span>
                        <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          tasks
                        </span>
                      </div>
                    </div>
                    <ul className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-1 md:grid-cols-2">
                      {orderedWorkflowStatuses.map((s) => {
                        const count = taskMetrics.byStatus[s.id] ?? 0;
                        const pct =
                          taskMetrics.total > 0
                            ? Math.round((count / taskMetrics.total) * 100)
                            : 0;
                        return (
                          <li key={s.id} className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                              style={{ backgroundColor: s.color ?? '#94a3b8' }}
                              aria-hidden="true"
                            />
                            <span className="truncate text-muted-foreground">{s.name}</span>
                            <span className="ml-auto whitespace-nowrap font-medium tabular-nums">
                              {count}
                              <span className="ml-1 text-muted-foreground">
                                · {pct}%
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-3">
                <Card className="flex min-h-0 shrink-0 flex-col overflow-hidden">
                  <CardHeader className="shrink-0 flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
                    <div className="space-y-1">
                      <CardTitle>Team</CardTitle>
                      <CardDescription>
                        {isOwner
                          ? 'Invite collaborators by email (they must already have an account).'
                          : 'People with access to this project.'}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="max-h-[min(100dvh,32rem)] space-y-4 overflow-y-auto overscroll-y-contain">
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
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4 flex min-h-0 flex-1 flex-col">
            <div className="flex justify-between mb-3">
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex min-w-[min(100%,14rem)] flex-[1_1_12rem] items-center gap-2">
                  <select
                    id="task-filter-assignee"
                    className={filterSelectClass}
                    value={taskFilterAssignee}
                    onChange={(ev) => setTaskFilterAssignee(ev.target.value)}
                  >
                    <option value="">All Assignee</option>
                    <option value={TASK_FILTER_UNASSIGNED}>Unassigned</option>
                    {assigneeOptions.map((o) => (
                      <option key={o.userId} value={o.userId}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="button" size="sm" onClick={openCreateTask}>
                <Icon icon={FaPlus} size={14} />
                Add task
              </Button>
            </div>
            <Card className="flex min-h-0 flex-1 flex-col border-none p-0 shadow-none">
              <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-0 pb-4 pt-4">
                <div className="flex min-h-0 flex-1 flex-col">
                  <ProjectKanban
                    workflowStatuses={orderedWorkflowStatuses}
                    filteredTasks={filteredTasks}
                    tasksLoading={tasksLoading}
                    totalTaskCount={tasks?.length ?? 0}
                    onEditTask={openEditTask}
                    onMoveTask={async (taskId, statusId) => {
                      if (!id) return;
                      await updateTask.mutateAsync({
                        projectId: id,
                        taskId,
                        patch: { statusId },
                      });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="workflow" className="mt-4 flex min-h-0 flex-1 flex-col">
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CardHeader className="shrink-0 space-y-1">
                <CardTitle>Workflow</CardTitle>
                <CardDescription>
                  Manage custom task columns. Drag rows to reorder them.
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 space-y-3 overflow-y-auto overscroll-y-contain">
                {workflowLoading ? (
                  <p className="text-sm text-muted-foreground">Loading workflow…</p>
                ) : null}
                {isOwner ? (
                  <form onSubmit={(ev) => void onCreateWorkflowStatus(ev)} className="flex gap-2">
                    <Input
                      value={newStatusName}
                      onChange={(ev) => setNewStatusName(ev.target.value)}
                      placeholder="New status name"
                    />
                    <Input
                      type="color"
                      value={newStatusColor}
                      onChange={(ev) => setNewStatusColor(ev.target.value)}
                      className="h-9 w-12 p-1"
                      aria-label="New status color"
                      title="Pick status color"
                    />
                    <Button type="submit" disabled={createWorkflowStatus.isPending}>
                      Add
                    </Button>
                  </form>
                ) : null}
                {displayedWorkflowStatuses.length === 0 && !workflowLoading ? (
                  <p className="text-sm text-muted-foreground">No workflow statuses found.</p>
                ) : (
                  <DndContext
                    sensors={workflowSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onWorkflowDragEnd}
                  >
                    <SortableContext
                      items={displayedWorkflowStatuses.map((s) => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="space-y-2">
                        {displayedWorkflowStatuses.map((statusRow) => (
                          <WorkflowStatusRow
                            key={statusRow.id}
                            statusRow={statusRow}
                            isOwner={isOwner}
                            isRenaming={editingStatusId === statusRow.id}
                            editingStatusName={editingStatusName}
                            editingStatusColor={editingStatusColor}
                            setEditingStatusName={setEditingStatusName}
                            setEditingStatusColor={setEditingStatusColor}
                            onStartRename={() => {
                              setEditingStatusId(statusRow.id);
                              setEditingStatusName(statusRow.name);
                              setEditingStatusColor(statusRow.color ?? '#64748b');
                            }}
                            onCancelRename={() => {
                              setEditingStatusId(null);
                              setEditingStatusName('');
                              setEditingStatusColor('#64748b');
                            }}
                            onSaveRename={() => void onSaveStatusRename(statusRow.id)}
                            onSetCompletedStatus={() => void onSetCompletedStatus(statusRow.id)}
                            onArchiveStatus={() => void onArchiveStatus(statusRow)}
                            pending={
                              updateWorkflowStatus.isPending ||
                              reorderWorkflowStatuses.isPending ||
                              archiveWorkflowStatus.isPending
                            }
                            disableArchive={displayedWorkflowStatuses.length <= 1}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
                  value={taskStatusId}
                  onChange={(ev) => setTaskStatusId(ev.target.value)}
                >
                  {orderedWorkflowStatuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
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
