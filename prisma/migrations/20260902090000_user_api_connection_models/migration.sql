-- Store the provider model catalog discovered for each encrypted BYOK connection.
-- Existing connections keep their current modelId and are upgraded lazily by the application.
ALTER TABLE "UserApiConnection"
  ADD COLUMN IF NOT EXISTS "enabledModelIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "availableModels" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "UserApiConnection"
SET "enabledModelIds" = jsonb_build_array("modelId")
WHERE "modelId" IS NOT NULL
  AND jsonb_array_length("enabledModelIds") = 0;

UPDATE "UserApiConnection"
SET "availableModels" = jsonb_build_array(
  jsonb_build_object(
    'apiModelId', "modelId",
    'label', "modelId",
    'recommended', true,
    'availability', 'UNVERIFIED'
  )
)
WHERE "modelId" IS NOT NULL
  AND jsonb_array_length("availableModels") = 0;
