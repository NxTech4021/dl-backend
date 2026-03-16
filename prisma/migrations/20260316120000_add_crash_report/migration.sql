-- CreateTable
CREATE TABLE "CrashReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "stackTrace" TEXT,
    "componentStack" TEXT,
    "screenName" TEXT,
    "platform" TEXT NOT NULL,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "deviceModel" TEXT,
    "buildType" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "notes" TEXT,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrashReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrashReport_userId_idx" ON "CrashReport"("userId");
CREATE INDEX "CrashReport_createdAt_idx" ON "CrashReport"("createdAt");
CREATE INDEX "CrashReport_type_idx" ON "CrashReport"("type");
CREATE INDEX "CrashReport_screenName_idx" ON "CrashReport"("screenName");
CREATE INDEX "CrashReport_resolved_idx" ON "CrashReport"("resolved");
CREATE INDEX "CrashReport_severity_idx" ON "CrashReport"("severity");
CREATE INDEX "CrashReport_errorMessage_screenName_appVersion_idx" ON "CrashReport"("errorMessage", "screenName", "appVersion");

-- AddForeignKey
ALTER TABLE "CrashReport" ADD CONSTRAINT "CrashReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
