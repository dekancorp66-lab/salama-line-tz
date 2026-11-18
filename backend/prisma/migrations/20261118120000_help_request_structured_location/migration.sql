-- Add structured Tanzania Mainland location fields to help requests.
-- Nullable and backward-compatible with existing records.
ALTER TABLE "HelpRequest"
  ADD COLUMN "regionId" TEXT,
  ADD COLUMN "regionName" TEXT,
  ADD COLUMN "districtId" TEXT,
  ADD COLUMN "districtName" TEXT,
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "locationConsentGiven" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "HelpRequest_regionId_districtId_idx" ON "HelpRequest"("regionId", "districtId");
