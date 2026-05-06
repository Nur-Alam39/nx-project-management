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
import { ThemeToggle } from '@/components/theme-toggle';
import { useMe, useRegister } from '@nx-projects/projects';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

export default function RegisterPage() {
  const { data: user, isPending: mePending } = useMe();
  const register = useRegister();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!mePending && user) router.replace('/projects');
  }, [mePending, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await register.mutateAsync({ email, password });
    router.replace('/projects');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Password must be at least 8 characters.</CardDescription>
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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
              />
            </div>
            {register.isError ? (
              <p className="text-sm text-destructive">
                {(register.error as Error)?.message ?? 'Registration failed'}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <Button type="submit" disabled={register.isPending}>
              {register.isPending ? 'Creating…' : 'Register'}
            </Button>
            <Link
              href="/login"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Already have an account?
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
