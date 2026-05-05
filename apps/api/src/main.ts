import cookieParser from 'cookie-parser';
import cors from 'cors';
import { config as loadEnv } from 'dotenv';
import express from 'express';
import { resolve } from 'node:path';
import { createAuthRouter } from './routes/auth.js';
import { createProjectsRouter } from './routes/projects.js';

loadEnv({ path: resolve(process.cwd(), 'apps/api/prisma/.env') });
loadEnv({ path: resolve(process.cwd(), 'apps/api/.env') });

const host = process.env['HOST'] ?? '127.0.0.1';
const port = process.env['PORT'] ? Number(process.env['PORT']) : 3333;

const app = express();

app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use('/auth', createAuthRouter());
app.use('/projects', createProjectsRouter());

app.get('/', (_req, res) => {
  res.send({ message: 'nx projects API' });
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
