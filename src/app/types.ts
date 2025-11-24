// shared type definitions (type-only file to avoid runtime imports)

export interface Row {
  id: string;
  label: string;
  value: string;
}

export type BudgetPeriod = 'monthly' | 'weekly' | 'annually' | 'custom';

export type BudgetTab = 'input' | 'visualisation';

export interface BudgetStorageData {
  period?: BudgetPeriod;
  customDays?: number;
  incomeRows?: Row[];
  expenseRows?: Row[];
}
