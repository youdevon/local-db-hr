-- Persist qualification subject on `title` for constraints / tooling that expect this column.
ALTER TABLE "public"."employee_qualifications"
  ADD COLUMN IF NOT EXISTS "title" TEXT;

UPDATE "public"."employee_qualifications"
SET "title" = "qualification_title"
WHERE "title" IS NULL OR TRIM("title") = '';

ALTER TABLE "public"."employee_qualifications"
  ALTER COLUMN "title" SET NOT NULL;
