import {
  AUTH_COOKIE_NAME,
  getJwtSecretFromEnv,
  verifyAuthToken,
} from '@nx-projects/auth';
import type { NextFunction, Request, Response } from 'express';

export type AuthedRequest = Request & { userId?: string };

export async function authMiddleware(
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
