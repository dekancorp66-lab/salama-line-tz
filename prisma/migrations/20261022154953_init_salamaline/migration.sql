-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RESPONDER', 'CONTENT_REVIEWER', 'PARTNER_ANALYST');

-- CreateEnum
CREATE TYPE "HelpRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'REFERRED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HelpRequestPriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('CONTACT_FOR_HELP', 'SHARE_WITH_SERVICE', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "ConsentDecision" AS ENUM ('GRANTED', 'DECLINED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('CLINIC', 'LEGAL_AID', 'SOCIAL_WELFARE', 'SHELTER', 'COUNSELLING', 'OTHER');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WEB', 'USSD', 'SMS', 'WHATSAPP', 'STAFF');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RESPONDER',
    "districtCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'sw',
    "topic" TEXT NOT NULL,
    "shortText" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceDirectoryEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ServiceType" NOT NULL,
    "districtCode" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "phonePublic" TEXT,
    "address" TEXT,
    "openingHours" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verificationOrg" TEXT NOT NULL,
    "verifiedBy" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceDirectoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpRequest" (
    "id" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "districtCode" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "HelpRequestStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "HelpRequestPriority" NOT NULL DEFAULT 'NORMAL',
    "consentToContact" BOOLEAN NOT NULL DEFAULT false,
    "contactCiphertext" TEXT,
    "contactHash" TEXT,
    "assignedResponderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lastAlertAt" TIMESTAMP(3),
    "escalationCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HelpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "helpRequestId" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "decision" "ConsentDecision" NOT NULL,
    "wordingVersion" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "helpRequestId" TEXT NOT NULL,
    "serviceEntryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFERED',
    "consentGranted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "outcome" TEXT NOT NULL,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymousMetric" (
    "id" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "districtCode" TEXT,
    "channel" "Channel",
    "bucketDate" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymousMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Content_slug_key" ON "Content"("slug");

-- CreateIndex
CREATE INDEX "Content_status_language_topic_idx" ON "Content"("status", "language", "topic");

-- CreateIndex
CREATE INDEX "ServiceDirectoryEntry_districtCode_type_isActive_idx" ON "ServiceDirectoryEntry"("districtCode", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "HelpRequest_caseCode_key" ON "HelpRequest"("caseCode");

-- CreateIndex
CREATE INDEX "HelpRequest_status_districtCode_priority_createdAt_idx" ON "HelpRequest"("status", "districtCode", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "HelpRequest_contactHash_idx" ON "HelpRequest"("contactHash");

-- CreateIndex
CREATE INDEX "ConsentRecord_helpRequestId_purpose_createdAt_idx" ON "ConsentRecord"("helpRequestId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "Referral_helpRequestId_idx" ON "Referral"("helpRequestId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_action_idx" ON "AuditEvent"("createdAt", "action");

-- CreateIndex
CREATE INDEX "AuditEvent_resourceType_resourceId_idx" ON "AuditEvent"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AnonymousMetric_metricKey_bucketDate_idx" ON "AnonymousMetric"("metricKey", "bucketDate");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymousMetric_metricKey_districtCode_channel_bucketDate_key" ON "AnonymousMetric"("metricKey", "districtCode", "channel", "bucketDate");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_assignedResponderId_fkey" FOREIGN KEY ("assignedResponderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_helpRequestId_fkey" FOREIGN KEY ("helpRequestId") REFERENCES "HelpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_helpRequestId_fkey" FOREIGN KEY ("helpRequestId") REFERENCES "HelpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
