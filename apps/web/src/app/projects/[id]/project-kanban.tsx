'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '@nx-projects/projects';
import { KanbanCardFace } from './kanban-card-face';
import { KanbanColumn } from './kanban-column';
import {
  buildColumnTaskIds,
  cloneColumnTaskIds,
  COLUMN_STATUSES,
  findColumnForItemId,
  moveTaskBetweenColumns,
  tasksIdStatusSignature,
} from './kanban-helpers';

export function ProjectKanban({
  filteredTasks,
  tasksLoading,
  totalTaskCount,
  onEditTask,
  onMoveTask,
}: {
  filteredTasks: Task[];
  tasksLoading: boolean;
  totalTaskCount: number;
  onEditTask: (t: Task) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void | Promise<void>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [overlayTask, setOverlayTask] = useState<Task | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<
    Record<string, TaskStatus>
  >({});

  const displayTasks = useMemo(
    () =>
      filteredTasks.map((task) => {
        const optimisticStatus = optimisticStatuses[task.id];
        return optimisticStatus ? { ...task, status: optimisticStatus } : task;
      }),
    [filteredTasks, optimisticStatuses]
  );

  /** Server task identity only — optimistic drag status must not trigger a reset mid-drag. */
  const reconcileKey = useMemo(
    () => tasksIdStatusSignature(filteredTasks),
    [filteredTasks]
  );

  const [columnTaskIds, setColumnTaskIds] = useState<Record<TaskStatus, string[]>>(() =>
    buildColumnTaskIds([])
  );

  const columnTaskIdsRef = useRef(columnTaskIds);
  columnTaskIdsRef.current = columnTaskIds;

  const dragSnapshotRef = useRef<{
    columns: Record<TaskStatus, string[]>;
    optimisticStatuses: Record<string, TaskStatus>;
  } | null>(null);
  const dragOriginStatusRef = useRef<TaskStatus | null>(null);
  const optimisticStatusesRef = useRef(optimisticStatuses);
  optimisticStatusesRef.current = optimisticStatuses;

  useEffect(() => {
    setColumnTaskIds(buildColumnTaskIds(displayTasks));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync when server/filtered set changes, not when optimistic overlay alone changes
  }, [reconcileKey]);

  useEffect(() => {
    setOptimisticStatuses((prev) => {
      let changed = false;
      const next: Record<string, TaskStatus> = { ...prev };
      for (const [taskId, status] of Object.entries(prev)) {
        const task = filteredTasks.find((t) => t.id === taskId);
        if (!task || task.status === status) {
          delete next[taskId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [filteredTasks]);

  const tasksById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of displayTasks) {
      m.set(t.id, t);
    }
    return m;
  }, [displayTasks]);

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const task = displayTasks.find((t) => t.id === id);
    setOverlayTask(task ?? null);
    dragOriginStatusRef.current = task?.status ?? null;
    dragSnapshotRef.current = {
      columns: cloneColumnTaskIds(columnTaskIdsRef.current),
      optimisticStatuses: { ...optimisticStatusesRef.current },
    };
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const prev = columnTaskIdsRef.current;
    const next = moveTaskBetweenColumns(prev, active.id, over.id);
    if (!next) return;

    const beforeCol = findColumnForItemId(active.id, prev);
    const afterCol = findColumnForItemId(active.id, next);
    columnTaskIdsRef.current = next;
    setColumnTaskIds(next);

    if (afterCol && beforeCol !== afterCol) {
      setOptimisticStatuses((os) => ({ ...os, [String(active.id)]: afterCol }));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setOverlayTask(null);
    const { active, over } = event;
    const snapshot = dragSnapshotRef.current;
    dragSnapshotRef.current = null;

    if (!over) {
      if (snapshot) {
        columnTaskIdsRef.current = snapshot.columns;
        setColumnTaskIds(snapshot.columns);
        setOptimisticStatuses(snapshot.optimisticStatuses);
      }
      dragOriginStatusRef.current = null;
      return;
    }

    const prev = columnTaskIdsRef.current;
    const activeContainer = findColumnForItemId(active.id, prev);
    const overContainer = findColumnForItemId(over.id, prev);

    if (
      activeContainer &&
      overContainer &&
      activeContainer === overContainer &&
      active.id !== over.id
    ) {
      const items = prev[activeContainer];
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(items, oldIndex, newIndex);
        const updated = { ...prev, [activeContainer]: reordered };
        columnTaskIdsRef.current = updated;
        setColumnTaskIds(updated);
      }
    }

    const finalCol = findColumnForItemId(active.id, columnTaskIdsRef.current);
    const originStatus = dragOriginStatusRef.current;
    dragOriginStatusRef.current = null;

    if (!finalCol || !originStatus || finalCol === originStatus || !snapshot) {
      return;
    }

    void Promise.resolve(onMoveTask(String(active.id), finalCol)).catch(() => {
      columnTaskIdsRef.current = snapshot.columns;
      setColumnTaskIds(snapshot.columns);
      setOptimisticStatuses(snapshot.optimisticStatuses);
    });
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setOverlayTask(null);
    dragOriginStatusRef.current = null;
    const snapshot = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    if (snapshot) {
      columnTaskIdsRef.current = snapshot.columns;
      setColumnTaskIds(snapshot.columns);
      setOptimisticStatuses(snapshot.optimisticStatuses);
    }
  }

  if (tasksLoading) {
    return <p className="text-sm text-muted-foreground">Loading tasks…</p>;
  }

  if (totalTaskCount === 0) {
    return <p className="text-sm text-muted-foreground">No tasks yet.</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:gap-3 lg:overflow-hidden lg:pb-0">
        {COLUMN_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            taskIds={columnTaskIds[status] ?? []}
            tasksById={tasksById}
            onEditTask={onEditTask}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {overlayTask ? (
          <div className="cursor-grabbing rounded-md border border-border bg-card shadow-lg ring-2 ring-ring">
            <KanbanCardFace task={overlayTask} />
          </div>
        ) : null}
      </DragOverlay>
      {filteredTasks.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No tasks match the selected assignee filter.
        </p>
      ) : null}
    </DndContext>
  );
}
