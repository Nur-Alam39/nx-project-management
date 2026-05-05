import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  canAssignUserToProject,
  findAccessibleProject,
} from '../lib/project-access.js';
import { normalizeTaskStatus, taskJson } from '../lib/task-utils.js';
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
    const tasks = await prisma.task.findMany({
      where: { projectId: access.project.id },
      orderBy: { createdAt: 'desc' },
      include: { assignee: { select: { id: true, email: true } } },
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
    const title = String(req.body?.title ?? '').trim();
    if (!title) {
      res.status(400).json({ message: 'Title is required' });
      return;
    }
    const description =
      req.body?.description === undefined || req.body?.description === null
        ? null
        : String(req.body.description);
    const statusRaw = normalizeTaskStatus(req.body?.status);
    const status = statusRaw ?? 'todo';
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
    const done = status === 'done';
    const task = await prisma.task.create({
      data: {
        title,
        description,
        projectId: access.project.id,
        status,
        done,
        startDate,
        endDate,
        assigneeId,
      },
      include: { assignee: { select: { id: true, email: true } } },
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
      const existing = await prisma.task.findFirst({
        where: { id: req.params['taskId'], projectId: access.project.id },
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
      const st = normalizeTaskStatus(req.body?.status);
      if (st !== undefined) data.status = st;
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
      if (Object.keys(data).length === 0) {
        res.status(400).json({ message: 'No changes' });
        return;
      }
      let nextStatus = existing.status;
      let nextDone = existing.done;
      if (data.status !== undefined) {
        nextStatus = data.status;
        nextDone = data.status === 'done';
      }
      if (data.done !== undefined) {
        nextDone = data.done;
        if (data.status === undefined) {
          if (data.done) nextStatus = 'done';
          else if (existing.status === 'done') nextStatus = 'todo';
        }
      }
      if (data.status !== undefined || data.done !== undefined) {
        data.status = nextStatus;
        data.done = nextDone;
      }
      const task = await prisma.task.update({
        where: { id: existing.id },
        data,
        include: { assignee: { select: { id: true, email: true } } },
      });
      res.json(taskJson(task));
    }
  );

  return router;
}
