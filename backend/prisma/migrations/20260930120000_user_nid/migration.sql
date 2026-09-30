-- Add NID for legal identification at signup.
ALTER TABLE "users" ADD COLUMN "nid" TEXT;

UPDATE "users" SET "nid" = '1000000001' WHERE "email" = 'jashim@oitesla.test';
UPDATE "users" SET "nid" = '1000000002' WHERE "email" = 'nusrat@oitesla.test';
UPDATE "users" SET "nid" = '1000000003' WHERE "email" = 'rafiq@oitesla.test';
UPDATE "users" SET "nid" = '1000000004' WHERE "email" = 'shirin@oitesla.test';
UPDATE "users" SET "nid" = 'legacy-' || "id" WHERE "nid" IS NULL;

ALTER TABLE "users" ALTER COLUMN "nid" SET NOT NULL;

CREATE UNIQUE INDEX "users_nid_key" ON "users"("nid");
