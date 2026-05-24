-- Unified contract authority note fields (legacy executive/secretary columns retained)

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS authority_note_type TEXT,
  ADD COLUMN IF NOT EXISTS authority_note_monitor_record_id UUID REFERENCES public.note_monitor_records(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD COLUMN IF NOT EXISTS authority_note_manual_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_contracts_authority_note_monitor_record_id ON public.contracts(authority_note_monitor_record_id);
CREATE INDEX IF NOT EXISTS idx_contracts_authority_note_type ON public.contracts(authority_note_type);

-- (a) & (e) Executive council FK -> unified authority; dual-note contracts keep secretary_note_id as legacy
UPDATE public.contracts
SET
  authority_note_type = 'executive_council_note',
  authority_note_monitor_record_id = executive_council_note_id
WHERE executive_council_note_id IS NOT NULL
  AND authority_note_type IS NULL;

-- (c) Only minute_number (no monitor FKs): manual executive council reference
UPDATE public.contracts
SET
  authority_note_type = 'executive_council_note',
  authority_note_manual_reference = minute_number
WHERE executive_council_note_id IS NULL
  AND secretary_note_id IS NULL
  AND minute_number IS NOT NULL
  AND TRIM(minute_number) <> ''
  AND authority_note_type IS NULL;

-- (f) Only secretary_note_id: unified secretary authority via FK
UPDATE public.contracts
SET
  authority_note_type = 'secretary_note',
  authority_note_monitor_record_id = secretary_note_id
WHERE executive_council_note_id IS NULL
  AND secretary_note_id IS NOT NULL
  AND authority_note_type IS NULL;

-- (d) & (e) Contracts with both executive and secretary: executive migrated above;
-- secretary_note_id preserved as legacy (no further UPDATE required).
