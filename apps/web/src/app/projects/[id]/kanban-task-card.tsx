'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@nx-projects/ui-components';
import type { Task } from '@nx-projects/projects';
import { KanbanCardFace } from './kanban-card-face';

export function KanbanTaskCard({
  task,
  onEdit,
}: {
  task: Task;
  onEdit: (task: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border border-border bg-card/50 shadow-sm ${
        isDragging ? 'opacity-40' : ''
      }`}
      {...listeners}
      {...attributes}
    >
      <KanbanCardFace
        task={task}
        trailing={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onEdit(task)}
          >
            Edit
          </Button>
        }
      />
    </div>
  );
}
