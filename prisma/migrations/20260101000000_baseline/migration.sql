-- Baseline schema for fresh DB-HR installs.
-- Requires pg_trgm before GIN trigram indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ(6),
    "last_login_ip" INET,
    "last_login_device" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "initials" VARCHAR(5),
    "role" TEXT NOT NULL DEFAULT 'contributor',
    "department" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employee_id" UUID,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "login_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "email_attempted" TEXT,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "ip_address" INET,
    "device_name" TEXT,
    "user_agent" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),
    "archive_reference" TEXT,
    "retention_until" DATE,
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "login_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "system_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "actor_email" TEXT,
    "actor_name" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" UUID,
    "target_label" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "failure_reason" TEXT,
    "ip_address" INET,
    "device_name" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),
    "archive_reference" TEXT,
    "retention_until" DATE,
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "system_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "app_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "setting_key" TEXT NOT NULL,
    "setting_value" JSONB NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "contract_allowances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contract_id" UUID NOT NULL,
    "allowance_type" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "start_date" DATE,
    "end_date" DATE,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_allowances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "contract_number" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "date_received" DATE,
    "date_signed" DATE,
    "salary" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gratuity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vacation_leave_entitlement" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "sick_leave_entitlement" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "vacation_rollover_allowed" BOOLEAN NOT NULL DEFAULT true,
    "sick_rollover_allowed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "minute_number" TEXT,
    "retirement_override_required" BOOLEAN NOT NULL DEFAULT false,
    "retirement_override_reason" TEXT,
    "retirement_override_approval_reference" TEXT,
    "retirement_cutoff_date" DATE,
    "executive_council_note_id" UUID,
    "secretary_note_id" UUID,
    "authority_note_type" TEXT,
    "authority_note_monitor_record_id" UUID,
    "authority_note_manual_reference" TEXT,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "address_type" TEXT NOT NULL,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "community_city" TEXT NOT NULL,
    "region_municipality" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Trinidad and Tobago',
    "postal_code" TEXT,
    "same_as_residential" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "document_name" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "issue_date" DATE,
    "expiry_date" DATE,
    "file_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "uploaded_by" UUID,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_emergency_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "contact_type" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "mobile_number" TEXT NOT NULL,
    "alternative_number" TEXT,
    "email" TEXT,
    "address" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_identifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "id_type" TEXT NOT NULL,
    "id_number" TEXT NOT NULL,
    "normalized_id_number" TEXT,
    "issuing_country" TEXT DEFAULT 'Trinidad and Tobago',
    "issue_date" DATE,
    "expiry_date" DATE,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_identifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_position_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "work_location" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "reason_notes" TEXT,
    "related_contract_number" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_position_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_qualification_groups" (
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_qualification_subjects" (
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_qualifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "qualification_title" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "institution" TEXT,
    "qualification_level" TEXT,
    "field_of_study" TEXT,
    "date_awarded" DATE,
    "expiry_date" DATE,
    "document_id" UUID,
    "category" TEXT NOT NULL DEFAULT 'custom_other',
    "qualification_type" TEXT NOT NULL DEFAULT 'other',
    "awarding_body" TEXT,
    "grade_result" TEXT,
    "has_expiry" BOOLEAN NOT NULL DEFAULT false,
    "verification_status" TEXT NOT NULL DEFAULT 'not_required',
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "employee_qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_right_to_work" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "work_permit_required" BOOLEAN NOT NULL DEFAULT false,
    "work_permit_number" TEXT,
    "work_permit_expiry_date" DATE,
    "immigration_status" TEXT,
    "country_of_citizenship" TEXT DEFAULT 'Trinidad and Tobago',
    "right_to_work_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_right_to_work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "file_number" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "preferred_name" TEXT,
    "gender" TEXT,
    "date_of_birth" DATE,
    "nationality" TEXT,
    "marital_status" TEXT,
    "personal_email" TEXT,
    "work_email" TEXT,
    "mobile_number" TEXT,
    "home_number" TEXT,
    "department" TEXT,
    "position" TEXT,
    "employee_category" TEXT,
    "employment_status" TEXT NOT NULL DEFAULT 'active',
    "work_location" TEXT,
    "date_first_engaged" DATE,
    "photo_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public_holidays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "holiday_date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "country_code" TEXT NOT NULL DEFAULT 'TT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "leave_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "contract_id" UUID,
    "leave_type" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "return_to_work_date" DATE NOT NULL,
    "leave_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "notes" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "system_audit_log_changes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "audit_log_id" UUID NOT NULL,
    "change_type" TEXT NOT NULL,
    "field_name" TEXT,
    "field_label" TEXT,
    "before_value" JSONB,
    "after_value" JSONB,
    "value_format" TEXT DEFAULT 'text',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_audit_log_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "leave_year_balances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "contract_year_number" INTEGER NOT NULL,
    "year_start_date" DATE NOT NULL,
    "year_end_date" DATE NOT NULL,
    "leave_type" TEXT NOT NULL,
    "entitlement" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "rollover_in" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "used" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "remaining" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "adjustment_reason" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" UUID,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_year_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "note_monitor_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "note_year" INTEGER NOT NULL,
    "note_number" INTEGER NOT NULL,
    "note_type" TEXT NOT NULL,
    "display_reference" TEXT NOT NULL,
    "note_preparation_date" DATE NOT NULL,
    "details" TEXT NOT NULL,
    "date_returned_from_secretary" DATE,
    "date_sent_to_executive_council" DATE,
    "date_received_from_executive_council" DATE,
    "due_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "deleted_reason" TEXT,

    CONSTRAINT "note_monitor_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "note_number_sequences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "note_year" INTEGER NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "auto_reset_yearly" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "note_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "note_monitor_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "note_monitor_record_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "field_name" TEXT,
    "field_label" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "edited_by" UUID,
    "edited_by_name" TEXT,
    "edited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_monitor_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_notification_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_type" TEXT NOT NULL,
    "employee_id" UUID,
    "contract_id" UUID,
    "leave_balance_id" UUID,
    "recipient_email" TEXT,
    "cc_email" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "email_notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_users_is_active" ON "users"("is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_users_created_at" ON "users"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_user_profiles_employee_id" ON "user_profiles"("employee_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_user_profiles_department" ON "user_profiles"("department");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_user_profiles_role" ON "user_profiles"("role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_user_profiles_user_id" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_login_audit_logs_action" ON "login_audit_logs"("action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_login_audit_logs_created_at" ON "login_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_login_audit_logs_email_attempted" ON "login_audit_logs"("email_attempted");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_login_audit_logs_user_id" ON "login_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_login_audit_logs_legal_hold" ON "login_audit_logs"("legal_hold");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_login_audit_logs_retention_until" ON "login_audit_logs"("retention_until");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_login_audit_logs_success" ON "login_audit_logs"("success");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_system_audit_logs_action" ON "system_audit_logs"("action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_system_audit_logs_actor_user_id" ON "system_audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_system_audit_logs_created_at" ON "system_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_system_audit_logs_module" ON "system_audit_logs"("module");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_system_audit_logs_success" ON "system_audit_logs"("success");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_system_audit_logs_target" ON "system_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_system_audit_logs_legal_hold" ON "system_audit_logs"("legal_hold");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_system_audit_logs_retention_until" ON "system_audit_logs"("retention_until");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "app_settings_setting_key_key" ON "app_settings"("setting_key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contract_allowances_contract_id" ON "contract_allowances"("contract_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contract_allowances_type" ON "contract_allowances"("allowance_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_employee_id" ON "contracts"("employee_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_executive_council_note_id" ON "contracts"("executive_council_note_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_secretary_note_id" ON "contracts"("secretary_note_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_authority_note_monitor_record_id" ON "contracts"("authority_note_monitor_record_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_authority_note_type" ON "contracts"("authority_note_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_employee_period" ON "contracts"("employee_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_end_date" ON "contracts"("end_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_start_date" ON "contracts"("start_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_status" ON "contracts"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_minute_number" ON "contracts"("minute_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_contract_number" ON "contracts"("contract_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_contract_number_trgm" ON "contracts" USING GIN ("contract_number" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_created_at" ON "contracts"("created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_employee_created" ON "contracts"("employee_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_employee_dates" ON "contracts"("employee_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_contracts_minute_number_trgm" ON "contracts" USING GIN ("minute_number" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "unique_global_identification_number" ON "employee_identifications"("normalized_id_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employee_identifications_employee_id" ON "employee_identifications"("employee_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employee_identifications_id_type" ON "employee_identifications"("id_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employee_identifications_normalized_id_number" ON "employee_identifications"("normalized_id_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employee_identifications_id_number" ON "employee_identifications"("id_number");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "unique_employee_identification" ON "employee_identifications"("id_type", "issuing_country", "normalized_id_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employee_qualification_groups_employee_id" ON "employee_qualification_groups"("employee_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employee_qualification_subjects_group_id" ON "employee_qualification_subjects"("group_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employee_qualifications_employee_id" ON "employee_qualifications"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "employee_right_to_work_employee_id_key" ON "employee_right_to_work"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "employees_file_number_key" ON "employees"("file_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_department" ON "employees"("department");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_employment_status" ON "employees"("employment_status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_file_number" ON "employees"("file_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_first_name" ON "employees"("first_name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_last_name" ON "employees"("last_name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_position" ON "employees"("position");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_created_at" ON "employees"("created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_date_of_birth" ON "employees"("date_of_birth");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_file_number_trgm" ON "employees" USING GIN ("file_number" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_first_name_trgm" ON "employees" USING GIN ("first_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_gender" ON "employees"("gender");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_last_name_trgm" ON "employees" USING GIN ("last_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_nationality" ON "employees"("nationality");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_employees_updated_at" ON "employees"("updated_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_public_holidays_holiday_date" ON "public_holidays"("holiday_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_public_holidays_active" ON "public_holidays"("active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "public_holidays_date_country_name_unique" ON "public_holidays"("holiday_date", "country_code", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_transactions_employee_id" ON "leave_transactions"("employee_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_transactions_contract_id" ON "leave_transactions"("contract_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_transactions_leave_type" ON "leave_transactions"("leave_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_transactions_start_date" ON "leave_transactions"("start_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_transactions_status" ON "leave_transactions"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_transactions_created_at" ON "leave_transactions"("created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_transactions_employee_contract_dates" ON "leave_transactions"("employee_id", "contract_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_transactions_end_date" ON "leave_transactions"("end_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_transactions_today_lookup" ON "leave_transactions"("start_date", "end_date", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_system_audit_log_changes_audit_log_id" ON "system_audit_log_changes"("audit_log_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_system_audit_log_changes_change_type" ON "system_audit_log_changes"("change_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_year_balances_contract_id" ON "leave_year_balances"("contract_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_year_balances_employee_id" ON "leave_year_balances"("employee_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_year_balances_leave_type" ON "leave_year_balances"("leave_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_year_balances_locked" ON "leave_year_balances"("locked");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_year_balances_year_dates" ON "leave_year_balances"("year_start_date", "year_end_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_year_balances_employee_contract" ON "leave_year_balances"("employee_id", "contract_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_year_balances_year" ON "leave_year_balances"("contract_year_number");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "leave_year_balances_unique" ON "leave_year_balances"("employee_id", "contract_id", "contract_year_number", "leave_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_note_monitor_records_deleted_at" ON "note_monitor_records"("deleted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_note_monitor_records_note_year" ON "note_monitor_records"("note_year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_note_monitor_records_note_type" ON "note_monitor_records"("note_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_note_monitor_records_status" ON "note_monitor_records"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_note_monitor_records_due_date" ON "note_monitor_records"("due_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_note_monitor_records_display_reference" ON "note_monitor_records"("display_reference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_note_monitor_records_created_at" ON "note_monitor_records"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "note_monitor_records_active_year_number_unique" ON "note_monitor_records"("note_year", "note_number") WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "note_number_sequences_year_unique" ON "note_number_sequences"("note_year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_note_number_sequences_note_year" ON "note_number_sequences"("note_year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_note_monitor_history_record_id" ON "note_monitor_history"("note_monitor_record_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_note_monitor_history_edited_at" ON "note_monitor_history"("edited_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_email_notification_logs_type" ON "email_notification_logs"("notification_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_email_notification_logs_status" ON "email_notification_logs"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_email_notification_logs_employee" ON "email_notification_logs"("employee_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_email_notification_logs_contract" ON "email_notification_logs"("contract_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_email_notification_logs_created_at" ON "email_notification_logs"("created_at");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_employee_id_fkey') THEN
    ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_user_id_fkey') THEN
    ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'login_audit_logs_user_id_fkey') THEN
    ALTER TABLE "login_audit_logs" ADD CONSTRAINT "login_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_audit_logs_actor_user_id_fkey') THEN
    ALTER TABLE "system_audit_logs" ADD CONSTRAINT "system_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_allowances_contract_id_fkey') THEN
    ALTER TABLE "contract_allowances" ADD CONSTRAINT "contract_allowances_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_employee_id_fkey') THEN
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_executive_council_note_id_fkey') THEN
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_executive_council_note_id_fkey" FOREIGN KEY ("executive_council_note_id") REFERENCES "note_monitor_records"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_secretary_note_id_fkey') THEN
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_secretary_note_id_fkey" FOREIGN KEY ("secretary_note_id") REFERENCES "note_monitor_records"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_authority_note_monitor_record_id_fkey') THEN
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_authority_note_monitor_record_id_fkey" FOREIGN KEY ("authority_note_monitor_record_id") REFERENCES "note_monitor_records"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_addresses_employee_id_fkey') THEN
    ALTER TABLE "employee_addresses" ADD CONSTRAINT "employee_addresses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_documents_employee_id_fkey') THEN
    ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_documents_uploaded_by_fkey') THEN
    ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_emergency_contacts_employee_id_fkey') THEN
    ALTER TABLE "employee_emergency_contacts" ADD CONSTRAINT "employee_emergency_contacts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_identifications_employee_id_fkey') THEN
    ALTER TABLE "employee_identifications" ADD CONSTRAINT "employee_identifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_position_history_employee_id_fkey') THEN
    ALTER TABLE "employee_position_history" ADD CONSTRAINT "employee_position_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualification_groups_employee_id_fkey') THEN
    ALTER TABLE "employee_qualification_groups" ADD CONSTRAINT "employee_qualification_groups_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualification_groups_document_id_fkey') THEN
    ALTER TABLE "employee_qualification_groups" ADD CONSTRAINT "employee_qualification_groups_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "employee_documents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualification_groups_created_by_fkey') THEN
    ALTER TABLE "employee_qualification_groups" ADD CONSTRAINT "employee_qualification_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualification_groups_updated_by_fkey') THEN
    ALTER TABLE "employee_qualification_groups" ADD CONSTRAINT "employee_qualification_groups_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualification_subjects_group_id_fkey') THEN
    ALTER TABLE "employee_qualification_subjects" ADD CONSTRAINT "employee_qualification_subjects_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "employee_qualification_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualifications_employee_id_fkey') THEN
    ALTER TABLE "employee_qualifications" ADD CONSTRAINT "employee_qualifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualifications_document_id_fkey') THEN
    ALTER TABLE "employee_qualifications" ADD CONSTRAINT "employee_qualifications_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "employee_documents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualifications_created_by_fkey') THEN
    ALTER TABLE "employee_qualifications" ADD CONSTRAINT "employee_qualifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_qualifications_updated_by_fkey') THEN
    ALTER TABLE "employee_qualifications" ADD CONSTRAINT "employee_qualifications_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_right_to_work_employee_id_fkey') THEN
    ALTER TABLE "employee_right_to_work" ADD CONSTRAINT "employee_right_to_work_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_transactions_contract_id_fkey') THEN
    ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_transactions_created_by_fkey') THEN
    ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_transactions_employee_id_fkey') THEN
    ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_transactions_updated_by_fkey') THEN
    ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_audit_log_changes_audit_log_id_fkey') THEN
    ALTER TABLE "system_audit_log_changes" ADD CONSTRAINT "system_audit_log_changes_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "system_audit_logs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_year_balances_contract_id_fkey') THEN
    ALTER TABLE "leave_year_balances" ADD CONSTRAINT "leave_year_balances_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_year_balances_created_by_fkey') THEN
    ALTER TABLE "leave_year_balances" ADD CONSTRAINT "leave_year_balances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_year_balances_employee_id_fkey') THEN
    ALTER TABLE "leave_year_balances" ADD CONSTRAINT "leave_year_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_year_balances_locked_by_fkey') THEN
    ALTER TABLE "leave_year_balances" ADD CONSTRAINT "leave_year_balances_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_year_balances_updated_by_fkey') THEN
    ALTER TABLE "leave_year_balances" ADD CONSTRAINT "leave_year_balances_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_monitor_records_created_by_fkey') THEN
    ALTER TABLE "note_monitor_records" ADD CONSTRAINT "note_monitor_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_monitor_records_updated_by_fkey') THEN
    ALTER TABLE "note_monitor_records" ADD CONSTRAINT "note_monitor_records_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_monitor_records_deleted_by_fkey') THEN
    ALTER TABLE "note_monitor_records" ADD CONSTRAINT "note_monitor_records_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_number_sequences_updated_by_fkey') THEN
    ALTER TABLE "note_number_sequences" ADD CONSTRAINT "note_number_sequences_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_monitor_history_note_monitor_record_id_fkey') THEN
    ALTER TABLE "note_monitor_history" ADD CONSTRAINT "note_monitor_history_note_monitor_record_id_fkey" FOREIGN KEY ("note_monitor_record_id") REFERENCES "note_monitor_records"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_monitor_history_edited_by_fkey') THEN
    ALTER TABLE "note_monitor_history" ADD CONSTRAINT "note_monitor_history_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;


-- Role check constraint (lowercase values only)
ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_role_check
CHECK (
  role IN (
    'administrator',
    'manager',
    'contributor',
    'viewer',
    'member'
  )
);
