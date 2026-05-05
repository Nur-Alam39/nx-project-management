'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@nx-projects/ui-components';
import { useLogin, useMe } from '@nx-projects/projects';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

export default function LoginPage() {
  const { data: user, isPending: mePending } = useMe();
  const login = useLogin();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!mePending && user) router.replace('/projects');
  }, [mePending, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await login.mutateAsync({ email, password });
    router.replace('/projects');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your account credentials.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
              />
            </div>
            {login.isError ? (
              <p className="text-sm text-destructive">
                {(login.error as Error)?.message ?? 'Login failed'}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
            <Link
              href="/register"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
