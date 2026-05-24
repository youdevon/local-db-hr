-- Note Monitor module: records, yearly sequences, history, and contract links

CREATE TABLE IF NOT EXISTS public.note_monitor_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_year INTEGER NOT NULL,
  note_number INTEGER NOT NULL,
  note_type TEXT NOT NULL,
  display_reference TEXT NOT NULL,
  note_preparation_date DATE NOT NULL,
  details TEXT NOT NULL,
  date_returned_from_secretary DATE,
  date_sent_to_executive_council DATE,
  date_received_from_executive_council DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT note_monitor_records_year_number_unique UNIQUE (note_year, note_number)
);

CREATE INDEX IF NOT EXISTS idx_note_monitor_records_note_year ON public.note_monitor_records(note_year);
CREATE INDEX IF NOT EXISTS idx_note_monitor_records_note_type ON public.note_monitor_records(note_type);
CREATE INDEX IF NOT EXISTS idx_note_monitor_records_status ON public.note_monitor_records(status);
CREATE INDEX IF NOT EXISTS idx_note_monitor_records_due_date ON public.note_monitor_records(due_date);
CREATE INDEX IF NOT EXISTS idx_note_monitor_records_display_reference ON public.note_monitor_records(display_reference);
CREATE INDEX IF NOT EXISTS idx_note_monitor_records_created_at ON public.note_monitor_records(created_at DESC);

CREATE TABLE IF NOT EXISTS public.note_number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_year INTEGER NOT NULL UNIQUE,
  next_number INTEGER NOT NULL DEFAULT 1,
  auto_reset_yearly BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_note_number_sequences_note_year ON public.note_number_sequences(note_year);

CREATE TABLE IF NOT EXISTS public.note_monitor_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_monitor_record_id UUID NOT NULL REFERENCES public.note_monitor_records(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  action TEXT NOT NULL,
  field_name TEXT,
  field_label TEXT,
  old_value TEXT,
  new_value TEXT,
  edited_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  edited_by_name TEXT,
  edited_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_monitor_history_record_id ON public.note_monitor_history(note_monitor_record_id);
CREATE INDEX IF NOT EXISTS idx_note_monitor_history_edited_at ON public.note_monitor_history(edited_at DESC);

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS executive_council_note_id UUID REFERENCES public.note_monitor_records(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD COLUMN IF NOT EXISTS secretary_note_id UUID REFERENCES public.note_monitor_records(id) ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS idx_contracts_executive_council_note_id ON public.contracts(executive_council_note_id);
CREATE INDEX IF NOT EXISTS idx_contracts_secretary_note_id ON public.contracts(secretary_note_id);
