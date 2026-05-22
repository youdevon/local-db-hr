-- Trinidad and Tobago public holidays (configurable; seed rows are templates)

CREATE TABLE IF NOT EXISTS public.public_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  name text NOT NULL,
  country_code text NOT NULL DEFAULT 'TT',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS public_holidays_date_country_name_unique
  ON public.public_holidays (holiday_date, country_code, name);

CREATE INDEX IF NOT EXISTS idx_public_holidays_holiday_date ON public.public_holidays (holiday_date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_active ON public.public_holidays (active);
