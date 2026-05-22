-- Lowercase default must satisfy user_profiles_role_check (lowercase values only).
ALTER TABLE "public"."user_profiles"
  ALTER COLUMN "role" SET DEFAULT 'contributor';
