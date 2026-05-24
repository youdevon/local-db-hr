CREATE TABLE IF NOT EXISTS public.email_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  employee_id uuid NULL,
  contract_id uuid NULL,
  leave_balance_id uuid NULL,
  recipient_email text NULL,
  cc_email text NULL,
  subject text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message text NULL,
  sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  metadata jsonb NULL
);

CREATE INDEX IF NOT EXISTS idx_email_notification_logs_type
  ON public.email_notification_logs (notification_type);

CREATE INDEX IF NOT EXISTS idx_email_notification_logs_status
  ON public.email_notification_logs (status);

CREATE INDEX IF NOT EXISTS idx_email_notification_logs_employee
  ON public.email_notification_logs (employee_id);

CREATE INDEX IF NOT EXISTS idx_email_notification_logs_contract
  ON public.email_notification_logs (contract_id);

CREATE INDEX IF NOT EXISTS idx_email_notification_logs_created_at
  ON public.email_notification_logs (created_at);
