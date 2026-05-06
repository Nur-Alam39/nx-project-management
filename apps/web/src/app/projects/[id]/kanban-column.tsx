'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '@nx-projects/projects';
import { formatStatusLabel } from './kanban-helpers';
import { KanbanTaskCard } from './kanban-task-card';

export function KanbanColumn({
  status,
  taskIds,
  tasksById,
  onEditTask,
}: {
  status: TaskStatus;
  taskIds: string[];
  tasksById: Map<string, Task>;
  onEditTask: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: 'column', status },
  });

  const orderedTasks = taskIds
    .map((id) => tasksById.get(id))
    .filter((t): t is Task => t !== undefined);

  return (
    <div className="flex min-h-0 w-[min(100%,280px)] shrink-0 flex-col lg:w-auto lg:min-w-0 lg:flex-1">
      <div className="mb-2 shrink-0 px-0.5 flex justify-between align-middle">
        <h3 className="text-sm font-semibold capitalize">{formatStatusLabel(status)}</h3>
        <p className="text-xs text-muted-foreground">
          {taskIds.length} task{taskIds.length === 1 ? '' : 's'}
        </p>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[160px] min-w-0 flex-1 flex-col gap-2 overflow-y-auto rounded-md border border-dashed p-2 overscroll-y-contain transition-colors lg:min-h-[min(60vh,28rem)] ${
          isOver ? 'border-primary/50 bg-muted/30' : 'border-border bg-muted/10'
        }`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {orderedTasks.map((task) => (
            <KanbanTaskCard key={task.id} task={task} onEdit={onEditTask} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
