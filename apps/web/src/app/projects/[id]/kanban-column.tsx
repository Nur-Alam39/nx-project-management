'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Task, WorkflowStatus } from '@nx-projects/projects';
import { formatStatusLabel } from './kanban-helpers';
import { KanbanTaskCard } from './kanban-task-card';

export function KanbanColumn({
  status,
  taskIds,
  tasksById,
  onEditTask,
}: {
  status: WorkflowStatus;
  taskIds: string[];
  tasksById: Map<string, Task>;
  onEditTask: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
    data: { type: 'column', status },
  });

  const orderedTasks = taskIds
    .map((id) => tasksById.get(id))
    .filter((t): t is Task => t !== undefined);

  return (
    <div className="flex min-h-0 w-[320px] shrink-0 flex-col">
      <div className="mb-2 shrink-0 px-0.5 flex justify-between align-middle">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border border-border"
            style={{ backgroundColor: status.color ?? '#94a3b8' }}
            aria-hidden="true"
          />
          {formatStatusLabel(status)}
        </h3>
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
