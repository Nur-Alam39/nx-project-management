import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  canAssignUserToProject,
  findAccessibleProject,
} from '../lib/project-access.js';
import { taskJson } from '../lib/task-utils.js';
import {
  ensureProjectWorkflow,
  listProjectWorkflowStatuses,
  pickDefaultWorkflowStatus,
  resolveWorkflowStatusInput,
} from '../lib/workflow-utils.js';
import { authMiddleware, type AuthedRequest } from '../middleware/auth.js';

export function createProjectTasksRouter(): Router {
  const router = Router({ mergeParams: true });

  router.get('/', authMiddleware, async (req: AuthedRequest, res) => {
    const access = await findAccessibleProject(
      req.params['id'] as string,
      req.userId as string
    );
    if (!access) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    await ensureProjectWorkflow(access.project.id);
    const tasks = await prisma.task.findMany({
      where: { projectId: access.project.id },
      orderBy: { createdAt: 'desc' },
      include: {
        assignee: { select: { id: true, email: true } },
        workflowStatus: true,
      },
    });
    res.json(tasks.map((t) => taskJson(t)));
  });

  router.post('/', authMiddleware, async (req: AuthedRequest, res) => {
    const access = await findAccessibleProject(
      req.params['id'] as string,
      req.userId as string
    );
    if (!access) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    await ensureProjectWorkflow(access.project.id);
    const title = String(req.body?.title ?? '').trim();
    if (!title) {
      res.status(400).json({ message: 'Title is required' });
      return;
    }
    const description =
      req.body?.description === undefined || req.body?.description === null
        ? null
        : String(req.body.description);
    const status = await resolveWorkflowStatusInput({
      projectId: access.project.id,
      statusId: req.body?.statusId,
      statusKey: req.body?.status,
    });
    if (!status) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }
    let assigneeId: string | null =
      req.body?.assigneeId === undefined || req.body?.assigneeId === null
        ? null
        : String(req.body.assigneeId);
    if (assigneeId) {
      const ok = await canAssignUserToProject(access.project.id, assigneeId);
      if (!ok) {
        res.status(400).json({
          message: 'Assignee must be the owner or a team member',
        });
        return;
      }
    }
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (req.body?.startDate !== undefined) {
      if (req.body.startDate === null || req.body.startDate === '') {
        startDate = null;
      } else {
        const d = new Date(String(req.body.startDate));
        if (Number.isNaN(d.getTime())) {
          res.status(400).json({ message: 'Invalid startDate' });
          return;
        }
        startDate = d;
      }
    }
    if (req.body?.endDate !== undefined) {
      if (req.body.endDate === null || req.body.endDate === '') {
        endDate = null;
      } else {
        const d = new Date(String(req.body.endDate));
        if (Number.isNaN(d.getTime())) {
          res.status(400).json({ message: 'Invalid endDate' });
          return;
        }
        endDate = d;
      }
    }
    const done = status.isCompleted;
    const task = await prisma.task.create({
      data: {
        title,
        description,
        projectId: access.project.id,
        status: status.key,
        statusId: status.id,
        done,
        startDate,
        endDate,
        assigneeId,
      },
      include: {
        assignee: { select: { id: true, email: true } },
        workflowStatus: true,
      },
    });
    res.status(201).json(taskJson(task));
  });

  router.patch(
    '/:taskId',
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
      await ensureProjectWorkflow(access.project.id);
      const existing = await prisma.task.findFirst({
        where: { id: req.params['taskId'], projectId: access.project.id },
        include: { workflowStatus: true },
      });
      if (!existing) {
        res.status(404).json({ message: 'Not found' });
        return;
      }
      const data: {
        title?: string;
        description?: string | null;
        done?: boolean;
        status?: string;
        statusId?: string;
        startDate?: Date | null;
        endDate?: Date | null;
        assigneeId?: string | null;
      } = {};
      if (typeof req.body?.title === 'string') {
        const t = req.body.title.trim();
        if (!t) {
          res.status(400).json({ message: 'Title cannot be empty' });
          return;
        }
        data.title = t;
      }
      if (req.body?.description !== undefined) {
        data.description =
          req.body.description === null ? null : String(req.body.description);
      }
      if (typeof req.body?.done === 'boolean') data.done = req.body.done;
      if (req.body?.startDate !== undefined) {
        if (req.body.startDate === null || req.body.startDate === '') {
          data.startDate = null;
        } else {
          const d = new Date(String(req.body.startDate));
          if (Number.isNaN(d.getTime())) {
            res.status(400).json({ message: 'Invalid startDate' });
            return;
          }
          data.startDate = d;
        }
      }
      if (req.body?.endDate !== undefined) {
        if (req.body.endDate === null || req.body.endDate === '') {
          data.endDate = null;
        } else {
          const d = new Date(String(req.body.endDate));
          if (Number.isNaN(d.getTime())) {
            res.status(400).json({ message: 'Invalid endDate' });
            return;
          }
          data.endDate = d;
        }
      }
      if (req.body?.assigneeId !== undefined) {
        const aid =
          req.body.assigneeId === null || req.body.assigneeId === ''
            ? null
            : String(req.body.assigneeId);
        if (aid) {
          const ok = await canAssignUserToProject(access.project.id, aid);
          if (!ok) {
            res.status(400).json({
              message: 'Assignee must be the owner or a team member',
            });
            return;
          }
        }
        data.assigneeId = aid;
      }

      const hasStatusInput =
        req.body?.status !== undefined || req.body?.statusId !== undefined;

      if (Object.keys(data).length === 0 && !hasStatusInput) {
        res.status(400).json({ message: 'No changes' });
        return;
      }

      const statuses = await listProjectWorkflowStatuses(access.project.id, true);
      const activeStatuses = statuses.filter((s) => !s.isArchived);
      const completedStatus = activeStatuses.find((s) => s.isCompleted) ?? null;
      const activeNonCompletedStatus =
        activeStatuses.find((s) => !s.isCompleted) ?? null;

      let nextStatus = existing.workflowStatus ?? null;

      if (hasStatusInput) {
        const resolved = await resolveWorkflowStatusInput({
          projectId: access.project.id,
          statusId: req.body?.statusId,
          statusKey: req.body?.status,
        });
        if (!resolved) {
          res.status(400).json({ message: 'Invalid status' });
          return;
        }
        nextStatus = resolved;
      }

      if (!nextStatus) {
        nextStatus = pickDefaultWorkflowStatus(statuses);
      }

      if (data.done === true) {
        if (!completedStatus) {
          res.status(400).json({ message: 'No completed status configured' });
          return;
        }
        nextStatus = completedStatus;
      } else if (data.done === false && nextStatus.isCompleted) {
        if (!activeNonCompletedStatus) {
          res.status(400).json({
            message: 'No non-completed status configured',
          });
          return;
        }
        nextStatus = activeNonCompletedStatus;
      }

      if (hasStatusInput || data.done !== undefined) {
        data.statusId = nextStatus.id;
        data.status = nextStatus.key;
        data.done = nextStatus.isCompleted;
      }

      const task = await prisma.task.update({
        where: { id: existing.id },
        data,
        include: {
          assignee: { select: { id: true, email: true } },
          workflowStatus: true,
        },
      });
      res.json(taskJson(task));
    }
  );

  return router;
}
