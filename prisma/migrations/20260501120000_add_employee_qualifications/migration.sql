-- Self-service profile: academic / professional qualifications per employee.
CREATE TABLE IF NOT EXISTS "public"."employee_qualifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "qualification_title" TEXT NOT NULL,
    "institution" TEXT,
    "qualification_level" TEXT,
    "field_of_study" TEXT,
    "date_awarded" DATE,
    "expiry_date" DATE,
    "document_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_qualifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_employee_qualifications_employee_id" ON "public"."employee_qualifications"("employee_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualifications_employee_id_fkey'
  ) THEN
    ALTER TABLE "public"."employee_qualifications"
      ADD CONSTRAINT "employee_qualifications_employee_id_fkey"
      FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
