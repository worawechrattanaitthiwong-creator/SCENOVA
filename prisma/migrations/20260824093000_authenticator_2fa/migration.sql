-- Add encrypted Authenticator/TOTP state to SCENOVA users.
ALTER TABLE "User"
ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "twoFactorSecret" TEXT,
ADD COLUMN "twoFactorConfirmedAt" TIMESTAMP(3),
ADD COLUMN "twoFactorRecoveryCodes" JSONB;
