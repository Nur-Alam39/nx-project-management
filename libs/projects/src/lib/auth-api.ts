import { apiFetch, parseJsonOrThrow } from './http';
import type { User } from './types';

export async function loginRequest(email: string, password: string): Promise<User> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return parseJsonOrThrow<User>(res);
}

export async function registerRequest(
  email: string,
  password: string
): Promise<User> {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return parseJsonOrThrow<User>(res);
}

export async function logoutRequest(): Promise<void> {
  const res = await apiFetch('/auth/logout', { method: 'POST' });
  if (!res.ok) {
    await parseJsonOrThrow(res);
  }
}

export async function fetchMe(): Promise<User | null> {
  const res = await apiFetch('/auth/me');
  if (res.status === 401) return null;
  return parseJsonOrThrow<User>(res);
}
