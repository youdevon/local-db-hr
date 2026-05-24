-- Soft delete for note monitor records and partial unique index for active note numbers

ALTER TABLE public.note_monitor_records
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_note_monitor_records_deleted_at ON public.note_monitor_records(deleted_at);

ALTER TABLE public.note_monitor_records DROP CONSTRAINT IF EXISTS note_monitor_records_year_number_unique;

CREATE UNIQUE INDEX IF NOT EXISTS note_monitor_records_active_year_number_unique
  ON public.note_monitor_records (note_year, note_number)
  WHERE deleted_at IS NULL;
