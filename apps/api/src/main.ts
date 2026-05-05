import { PrismaClient } from '@prisma/client';
import {
  AUTH_COOKIE_NAME,
  JWT_MAX_AGE_SEC,
  getJwtSecretFromEnv,
  signAuthToken,
  verifyAuthToken,
} from '@nx-projects/auth';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { config as loadEnv } from 'dotenv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), 'apps/api/prisma/.env') });
loadEnv({ path: resolve(process.cwd(), 'apps/api/.env') });

const prisma = new PrismaClient();

const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done', 'cancelled'] as const;

const host = process.env['HOST'] ?? '127.0.0.1';
const port = process.env['PORT'] ? Number(process.env['PORT']) : 3333;
const cookieSecure = process.env['COOKIE_SECURE'] === 'true';

const app = express();

app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

type AuthedRequest = Request & { userId?: string };

async function authMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies[AUTH_COOKIE_NAME] as string | undefined;
    if (!token) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    let secret: Uint8Array;
    try {
      secret = getJwtSecretFromEnv();
    } catch {
      res.status(500).json({ message: 'Server misconfiguration' });
      return;
    }
    const payload = await verifyAuthToken(token, secret);
    if (!payload) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    req.userId = payload.sub;
    next();
  } catch (err) {
    next(err);
  }
}

type ProjectRole = 'owner' | 'member';

async function findAccessibleProject(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [{ userId }, { members: { some: { userId } } }],
    },
  });
  if (!project) return null;
  const role: ProjectRole = project.userId === userId ? 'owner' : 'member';
  return { project, role };
}

async function canAssignUserToProject(
  projectId: string,
  assigneeId: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) return false;
  if (project.userId === assigneeId) return true;
  const member = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId: assigneeId },
    },
  });
  return !!member;
}

function normalizeTaskStatus(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const s = String(raw);
  return TASK_STATUSES.includes(s as (typeof TASK_STATUSES)[number])
    ? s
    : undefined;
}

function taskJson(task: {
  id: string;
  title: string;
  description: string | null;
  done: boolean;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  assigneeId: string | null;
  createdAt: Date;
  projectId: string;
  assignee?: { id: string; email: string } | null;
}) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    done: task.done,
    status: task.status,
    startDate: task.startDate ? task.startDate.toISOString() : null,
    endDate: task.endDate ? task.endDate.toISOString() : null,
    assigneeId: task.assigneeId,
    assignee: task.assignee
      ? { id: task.assignee.id, email: task.assignee.email }
      : null,
    createdAt: task.createdAt.toISOString(),
    projectId: task.projectId,
  };
}

app.post('/auth/register', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || password.length < 8) {
    res.status(400).json({ message: 'Invalid email or password' });
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: 'Email already registered' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash },
  });
  const secret = getJwtSecretFromEnv();
  const jwt = await signAuthToken(
    { sub: user.id, email: user.email },
    secret
  );
  res.cookie(AUTH_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: JWT_MAX_AGE_SEC * 1000,
  });
  res.json({ id: user.id, email: user.email });
});

app.post('/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }
  const secret = getJwtSecretFromEnv();
  const jwt = await signAuthToken(
    { sub: user.id, email: user.email },
    secret
  );
  res.cookie(AUTH_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: JWT_MAX_AGE_SEC * 1000,
  });
  res.json({ id: user.id, email: user.email });
});

app.post('/auth/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  res.status(204).end();
});

app.get('/auth/me', authMiddleware, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId as string },
    select: { id: true, email: true },
  });
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  res.json(user);
});

app.get('/projects', authMiddleware, async (req: AuthedRequest, res) => {
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

app.post('/projects', authMiddleware, async (req: AuthedRequest, res) => {
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

app.get('/projects/:id', authMiddleware, async (req: AuthedRequest, res) => {
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

app.patch('/projects/:id', authMiddleware, async (req: AuthedRequest, res) => {
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

app.delete('/projects/:id', authMiddleware, async (req: AuthedRequest, res) => {
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

app.get(
  '/projects/:id/members',
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
  }
);

app.post(
  '/projects/:id/members',
  authMiddleware,
  async (req: AuthedRequest, res) => {
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
  }
);

app.delete(
  '/projects/:id/members/:userId',
  authMiddleware,
  async (req: AuthedRequest, res) => {
    const access = await findAccessibleProject(
      req.params['id'] as string,
      req.userId as string
    );
    if (!access || access.role !== 'owner') {
      res.status(access ? 403 : 404).json({
        message: access ? 'Only the project owner can remove members' : 'Not found',
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

app.get('/projects/:id/tasks', authMiddleware, async (req: AuthedRequest, res) => {
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

app.post('/projects/:id/tasks', authMiddleware, async (req: AuthedRequest, res) => {
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

app.patch(
  '/projects/:id/tasks/:taskId',
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

app.get('/', (_req, res) => {
  res.send({ message: 'nx projects API' });
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
