import { prisma } from './prisma.js';

export type ProjectRole = 'owner' | 'member';

export async function findAccessibleProject(projectId: string, userId: string) {
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

export async function canAssignUserToProject(
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
