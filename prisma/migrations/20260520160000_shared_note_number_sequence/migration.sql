-- Shared yearly note number sequence (one counter per year across all note types)

-- =============================================================================
-- 1. Resolve note_monitor_records (note_year, note_number) conflicts
--    Keep the earliest-created record per (year, number); renumber the rest.
-- =============================================================================

CREATE TEMP TABLE _note_number_conflicts AS
SELECT
  note_year,
  note_number,
  COUNT(*) AS conflict_count,
  array_agg(id ORDER BY created_at ASC, id ASC) AS record_ids,
  array_agg(note_type ORDER BY created_at ASC, id ASC) AS note_types
FROM public.note_monitor_records
GROUP BY note_year, note_number
HAVING COUNT(*) > 1;

DO $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO conflict_count FROM _note_number_conflicts;
  IF conflict_count > 0 THEN
    RAISE NOTICE 'note_monitor_records: % (note_year, note_number) conflict group(s) found; renumbering duplicates', conflict_count;
  END IF;
END $$;

WITH duplicates AS (
  SELECT
    id,
    note_year,
    ROW_NUMBER() OVER (PARTITION BY note_year ORDER BY note_number, created_at, id) AS dup_seq
  FROM (
    SELECT
      id,
      note_year,
      note_number,
      created_at,
      ROW_NUMBER() OVER (
        PARTITION BY note_year, note_number
        ORDER BY created_at ASC, id ASC
      ) AS within_group_rn
    FROM public.note_monitor_records
  ) grouped
  WHERE within_group_rn > 1
),
year_ceiling AS (
  SELECT note_year, MAX(note_number) AS base_num
  FROM public.note_monitor_records
  GROUP BY note_year
)
UPDATE public.note_monitor_records AS r
SET
  note_number = yc.base_num + d.dup_seq,
  display_reference = (yc.base_num + d.dup_seq)::text || ' of ' || r.note_year::text,
  updated_at = NOW()
FROM duplicates AS d
INNER JOIN year_ceiling AS yc ON yc.note_year = d.note_year
WHERE r.id = d.id;

-- =============================================================================
-- 2. Consolidate note_number_sequences to one row per note_year (legacy per-type rows only)
--    Keep MAX(next_number) across all rows for that year.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.note_number_sequences
    GROUP BY note_year
    HAVING COUNT(*) > 1
  ) THEN
    WITH year_stats AS (
      SELECT note_year, MAX(next_number) AS max_next_number
      FROM public.note_number_sequences
      GROUP BY note_year
    ),
    keepers AS (
      SELECT DISTINCT ON (s.note_year) s.id, s.note_year
      FROM public.note_number_sequences AS s
      ORDER BY s.note_year, s.next_number DESC, s.id
    )
    UPDATE public.note_number_sequences AS s
    SET
      next_number = ys.max_next_number,
      updated_at = NOW()
    FROM year_stats AS ys
    INNER JOIN keepers AS k ON k.note_year = ys.note_year
    WHERE s.id = k.id;

    DELETE FROM public.note_number_sequences AS s
    WHERE s.id NOT IN (
      SELECT DISTINCT ON (note_year) id
      FROM public.note_number_sequences
      ORDER BY note_year, next_number DESC, id
    );
  END IF;

  IF EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'note_number_sequences'
    AND column_name = 'note_type'
) THEN
  ALTER TABLE public.note_number_sequences ALTER COLUMN note_type DROP NOT NULL;
  UPDATE public.note_number_sequences SET note_type = 'SHARED' WHERE note_type IS NOT NULL;
END IF;
END $$;

-- =============================================================================
-- 3. note_number_sequences: drop per-type unique, make note_type nullable, add year unique
-- =============================================================================

ALTER TABLE public.note_number_sequences
  DROP CONSTRAINT IF EXISTS note_number_sequences_year_type_unique;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'note_number_sequences'
      AND column_name = 'note_type'
  ) THEN
    ALTER TABLE public.note_number_sequences ALTER COLUMN note_type DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'note_number_sequences_year_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'note_number_sequences_year_unique'
  ) THEN
    ALTER TABLE public.note_number_sequences
      ADD CONSTRAINT note_number_sequences_year_unique UNIQUE (note_year);
  END IF;
END $$;

-- =============================================================================
-- 4. note_monitor_records: drop per-type unique, add shared (year, number) unique
-- =============================================================================

ALTER TABLE public.note_monitor_records
  DROP CONSTRAINT IF EXISTS note_monitor_records_year_type_number_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'note_monitor_records_year_number_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'note_monitor_records_year_number_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'note_monitor_records_active_year_number_unique'
  ) THEN
    ALTER TABLE public.note_monitor_records
      ADD CONSTRAINT note_monitor_records_year_number_unique UNIQUE (note_year, note_number);
  END IF;
END $$;

DROP TABLE IF EXISTS _note_number_conflicts;
