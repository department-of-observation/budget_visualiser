'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import type { Row, BudgetPeriod, BudgetStorageData, BudgetTab } from '@/app/types';
import BudgetVisualisation from '@/components/BudgetVisualisation';

const AUTOSAVE_DELAY = 5000; // 5 seconds

export default function BudgetPage() {
  const params = useParams();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgetId = (params as any)?.id ?? '';

  function loadInitialBudgetFromStorage(): BudgetStorageData | null {
    if (typeof window === 'undefined' || !budgetId) {
      return null;
    }

    try {
      const key = `budget-data-${budgetId}`;
      const stored = window.localStorage.getItem(key);
      if (!stored) return null;

      const parsed = JSON.parse(stored) as BudgetStorageData;

      return parsed;
    } catch {
      return null;
    }
  }

  const [activeTab, setActiveTab] = useState<BudgetTab>('input');

  const [period, setPeriod] = useState<BudgetPeriod>(() => {
    const data = loadInitialBudgetFromStorage();
    return data?.period ?? 'monthly';
  });

  const [customDays, setCustomDays] = useState<number>(() => {
    const data = loadInitialBudgetFromStorage();
    return typeof data?.customDays === 'number' ? data.customDays : 30;
  });

  const [incomeRows, setIncomeRows] = useState<Row[]>(() => {
    const data = loadInitialBudgetFromStorage();
    if (Array.isArray(data?.incomeRows) && data.incomeRows.length > 0) {
      return data.incomeRows;
    }
    // Initial row uses a simple static ID; new rows use timestamp IDs.
    return [{ id: 'income-0', label: '', value: '' }];
  });

  const [expenseRows, setExpenseRows] = useState<Row[]>(() => {
    const data = loadInitialBudgetFromStorage();
    if (Array.isArray(data?.expenseRows) && data.expenseRows.length > 0) {
      return data.expenseRows;
    }
    // Initial row uses a simple static ID; new rows use timestamp IDs.
    return [{ id: 'expense-0', label: '', value: '' }];
  });

  const totalIncome = incomeRows.reduce((acc, row) => {
    const val = parseFloat(row.value);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const totalExpense = expenseRows.reduce((acc, row) => {
    const val = parseFloat(row.value);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // kept in parent so both tabs read/write same state
  function addIncomeRow() {
    setIncomeRows((prev) => [...prev, { id: `${Date.now()}-inc`, label: '', value: '' }]);
  }
  function addExpenseRow() {
    setExpenseRows((prev) => [...prev, { id: `${Date.now()}-exp`, label: '', value: '' }]);
  }

  function handleRowChange(
    list: Row[],
    setList: (rows: Row[]) => void,
    rowId: string,
    field: 'label' | 'value',
    newValue: string,
  ) {
    setList(
      list.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: newValue,
            }
          : row,
      ),
    );
  }

  function handleRowBlur(list: Row[], setList: (rows: Row[]) => void, row: Row) {
    const nameEmpty = row.label.trim() === '';
    const valueEmpty = row.value.trim() === '';
    if (nameEmpty && valueEmpty && list.length > 1) {
      setList(list.filter((r) => r.id !== row.id));
    }
  }

  // Shared save helper used by autosave + manual Save button.
  const saveBudgetToLocalStorage = useCallback(() => {
    if (!budgetId || typeof window === 'undefined') return;

    try {
      const key = `budget-data-${budgetId}`;
      const payload: BudgetStorageData = {
        period,
        customDays,
        incomeRows,
        expenseRows,
      };
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // ignore write errors
    }
  }, [budgetId, period, customDays, incomeRows, expenseRows]);

  // Autosave: whenever values change, wait AUTOSAVE_DELAY ms; if no further changes, save.
  useEffect(() => {
    if (!budgetId) return;

    const timeoutId = window.setTimeout(() => {
      saveBudgetToLocalStorage();
    }, AUTOSAVE_DELAY);

    // If any dependency changes before delay, clear and restart the timer.
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [budgetId, period, customDays, incomeRows, expenseRows, saveBudgetToLocalStorage]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Budget: {budgetId}</h1>

      {/* Time period selection */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['monthly', 'weekly', 'annually', 'custom'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-md px-3 py-1 text-sm font-medium border ${
              period === p
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-blue-600 border-blue-600 dark:bg-black dark:text-blue-400'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="mb-4 flex items-center gap-2">
          <label htmlFor="custom-days" className="text-sm font-medium">
            Days per cycle:
          </label>
          <input
            id="custom-days"
            type="number"
            min={1}
            value={customDays}
            onChange={(e) => setCustomDays(parseInt(e.target.value, 10) || 0)}
            className="w-20 rounded-md border px-2 py-1 dark:bg-black dark:border-gray-700"
          />
        </div>
      )}

      {/* Tab selection */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('input')}
          className={`rounded-md px-3 py-1 text-sm font-medium border ${
            activeTab === 'input'
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-green-600 border-green-600 dark:bg-black dark:text-green-400'
          }`}
        >
          Data Input
        </button>
        <button
          onClick={() => setActiveTab('visualisation')}
          className={`rounded-md px-3 py-1 text-sm font-medium border ${
            activeTab === 'visualisation'
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-white text-purple-600 border-purple-600 dark:bg-black dark:text-purple-400'
          }`}
        >
          Visualisation
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'input' ? (
        <>
          {/* ---- BudgetInput (kept inline to avoid circular imports) ---- */}
          <div>
            {/* Income input */}
            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Income</h2>
              {incomeRows.map((row) => (
                <div key={row.id} className="flex flex-wrap gap-2 mb-2">
                  <input
                    value={row.label}
                    onChange={(e) => handleRowChange(incomeRows, setIncomeRows, row.id, 'label', e.target.value)}
                    onBlur={() => handleRowBlur(incomeRows, setIncomeRows, row)}
                    placeholder="Category"
                    className="flex-grow min-w-[10rem] rounded-md border px-2 py-1 dark:bg-black dark:border-gray-700"
                  />
                  <input
                    type="number"
                    value={row.value}
                    onChange={(e) => handleRowChange(incomeRows, setIncomeRows, row.id, 'value', e.target.value)}
                    onBlur={() => handleRowBlur(incomeRows, setIncomeRows, row)}
                    placeholder="Amount"
                    className="w-32 rounded-md border px-2 py-1 dark:bg-black dark:border-gray-700"
                  />
                </div>
              ))}
              <button
                onClick={addIncomeRow}
                className="mt-2 rounded-md bg-green-600 px-3 py-1 text-white hover:bg-green-700"
              >
                Add Income
              </button>
            </section>

            {/* Expenditure input */}
            <section className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Expenditure</h2>
              {expenseRows.map((row) => (
                <div key={row.id} className="flex flex-wrap gap-2 mb-2">
                  <input
                    value={row.label}
                    onChange={(e) => handleRowChange(expenseRows, setExpenseRows, row.id, 'label', e.target.value)}
                    onBlur={() => handleRowBlur(expenseRows, setExpenseRows, row)}
                    placeholder="Category"
                    className="flex-grow min-w-[10rem] rounded-md border px-2 py-1 dark:bg-black dark:border-gray-700"
                  />
                  <input
                    type="number"
                    value={row.value}
                    onChange={(e) => handleRowChange(expenseRows, setExpenseRows, row.id, 'value', e.target.value)}
                    onBlur={() => handleRowBlur(expenseRows, setExpenseRows, row)}
                    placeholder="Amount"
                    className="w-32 rounded-md border px-2 py-1 dark:bg-black dark:border-gray-700"
                  />
                </div>
              ))}
              <button
                onClick={addExpenseRow}
                className="mt-2 rounded-md bg-red-600 px-3 py-1 text-white hover:bg-red-700"
              >
                Add Expense
              </button>
            </section>

            {/* Totals */}
            <div className="mt-4 font-medium space-y-1">
              <p>Total Income: {totalIncome.toFixed(2)}</p>
              <p>Total Expenses: {totalExpense.toFixed(2)}</p>
              <p>
                Net: {totalIncome - totalExpense >= 0 ? '+' : ''}
                {(totalIncome - totalExpense).toFixed(2)}
              </p>
            </div>

            {/* Manual Save button at the end of the input tab */}
            <button
              type="button"
              onClick={saveBudgetToLocalStorage}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <BudgetVisualisation incomeRows={incomeRows} expenseRows={expenseRows} />
      )}
    </div>
  );
}
