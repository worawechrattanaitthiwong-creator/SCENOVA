CREATE TABLE "LibraryAsset" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "assetUrl" TEXT,
  "source" TEXT NOT NULL DEFAULT 'ADMIN',
  "metadata" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 1000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LibraryAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LibraryAsset_kind_active_sortOrder_idx" ON "LibraryAsset"("kind", "active", "sortOrder");
CREATE INDEX "LibraryAsset_source_active_idx" ON "LibraryAsset"("source", "active");
