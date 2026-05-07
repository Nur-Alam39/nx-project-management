import type { Prisma, PrismaClient, WorkflowStatus } from '@prisma/client';
import { prisma } from './prisma.js';

const DEFAULT_TEMPLATE_KEY = 'default';
const DEFAULT_TEMPLATE_NAME = 'Default workflow';

const DEFAULT_TEMPLATE_STATUSES: Array<{
  key: string;
  name: string;
  order: number;
  isCompleted: boolean;
}> = [
  { key: 'todo', name: 'To Do', order: 0, isCompleted: false },
  { key: 'in_progress', name: 'In Progress', order: 1, isCompleted: false },
  { key: 'review', name: 'Review', order: 2, isCompleted: false },
  { key: 'done', name: 'Done', order: 3, isCompleted: true },
  { key: 'cancelled', name: 'Cancelled', order: 4, isCompleted: false },
];

type DbClient = PrismaClient | Prisma.TransactionClient;

function slugifyStatusKey(input: string): string {
  const key = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return key || 'status';
}

function ensureUniqueKey(baseKey: string, takenKeys: Set<string>): string {
  if (!takenKeys.has(baseKey)) {
    return baseKey;
  }
  let i = 2;
  while (takenKeys.has(`${baseKey}_${i}`)) {
    i += 1;
  }
  return `${baseKey}_${i}`;
}

export function workflowStatusJson(status: WorkflowStatus) {
  return {
    id: status.id,
    key: status.key,
    name: status.name,
    order: status.order,
    isCompleted: status.isCompleted,
    color: status.color,
    isArchived: status.isArchived,
  };
}

async function ensureDefaultWorkflowTemplate(db: DbClient) {
  const existing = await db.workflowTemplate.findUnique({
    where: { key: DEFAULT_TEMPLATE_KEY },
    include: { statuses: { orderBy: { order: 'asc' } } },
  });
  if (existing && existing.statuses.length > 0) {
    return existing;
  }
  if (existing) {
    await db.workflowStatus.createMany({
      data: DEFAULT_TEMPLATE_STATUSES.map((s) => ({
        key: s.key,
        name: s.name,
        order: s.order,
        isCompleted: s.isCompleted,
        templateId: existing.id,
      })),
    });
    return db.workflowTemplate.findUniqueOrThrow({
      where: { id: existing.id },
      include: { statuses: { orderBy: { order: 'asc' } } },
    });
  }
  return db.workflowTemplate.create({
    data: {
      key: DEFAULT_TEMPLATE_KEY,
      name: DEFAULT_TEMPLATE_NAME,
      statuses: {
        create: DEFAULT_TEMPLATE_STATUSES,
      },
    },
    include: { statuses: { orderBy: { order: 'asc' } } },
  });
}

function statusMatchKey(legacyStatus: string | null): string {
  if (!legacyStatus) return 'todo';
  return slugifyStatusKey(legacyStatus);
}

async function backfillTaskStatusIds(
  db: DbClient,
  projectId: string,
  statuses: WorkflowStatus[]
) {
  const byKey = new Map(statuses.map((s) => [s.key, s]));
  const fallback = statuses.find((s) => !s.isArchived) ?? statuses[0];
  if (!fallback) return;

  const tasks = await db.task.findMany({
    where: { projectId, statusId: null },
    select: { id: true, status: true },
  });
  if (tasks.length === 0) return;

  for (const task of tasks) {
    const key = statusMatchKey(task.status);
    const status = byKey.get(key) ?? fallback;
    await db.task.update({
      where: { id: task.id },
      data: { statusId: status.id, done: status.isCompleted, status: status.key },
    });
  }
}

export async function ensureProjectWorkflow(projectId: string): Promise<WorkflowStatus[]> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.workflowStatus.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    if (existing.length > 0) {
      await backfillTaskStatusIds(tx, projectId, existing);
      return existing;
    }

    const template = await ensureDefaultWorkflowTemplate(tx);
    const created = await Promise.all(
      template.statuses.map((status) =>
        tx.workflowStatus.create({
          data: {
            projectId,
            key: status.key,
            name: status.name,
            order: status.order,
            isCompleted: status.isCompleted,
            color: status.color,
            isArchived: false,
          },
        })
      )
    );

    await backfillTaskStatusIds(tx, projectId, created);
    return created.sort((a, b) => a.order - b.order);
  });
}

export async function listProjectWorkflowStatuses(
  projectId: string,
  includeArchived = true
): Promise<WorkflowStatus[]> {
  await ensureProjectWorkflow(projectId);
  return prisma.workflowStatus.findMany({
    where: { projectId, ...(includeArchived ? {} : { isArchived: false }) },
    orderBy: { order: 'asc' },
  });
}

export function pickDefaultWorkflowStatus(statuses: WorkflowStatus[]): WorkflowStatus {
  const fallback = statuses.find((s) => !s.isArchived);
  if (!fallback) {
    throw new Error('Project workflow has no active status');
  }
  return fallback;
}

export async function resolveWorkflowStatusInput(params: {
  projectId: string;
  statusId?: unknown;
  statusKey?: unknown;
  allowArchived?: boolean;
}): Promise<WorkflowStatus | null> {
  const statuses = await listProjectWorkflowStatuses(params.projectId, true);
  const allowArchived = params.allowArchived ?? false;

  if (params.statusId !== undefined && params.statusId !== null && params.statusId !== '') {
    const sid = String(params.statusId);
    const hit = statuses.find((s) => s.id === sid);
    if (!hit) return null;
    if (!allowArchived && hit.isArchived) return null;
    return hit;
  }

  if (
    params.statusKey !== undefined &&
    params.statusKey !== null &&
    String(params.statusKey).trim() !== ''
  ) {
    const key = slugifyStatusKey(String(params.statusKey));
    const hit = statuses.find((s) => s.key === key);
    if (!hit) return null;
    if (!allowArchived && hit.isArchived) return null;
    return hit;
  }

  return pickDefaultWorkflowStatus(statuses);
}

export async function buildWorkflowStatusCreateData(params: {
  projectId: string;
  name: string;
  key?: string;
  color?: string | null;
  isCompleted?: boolean;
}): Promise<Prisma.WorkflowStatusCreateInput> {
  const statuses = await listProjectWorkflowStatuses(params.projectId, true);
  const takenKeys = new Set(statuses.map((s) => s.key));
  const baseKey = slugifyStatusKey(params.key ?? params.name);
  const key = ensureUniqueKey(baseKey, takenKeys);
  const nextOrder =
    statuses.length > 0 ? Math.max(...statuses.map((s) => s.order)) + 1 : 0;

  return {
    key,
    name: params.name.trim(),
    order: nextOrder,
    color: params.color ?? null,
    isCompleted: Boolean(params.isCompleted),
    isArchived: false,
    project: { connect: { id: params.projectId } },
  };
}

export async function ensureSingleCompletedStatus(
  projectId: string,
  selectedStatusId: string
) {
  await prisma.$transaction(async (tx) => {
    await tx.workflowStatus.updateMany({
      where: { projectId, isCompleted: true, NOT: { id: selectedStatusId } },
      data: { isCompleted: false },
    });
    await tx.workflowStatus.update({
      where: { id: selectedStatusId },
      data: { isCompleted: true },
    });
  });
}

export function projectWorkflowInputToKey(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return slugifyStatusKey(s);
}
