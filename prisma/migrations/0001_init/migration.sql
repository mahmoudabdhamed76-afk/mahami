-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "calendarToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "version" BIGINT NOT NULL DEFAULT 0,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "categoryId" UUID,
    "dueAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "remindAt" TIMESTAMP(3),
    "reminderOffset" INTEGER,
    "reminderSentAt" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "version" BIGINT NOT NULL DEFAULT 0,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subtask" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "version" BIGINT NOT NULL DEFAULT 0,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Subtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Category_userId_version_idx" ON "Category"("userId", "version");
CREATE INDEX "Task_userId_version_idx" ON "Task"("userId", "version");
CREATE INDEX "Task_userId_dueAt_idx" ON "Task"("userId", "dueAt");
CREATE INDEX "Task_remindAt_idx" ON "Task"("remindAt");
CREATE INDEX "Subtask_userId_version_idx" ON "Subtask"("userId", "version");
CREATE INDEX "Subtask_taskId_idx" ON "Subtask"("taskId");
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Sync infrastructure (not expressible in Prisma schema)
--
-- Every write to a syncable table gets a fresh `version` from a global
-- sequence. A per-user transaction-scoped advisory lock is taken first, so for
-- any single user versions become visible strictly in commit order. That makes
-- "give me everything with version > cursor" a gap-free pull protocol.
-- After each write we NOTIFY the user id so live SSE streams can wake clients.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS "sync_version_seq";

CREATE OR REPLACE FUNCTION sync_bump_version() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW."userId"::text));
  -- Resolve the sequence in the trigger table's own schema (works with any search_path)
  NEW."version" := nextval((quote_ident(TG_TABLE_SCHEMA) || '.sync_version_seq')::regclass);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_notify_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('sync_changes', NEW."userId"::text);
  RETURN NULL;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Category_sync_version" BEFORE INSERT OR UPDATE ON "Category" FOR EACH ROW EXECUTE FUNCTION sync_bump_version();
CREATE TRIGGER "Task_sync_version"     BEFORE INSERT OR UPDATE ON "Task"     FOR EACH ROW EXECUTE FUNCTION sync_bump_version();
CREATE TRIGGER "Subtask_sync_version"  BEFORE INSERT OR UPDATE ON "Subtask"  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

CREATE TRIGGER "Category_sync_notify" AFTER INSERT OR UPDATE ON "Category" FOR EACH ROW EXECUTE FUNCTION sync_notify_change();
CREATE TRIGGER "Task_sync_notify"     AFTER INSERT OR UPDATE ON "Task"     FOR EACH ROW EXECUTE FUNCTION sync_notify_change();
CREATE TRIGGER "Subtask_sync_notify"  AFTER INSERT OR UPDATE ON "Subtask"  FOR EACH ROW EXECUTE FUNCTION sync_notify_change();

-- Partial index for the reminder scheduler (only pending reminders)
CREATE INDEX "Task_pending_reminder_idx" ON "Task"("remindAt")
  WHERE "reminderSentAt" IS NULL AND "deletedAt" IS NULL AND "completed" = false;
