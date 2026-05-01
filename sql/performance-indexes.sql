CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_employees_file_number ON public.employees(file_number);
CREATE INDEX IF NOT EXISTS idx_employees_first_name ON public.employees(first_name);
CREATE INDEX IF NOT EXISTS idx_employees_last_name ON public.employees(last_name);
CREATE INDEX IF NOT EXISTS idx_employees_full_name_lower ON public.employees(LOWER(first_name || ' ' || last_name));
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_position ON public.employees(position);
CREATE INDEX IF NOT EXISTS idx_employees_nationality ON public.employees(nationality);
CREATE INDEX IF NOT EXISTS idx_employees_gender ON public.employees(gender);
CREATE INDEX IF NOT EXISTS idx_employees_date_of_birth ON public.employees(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON public.employees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employees_updated_at ON public.employees(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_contracts_employee_id ON public.contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_start_date ON public.contracts(start_date);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON public.contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON public.contracts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_employee_dates ON public.contracts(employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_employee_created ON public.contracts(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_number ON public.contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_minute_number ON public.contracts(minute_number);

CREATE INDEX IF NOT EXISTS idx_leave_transactions_employee_id ON public.leave_transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_contract_id ON public.leave_transactions(contract_id);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_leave_type ON public.leave_transactions(leave_type);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_status ON public.leave_transactions(status);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_start_date ON public.leave_transactions(start_date);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_end_date ON public.leave_transactions(end_date);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_created_at ON public.leave_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_employee_contract_dates ON public.leave_transactions(employee_id, contract_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_transactions_today_lookup ON public.leave_transactions(start_date, end_date, status);

CREATE INDEX IF NOT EXISTS idx_leave_year_balances_employee_id ON public.leave_year_balances(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_year_balances_contract_id ON public.leave_year_balances(contract_id);
CREATE INDEX IF NOT EXISTS idx_leave_year_balances_employee_contract ON public.leave_year_balances(employee_id, contract_id);
CREATE INDEX IF NOT EXISTS idx_leave_year_balances_leave_type ON public.leave_year_balances(leave_type);
CREATE INDEX IF NOT EXISTS idx_leave_year_balances_year_dates ON public.leave_year_balances(year_start_date, year_end_date);

CREATE INDEX IF NOT EXISTS idx_employee_identifications_employee_id ON public.employee_identifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_identifications_id_type ON public.employee_identifications(id_type);
CREATE INDEX IF NOT EXISTS idx_employee_identifications_id_number ON public.employee_identifications(id_number);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_employee_id ON public.user_profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_audit_logs_created_at ON public.login_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_logs_email_attempted ON public.login_audit_logs(email_attempted);
CREATE INDEX IF NOT EXISTS idx_login_audit_logs_success ON public.login_audit_logs(success);
CREATE INDEX IF NOT EXISTS idx_login_audit_logs_action ON public.login_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_login_audit_logs_user_id ON public.login_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_created_at ON public.system_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_actor_user_id ON public.system_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_module ON public.system_audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_action ON public.system_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_success ON public.system_audit_logs(success);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_target ON public.system_audit_logs(target_type, target_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_setting_key ON public.app_settings(setting_key);

CREATE INDEX IF NOT EXISTS idx_employees_first_name_trgm ON public.employees USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_last_name_trgm ON public.employees USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_file_number_trgm ON public.employees USING gin (file_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_full_name_trgm ON public.employees USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_number_trgm ON public.contracts USING gin (contract_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contracts_minute_number_trgm ON public.contracts USING gin (minute_number gin_trgm_ops);
