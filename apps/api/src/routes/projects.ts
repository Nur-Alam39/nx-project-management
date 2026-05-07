import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { findAccessibleProject } from '../lib/project-access.js';
import {
  buildWorkflowStatusCreateData,
  ensureProjectWorkflow,
  ensureSingleCompletedStatus,
  listProjectWorkflowStatuses,
  projectWorkflowInputToKey,
  workflowStatusJson,
} from '../lib/workflow-utils.js';
import { authMiddleware, type AuthedRequest } from '../middleware/auth.js';
import { createProjectMembersRouter } from './project-members.js';
import { createProjectTasksRouter } from './project-tasks.js';

export function createProjectsRouter(): Router {
  const router = Router();

  router.get('/', authMiddleware, async (req: AuthedRequest, res) => {
    const uid = req.userId as string;
    const projects = await prisma.project.findMany({
      where: {
        OR: [{ userId: uid }, { members: { some: { userId: uid } } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      }))
    );
  });

  router.post('/', authMiddleware, async (req: AuthedRequest, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }
    const description =
      req.body?.description === undefined || req.body?.description === null
        ? null
        : String(req.body.description);
    const status = String(req.body?.status ?? 'planning');
    const allowed = ['planning', 'active', 'completed', 'archived'];
    const statusOk = allowed.includes(status) ? status : 'planning';
    const project = await prisma.project.create({
      data: {
        name,
        description,
        status: statusOk,
        userId: req.userId as string,
      },
    });
    await ensureProjectWorkflow(project.id);
    res.status(201).json({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
    });
  });

  router.get('/:id', authMiddleware, async (req: AuthedRequest, res) => {
    const access = await findAccessibleProject(
      req.params['id'] as string,
      req.userId as string
    );
    if (!access) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const { project, role } = access;
    res.json({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      currentUserRole: role,
    });
  });

  router.get('/:id/workflow-statuses', authMiddleware, async (req: AuthedRequest, res) => {
    const access = await findAccessibleProject(
      req.params['id'] as string,
      req.userId as string
    );
    if (!access) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const includeArchived = String(req.query['includeArchived'] ?? 'true') === 'true';
    const statuses = await listProjectWorkflowStatuses(
      access.project.id,
      includeArchived
    );
    res.json(statuses.map((s) => workflowStatusJson(s)));
  });

  router.post('/:id/workflow-statuses', authMiddleware, async (req: AuthedRequest, res) => {
    const access = await findAccessibleProject(
      req.params['id'] as string,
      req.userId as string
    );
    if (!access) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    if (access.role !== 'owner') {
      res.status(403).json({ message: 'Only project owner can update workflow' });
      return;
    }
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ message: 'Status name is required' });
      return;
    }
    const createData = await buildWorkflowStatusCreateData({
      projectId: access.project.id,
      name,
      key: req.body?.key ? String(req.body.key) : undefined,
      color:
        req.body?.color === undefined || req.body?.color === null
          ? null
          : String(req.body.color),
      isCompleted: Boolean(req.body?.isCompleted),
    });
    const created = await prisma.workflowStatus.create({ data: createData });
    if (created.isCompleted) {
      await ensureSingleCompletedStatus(access.project.id, created.id);
    }
    const fresh = await prisma.workflowStatus.findUniqueOrThrow({
      where: { id: created.id },
    });
    res.status(201).json(workflowStatusJson(fresh));
  });

  router.patch(
    '/:id/workflow-statuses/reorder',
    authMiddleware,
    async (req: AuthedRequest, res) => {
      const access = await findAccessibleProject(
        req.params['id'] as string,
        req.userId as string
      );
      if (!access) {
        res.status(404).json({ message: 'Not found' });
        return;
      }
      if (access.role !== 'owner') {
        res.status(403).json({ message: 'Only project owner can update workflow' });
        return;
      }
      const statusIds = Array.isArray(req.body?.statusIds)
        ? req.body.statusIds.map((id: unknown) => String(id))
        : [];
      if (statusIds.length === 0) {
        res.status(400).json({ message: 'statusIds is required' });
        return;
      }
      const statuses = await listProjectWorkflowStatuses(access.project.id, false);
      if (statuses.length !== statusIds.length) {
        res.status(400).json({ message: 'statusIds must include all statuses' });
        return;
      }
      const expected = new Set(statuses.map((s) => s.id));
      const provided = new Set(statusIds);
      if (
        expected.size !== provided.size ||
        [...expected].some((id) => !provided.has(id))
      ) {
        res.status(400).json({ message: 'statusIds mismatch' });
        return;
      }
      await prisma.$transaction(
        statusIds.map((statusId: string, index: number) =>
          prisma.workflowStatus.update({
            where: { id: statusId },
            data: { order: index },
          })
        )
      );
      const reordered = await listProjectWorkflowStatuses(access.project.id, false);
      res.json(reordered.map((s) => workflowStatusJson(s)));
    }
  );

  router.patch(
    '/:id/workflow-statuses/:statusId',
    authMiddleware,
    async (req: AuthedRequest, res) => {
      const access = await findAccessibleProject(
        req.params['id'] as string,
        req.userId as string
      );
      if (!access) {
        res.status(404).json({ message: 'Not found' });
        return;
      }
      if (access.role !== 'owner') {
        res.status(403).json({ message: 'Only project owner can update workflow' });
        return;
      }
      const existing = await prisma.workflowStatus.findFirst({
        where: { id: req.params['statusId'], projectId: access.project.id },
      });
      if (!existing) {
        res.status(404).json({ message: 'Status not found' });
        return;
      }
      const data: {
        name?: string;
        key?: string;
        color?: string | null;
        isCompleted?: boolean;
        isArchived?: boolean;
      } = {};
      if (typeof req.body?.name === 'string') {
        const name = req.body.name.trim();
        if (!name) {
          res.status(400).json({ message: 'Status name cannot be empty' });
          return;
        }
        data.name = name;
      }
      const normalizedKey = projectWorkflowInputToKey(req.body?.key);
      if (normalizedKey) {
        const duplicate = await prisma.workflowStatus.findFirst({
          where: {
            projectId: access.project.id,
            key: normalizedKey,
            NOT: { id: existing.id },
          },
        });
        if (duplicate) {
          res.status(400).json({ message: 'Status key already exists' });
          return;
        }
        data.key = normalizedKey;
      }
      if (req.body?.color !== undefined) {
        data.color =
          req.body.color === null || String(req.body.color).trim() === ''
            ? null
            : String(req.body.color);
      }
      if (typeof req.body?.isCompleted === 'boolean') {
        data.isCompleted = req.body.isCompleted;
      }
      if (typeof req.body?.isArchived === 'boolean') {
        data.isArchived = req.body.isArchived;
      }
      if (Object.keys(data).length === 0) {
        res.status(400).json({ message: 'No changes' });
        return;
      }
      if (data.isArchived === true) {
        const usageCount = await prisma.task.count({
          where: { projectId: access.project.id, statusId: existing.id },
        });
        if (usageCount > 0) {
          res.status(400).json({
            message: 'Cannot archive a status that still has tasks',
          });
          return;
        }
      }
      if (
        data.isCompleted === false ||
        (data.isArchived === true && existing.isCompleted)
      ) {
        const remainingCompleted = await prisma.workflowStatus.count({
          where: {
            projectId: access.project.id,
            isCompleted: true,
            isArchived: false,
            NOT: { id: existing.id },
          },
        });
        if (remainingCompleted === 0) {
          res.status(400).json({
            message: 'A workflow must have one completed status',
          });
          return;
        }
      }
      const updated = await prisma.workflowStatus.update({
        where: { id: existing.id },
        data,
      });
      if (data.isCompleted === true) {
        await ensureSingleCompletedStatus(access.project.id, existing.id);
      }
      res.json(workflowStatusJson(updated));
    }
  );

  router.delete(
    '/:id/workflow-statuses/:statusId',
    authMiddleware,
    async (req: AuthedRequest, res) => {
      const access = await findAccessibleProject(
        req.params['id'] as string,
        req.userId as string
      );
      if (!access) {
        res.status(404).json({ message: 'Not found' });
        return;
      }
      if (access.role !== 'owner') {
        res.status(403).json({ message: 'Only project owner can update workflow' });
        return;
      }
      const existing = await prisma.workflowStatus.findFirst({
        where: { id: req.params['statusId'], projectId: access.project.id },
      });
      if (!existing) {
        res.status(404).json({ message: 'Status not found' });
        return;
      }
      const usageCount = await prisma.task.count({
        where: { projectId: access.project.id, statusId: existing.id },
      });
      if (usageCount > 0) {
        res.status(400).json({
          message: 'Cannot archive a status that still has tasks',
        });
        return;
      }
      if (existing.isCompleted) {
        const remainingCompleted = await prisma.workflowStatus.count({
          where: {
            projectId: access.project.id,
            isCompleted: true,
            isArchived: false,
            NOT: { id: existing.id },
          },
        });
        if (remainingCompleted === 0) {
          res.status(400).json({
            message: 'A workflow must have one completed status',
          });
          return;
        }
      }
      await prisma.workflowStatus.update({
        where: { id: existing.id },
        data: { isArchived: true },
      });
      res.status(204).end();
    }
  );

  router.patch('/:id', authMiddleware, async (req: AuthedRequest, res) => {
    const existing = await prisma.project.findFirst({
      where: { id: req.params['id'], userId: req.userId as string },
    });
    if (!existing) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const data: { name?: string; description?: string | null; status?: string } =
      {};
    if (typeof req.body?.name === 'string') data.name = req.body.name.trim();
    if (req.body?.description !== undefined) {
      data.description =
        req.body.description === null ? null : String(req.body.description);
    }
    if (typeof req.body?.status === 'string') {
      const allowed = ['planning', 'active', 'completed', 'archived'];
      if (allowed.includes(req.body.status)) data.status = req.body.status;
    }
    const project = await prisma.project.update({
      where: { id: existing.id },
      data,
    });
    res.json({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
    });
  });

  router.delete('/:id', authMiddleware, async (req: AuthedRequest, res) => {
    const existing = await prisma.project.findFirst({
      where: { id: req.params['id'], userId: req.userId as string },
    });
    if (!existing) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    await prisma.project.delete({ where: { id: existing.id } });
    res.status(204).end();
  });

  router.use('/:id/members', createProjectMembersRouter());
  router.use('/:id/tasks', createProjectTasksRouter());

  return router;
}
