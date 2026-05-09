/**
 * Contract year labels for leave transaction rows (ordinal "1st Year", "2nd Year", …).
 */

export function formatContractYearLabel(yearNumber: number): string {
  if (!Number.isFinite(yearNumber) || yearNumber < 1) return "—";
  const y = Math.floor(yearNumber);
  const suffix =
    y % 10 === 1 && y % 100 !== 11
      ? "st"
      : y % 10 === 2 && y % 100 !== 12
        ? "nd"
        : y % 10 === 3 && y % 100 !== 13
          ? "rd"
          : "th";
  return `${y}${suffix} Year`;
}

type ContractBlock = {
  contractId: string;
  years: Array<{ yearNumber: number; startDate: string; endDate: string }>;
};

export function resolveTransactionContractYearNumber(
  tx: { _sortStartIso: string; contractIdResolved: string | null },
  contracts: ContractBlock[] | null | undefined,
): number | null {
  if (!contracts?.length) return null;
  const start = tx._sortStartIso;
  if (tx.contractIdResolved) {
    const contract = contracts.find((c) => c.contractId === tx.contractIdResolved);
    if (contract) {
      for (const y of contract.years) {
        if (start >= y.startDate && start <= y.endDate) return y.yearNumber;
      }
    }
  }
  for (const contract of contracts) {
    for (const y of contract.years) {
      if (start >= y.startDate && start <= y.endDate) return y.yearNumber;
    }
  }
  return null;
}

export function resolveTransactionContractYearLabel(
  tx: { _sortStartIso: string; contractIdResolved: string | null },
  contracts: ContractBlock[] | null | undefined,
): string {
  const n = resolveTransactionContractYearNumber(tx, contracts);
  return n != null ? formatContractYearLabel(n) : "—";
}
