-- Expand qualifications module: grouped exam sittings + richer standalone records.

CREATE TABLE IF NOT EXISTS "public"."employee_qualification_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "qualification_system" TEXT NOT NULL,
    "sitting_year" INTEGER NOT NULL,
    "institution" TEXT,
    "awarding_body" TEXT,
    "level" TEXT,
    "notes" TEXT,
    "document_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    CONSTRAINT "employee_qualification_groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_employee_qualification_groups_employee_id"
  ON "public"."employee_qualification_groups"("employee_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualification_groups_employee_id_fkey'
  ) THEN
    ALTER TABLE "public"."employee_qualification_groups"
      ADD CONSTRAINT "employee_qualification_groups_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualification_groups_document_id_fkey'
  ) THEN
    ALTER TABLE "public"."employee_qualification_groups"
      ADD CONSTRAINT "employee_qualification_groups_document_id_fkey"
      FOREIGN KEY ("document_id") REFERENCES "public"."employee_documents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualification_groups_created_by_fkey'
  ) THEN
    ALTER TABLE "public"."employee_qualification_groups"
      ADD CONSTRAINT "employee_qualification_groups_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualification_groups_updated_by_fkey'
  ) THEN
    ALTER TABLE "public"."employee_qualification_groups"
      ADD CONSTRAINT "employee_qualification_groups_updated_by_fkey"
      FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."employee_qualification_subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "subject_name" TEXT NOT NULL,
    "level_or_unit" TEXT,
    "grade_result" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_qualification_subjects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_employee_qualification_subjects_group_id"
  ON "public"."employee_qualification_subjects"("group_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualification_subjects_group_id_fkey'
  ) THEN
    ALTER TABLE "public"."employee_qualification_subjects"
      ADD CONSTRAINT "employee_qualification_subjects_group_id_fkey"
      FOREIGN KEY ("group_id") REFERENCES "public"."employee_qualification_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- Standalone qualification rows: additional structured fields
ALTER TABLE "public"."employee_qualifications"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'custom_other';

ALTER TABLE "public"."employee_qualifications"
  ADD COLUMN IF NOT EXISTS "qualification_type" TEXT NOT NULL DEFAULT 'other';

ALTER TABLE "public"."employee_qualifications"
  ADD COLUMN IF NOT EXISTS "awarding_body" TEXT;

ALTER TABLE "public"."employee_qualifications"
  ADD COLUMN IF NOT EXISTS "grade_result" TEXT;

ALTER TABLE "public"."employee_qualifications"
  ADD COLUMN IF NOT EXISTS "has_expiry" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."employee_qualifications"
  ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'not_required';

ALTER TABLE "public"."employee_qualifications"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

ALTER TABLE "public"."employee_qualifications"
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "public"."employee_qualifications"
  ADD COLUMN IF NOT EXISTS "created_by" UUID;

ALTER TABLE "public"."employee_qualifications"
  ADD COLUMN IF NOT EXISTS "updated_by" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualifications_document_id_fkey'
  ) THEN
    ALTER TABLE "public"."employee_qualifications"
      ADD CONSTRAINT "employee_qualifications_document_id_fkey"
      FOREIGN KEY ("document_id") REFERENCES "public"."employee_documents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualifications_created_by_fkey'
  ) THEN
    ALTER TABLE "public"."employee_qualifications"
      ADD CONSTRAINT "employee_qualifications_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualifications_updated_by_fkey'
  ) THEN
    ALTER TABLE "public"."employee_qualifications"
      ADD CONSTRAINT "employee_qualifications_updated_by_fkey"
      FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
