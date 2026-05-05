import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { findAccessibleProject } from '../lib/project-access.js';
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
