import type { ApiErrorBody } from './types';
import { getApiBaseUrl } from './config';

export class ApiError extends Error {
  readonly status: number;
  readonly body?: ApiErrorBody;

  constructor(status: number, message: string, body?: ApiErrorBody) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${p}`;
  return fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

export async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmedText = text.trim();
  let json: unknown;
  if (trimmedText) {
    try {
      json = JSON.parse(trimmedText) as unknown;
    } catch {
      if (!res.ok) {
        throw new ApiError(
          res.status,
          trimmedText || res.statusText || `Request failed with status ${res.status}`
        );
      }
      throw new Error(`Expected JSON response but received: ${trimmedText.slice(0, 200)}`);
    }
  }
  if (!res.ok) {
    const body =
      json &&
      typeof json === 'object' &&
      'message' in json &&
      typeof (json as { message?: unknown }).message === 'string'
        ? (json as ApiErrorBody)
        : undefined;
    const fallbackMessage = trimmedText || res.statusText || `Request failed with status ${res.status}`;
    throw new ApiError(
      res.status,
      body?.message ?? fallbackMessage,
      body
    );
  }
  return json as T;
}
