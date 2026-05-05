import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { findAccessibleProject } from '../lib/project-access.js';
import { authMiddleware, type AuthedRequest } from '../middleware/auth.js';

export function createProjectMembersRouter(): Router {
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
    const { project } = access;
    const owner = await prisma.user.findUnique({
      where: { id: project.userId },
      select: { id: true, email: true },
    });
    const memberRows = await prisma.projectMember.findMany({
      where: { projectId: project.id },
      include: { user: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({
      owner: owner
        ? { userId: owner.id, email: owner.email }
        : { userId: project.userId, email: '' },
      members: memberRows.map((m) => ({
        userId: m.user.id,
        email: m.user.email,
      })),
    });
  });

  router.post('/', authMiddleware, async (req: AuthedRequest, res) => {
    const access = await findAccessibleProject(
      req.params['id'] as string,
      req.userId as string
    );
    if (!access || access.role !== 'owner') {
      res.status(access ? 403 : 404).json({
        message: access ? 'Only the project owner can add members' : 'Not found',
      });
      return;
    }
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }
    const userToAdd = await prisma.user.findUnique({ where: { email } });
    if (!userToAdd) {
      res.status(404).json({ message: 'No user with that email' });
      return;
    }
    if (userToAdd.id === access.project.userId) {
      res.status(409).json({ message: 'User is already the project owner' });
      return;
    }
    try {
      await prisma.projectMember.create({
        data: {
          projectId: access.project.id,
          userId: userToAdd.id,
        },
      });
    } catch {
      res.status(409).json({ message: 'User is already a member' });
      return;
    }
    res.status(201).json({
      userId: userToAdd.id,
      email: userToAdd.email,
    });
  });

  router.delete(
    '/:userId',
    authMiddleware,
    async (req: AuthedRequest, res) => {
      const access = await findAccessibleProject(
        req.params['id'] as string,
        req.userId as string
      );
      if (!access || access.role !== 'owner') {
        res.status(access ? 403 : 404).json({
          message: access
            ? 'Only the project owner can remove members'
            : 'Not found',
        });
        return;
      }
      const targetId = req.params['userId'] as string;
      if (targetId === access.project.userId) {
        res.status(400).json({ message: 'Cannot remove the owner' });
        return;
      }
      const deleted = await prisma.projectMember.deleteMany({
        where: { projectId: access.project.id, userId: targetId },
      });
      if (deleted.count === 0) {
        res.status(404).json({ message: 'Member not found' });
        return;
      }
      res.status(204).end();
    }
  );

  return router;
}
