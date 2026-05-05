import {
  AUTH_COOKIE_NAME,
  JWT_MAX_AGE_SEC,
  getJwtSecretFromEnv,
  signAuthToken,
} from '@nx-projects/auth';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, type AuthedRequest } from '../middleware/auth.js';

const cookieSecure = process.env['COOKIE_SECURE'] === 'true';

export function createAuthRouter(): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
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

  router.post('/login', async (req, res) => {
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

  router.post('/logout', (_req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    res.status(204).end();
  });

  router.get('/me', authMiddleware, async (req: AuthedRequest, res) => {
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

  return router;
}
