'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Task, WorkflowStatus } from '@nx-projects/projects';
import { KanbanCardFace } from './kanban-card-face';
import { KanbanColumn } from './kanban-column';
import {
  activeStatuses,
  buildColumnTaskIds,
  cloneColumnTaskIds,
  findColumnForItemId,
  moveTaskBetweenColumns,
  tasksIdStatusSignature,
} from './kanban-helpers';

/** Prefer pointer hit-testing so empty columns and sparse targets register reliably; fall back for keyboard/exotic layouts. */
const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  return pointerHits.length > 0 ? pointerHits : closestCorners(args);
};

export function ProjectKanban({
  workflowStatuses,
  filteredTasks,
  tasksLoading,
  totalTaskCount,
  onEditTask,
  onMoveTask,
}: {
  workflowStatuses: WorkflowStatus[];
  filteredTasks: Task[];
  tasksLoading: boolean;
  totalTaskCount: number;
  onEditTask: (t: Task) => void;
  onMoveTask: (taskId: string, statusId: string) => void | Promise<void>;
}) {
  const orderedStatuses = useMemo(
    () => activeStatuses(workflowStatuses),
    [workflowStatuses]
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [overlayTask, setOverlayTask] = useState<Task | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<
    Record<string, string>
  >({});

  const displayTasks = useMemo(
    () =>
      filteredTasks.map((task) => {
        const optimisticStatusId = optimisticStatuses[task.id];
        if (!optimisticStatusId) return task;
        const status = orderedStatuses.find((s) => s.id === optimisticStatusId) ?? null;
        return {
          ...task,
          statusId: optimisticStatusId,
          status: status?.key ?? task.status,
          workflowStatus: status ?? task.workflowStatus,
          done: status?.isCompleted ?? task.done,
        };
      }),
    [filteredTasks, optimisticStatuses, orderedStatuses]
  );

  /** Server task identity only — optimistic drag status must not trigger a reset mid-drag. */
  const reconcileKey = useMemo(
    () => tasksIdStatusSignature(filteredTasks),
    [filteredTasks]
  );

  const [columnTaskIds, setColumnTaskIds] = useState<Record<string, string[]>>(() =>
    buildColumnTaskIds([], orderedStatuses)
  );

  const columnTaskIdsRef = useRef(columnTaskIds);
  columnTaskIdsRef.current = columnTaskIds;

  const dragSnapshotRef = useRef<{
    columns: Record<string, string[]>;
    optimisticStatuses: Record<string, string>;
  } | null>(null);
  const dragOriginStatusRef = useRef<string | null>(null);
  const optimisticStatusesRef = useRef(optimisticStatuses);
  optimisticStatusesRef.current = optimisticStatuses;

  useEffect(() => {
    setColumnTaskIds(buildColumnTaskIds(displayTasks, orderedStatuses));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync when server/filtered set changes, not when optimistic overlay alone changes
  }, [reconcileKey, orderedStatuses]);

  useEffect(() => {
    setOptimisticStatuses((prev) => {
      let changed = false;
      const next: Record<string, string> = { ...prev };
      for (const [taskId, status] of Object.entries(prev)) {
        const task = filteredTasks.find((t) => t.id === taskId);
        if (!task || task.statusId === status) {
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
      columns: cloneColumnTaskIds(columnTaskIdsRef.current, orderedStatuses),
      optimisticStatuses: { ...optimisticStatusesRef.current },
    };
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const prev = columnTaskIdsRef.current;
    const next = moveTaskBetweenColumns(prev, active.id, over.id, orderedStatuses);
    if (!next) return;

    const beforeCol = findColumnForItemId(active.id, prev, orderedStatuses);
    const afterCol = findColumnForItemId(active.id, next, orderedStatuses);
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
    const activeContainer = findColumnForItemId(active.id, prev, orderedStatuses);
    const overContainer = findColumnForItemId(over.id, prev, orderedStatuses);

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

    const finalCol = findColumnForItemId(
      active.id,
      columnTaskIdsRef.current,
      orderedStatuses
    );
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
      collisionDetection={kanbanCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-2">
        {orderedStatuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            taskIds={columnTaskIds[status.id] ?? []}
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
