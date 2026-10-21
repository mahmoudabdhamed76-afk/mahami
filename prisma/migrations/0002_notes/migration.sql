-- CreateTable
CREATE TABLE "Note" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "color" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "audioId" UUID,
    "audioMime" TEXT,
    "audioDuration" DOUBLE PRECISION,
    "audioPeaks" TEXT,
    "version" BIGINT NOT NULL DEFAULT 0,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteAudio" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteAudio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_userId_version_idx" ON "Note"("userId", "version");
CREATE INDEX "NoteAudio_userId_idx" ON "NoteAudio"("userId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoteAudio" ADD CONSTRAINT "NoteAudio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sync triggers (same protocol as tasks)
CREATE TRIGGER "Note_sync_version" BEFORE INSERT OR UPDATE ON "Note" FOR EACH ROW EXECUTE FUNCTION sync_bump_version();
CREATE TRIGGER "Note_sync_notify"  AFTER INSERT OR UPDATE ON "Note" FOR EACH ROW EXECUTE FUNCTION sync_notify_change();
