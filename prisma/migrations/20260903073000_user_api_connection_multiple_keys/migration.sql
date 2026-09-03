-- Allow a user to keep multiple encrypted credentials for the same Provider and pipeline kind.
-- The primary key on id continues to identify each independent connection.
DROP INDEX IF EXISTS "UserApiConnection_userId_provider_kind_key";

CREATE INDEX IF NOT EXISTS "UserApiConnection_userId_provider_kind_idx"
  ON "UserApiConnection"("userId", "provider", "kind");
