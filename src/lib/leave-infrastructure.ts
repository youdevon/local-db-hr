import "server-only";

import { prisma } from "@/lib/prisma";

let attempted = false;

export async function ensureLeaveInfrastructure(): Promise<void> {
  if (attempted) return;
  attempted = true;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.leave_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
          contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
          leave_type TEXT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          return_to_work_date DATE NOT NULL,
          leave_days NUMERIC(6,2) NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'recorded',
          notes TEXT,
          created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
          updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT leave_transactions_date_check CHECK (end_date >= start_date),
          CONSTRAINT leave_transactions_return_date_check CHECK (return_to_work_date > end_date),
          CONSTRAINT leave_transactions_days_check CHECK (leave_days >= 0),
          CONSTRAINT leave_transactions_type_check CHECK (
              leave_type IN ('sick','vacation','maternity','paternity','extended','casual','compassionate','study','no_pay','other')
          ),
          CONSTRAINT leave_transactions_status_check CHECK (
              status IN ('recorded','approved','cancelled','rejected','adjusted')
          )
      );
    `);
    await prisma.$executeRawUnsafe(
      "CREATE INDEX IF NOT EXISTS idx_leave_transactions_employee_id ON public.leave_transactions(employee_id);",
    );
    await prisma.$executeRawUnsafe(
      "CREATE INDEX IF NOT EXISTS idx_leave_transactions_contract_id ON public.leave_transactions(contract_id);",
    );
    await prisma.$executeRawUnsafe(
      "CREATE INDEX IF NOT EXISTS idx_leave_transactions_leave_type ON public.leave_transactions(leave_type);",
    );
    await prisma.$executeRawUnsafe(
      "CREATE INDEX IF NOT EXISTS idx_leave_transactions_start_date ON public.leave_transactions(start_date);",
    );
    await prisma.$executeRawUnsafe(
      "CREATE INDEX IF NOT EXISTS idx_leave_transactions_status ON public.leave_transactions(status);",
    );
    await prisma.$executeRawUnsafe(
      "DROP TRIGGER IF EXISTS set_leave_transactions_updated_at ON public.leave_transactions;",
    );
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER set_leave_transactions_updated_at
      BEFORE UPDATE ON public.leave_transactions
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
    `);
  } catch {
    // Do not block UI flows if DDL is not permitted.
  }
}
