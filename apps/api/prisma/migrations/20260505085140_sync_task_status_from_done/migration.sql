-- Align task.status with legacy done flag for existing rows
UPDATE "Task" SET "status" = 'done' WHERE "done" = 1;
