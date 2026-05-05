'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@nx-projects/ui-components';
import {
  useCreateProject,
  useLogout,
  useMe,
  useProjects,
  type Project,
  type ProjectStatus,
} from '@nx-projects/projects';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

function statusVariant(
  s: ProjectStatus
): 'success' | 'planning' | 'completed' | 'archived' | 'default' {
  switch (s) {
    case 'active':
      return 'success';
    case 'planning':
      return 'planning';
    case 'completed':
      return 'completed';
    case 'archived':
      return 'archived';
    default:
      return 'default';
  }
}

export default function ProjectsPage() {
  const { data: user, isPending: mePending, isError: meError } = useMe();
  const { data: projects, isLoading } = useProjects();
  const create = useCreateProject();
  const logout = useLogout();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!mePending && (meError || user === null)) router.replace('/login');
  }, [mePending, meError, user, router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await create.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      status: 'planning',
    });
    setName('');
    setDescription('');
    setCreateOpen(false);
  }

  async function onLogout() {
    await logout.mutateAsync();
    router.replace('/login');
  }

  if (mePending || user === undefined) {
    return (
      <div className="flex h-full min-h-[100dvh] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="z-40 shrink-0 border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold">Projects</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => setCreateOpen(true)}>
              New project
            </Button>
            <Button variant="outline" type="button" onClick={() => void onLogout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-0 w-full max-w-7xl flex-1 space-y-8 overflow-y-auto px-4 py-8">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>Create a project to track work.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(ev) => void onCreate(ev)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modal-project-name">Name</Label>
                <Input
                  id="modal-project-name"
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modal-project-description">Description</Label>
                <Input
                  id="modal-project-description"
                  value={description}
                  onChange={(ev) => setDescription(ev.target.value)}
                />
              </div>
              {create.isError ? (
                <p className="text-sm text-destructive">
                  {(create.error as Error)?.message ?? 'Could not create'}
                </p>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Creating…' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <section>
          <h2 className="mb-4 text-base font-medium">Your projects</h2>
          {isLoading ? (
            <p className="text-muted-foreground">Loading projects…</p>
          ) : !projects?.length ? (
            <p className="text-muted-foreground">No projects yet.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {projects.map((p: Project) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`}>
                    <Card className="transition-colors hover:bg-accent/50">
                      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                      </CardHeader>
                      <CardContent>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {p.description ?? '—'}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
