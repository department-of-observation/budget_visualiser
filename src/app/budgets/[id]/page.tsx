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

  const net = totalIncome - totalExpense;

  function hasEmptyRow(list: Row[]): boolean {
    return list.some(
      (row) => row.label.trim() === '' && row.value.trim() === '',
    );
  }

  const incomeHasEmptyRow = hasEmptyRow(incomeRows);
  const expenseHasEmptyRow = hasEmptyRow(expenseRows);

  // kept in parent so both tabs read/write same state
  function addIncomeRow() {
    if (incomeHasEmptyRow) return; // block spamming empty rows
    setIncomeRows((prev) => [...prev, { id: `${Date.now()}-inc`, label: '', value: '' }]);
  }

  function addExpenseRow() {
    if (expenseHasEmptyRow) return; // block spamming empty rows
    setExpenseRows((prev) => [...prev, { id: `${Date.now()}-exp`, label: '', value: '' }]);
  }

  function deleteRow(list: Row[], setList: (rows: Row[]) => void, rowId: string) {
    setList(list.filter((row) => row.id !== rowId));
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
    <div className="budget-page">
      <h1 className="budget-title">Budget: {budgetId}</h1>

      {/* Time period selection */}
      <div className="budget-period-group">
        {(['monthly', 'weekly', 'annually', 'custom'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`btn-period ${period === p ? 'btn-period--active' : 'btn-period--inactive'}`}
            type="button"
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="budget-custom-row">
          <label htmlFor="custom-days" className="budget-custom-label">
            Days per cycle
          </label>
          <input
            id="custom-days"
            type="number"
            min={1}
            value={customDays}
            onChange={(e) => setCustomDays(parseInt(e.target.value, 10) || 0)}
            className="budget-custom-input"
          />
        </div>
      )}

      {/* Tab selection */}
      <div className="budget-tabs">
        <button
          onClick={() => setActiveTab('input')}
          className={`btn-tab ${
            activeTab === 'input' ? 'btn-tab-input-active' : 'btn-tab-input-inactive'
          }`}
          type="button"
        >
          Data input
        </button>
        <button
          onClick={() => setActiveTab('visualisation')}
          className={`btn-tab ${
            activeTab === 'visualisation' ? 'btn-tab-vis-active' : 'btn-tab-vis-inactive'
          }`}
          type="button"
        >
          Visualisation
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'input' ? (
        <div>
          {/* Income input */}
          <section className="budget-section">
            <h2 className="budget-section-title">Income</h2>
            {incomeRows.map((row) => (
              <div key={row.id} className="budget-row">
                <input
                  value={row.label}
                  onChange={(e) => handleRowChange(incomeRows, setIncomeRows, row.id, 'label', e.target.value)}
                  onBlur={() => handleRowBlur(incomeRows, setIncomeRows, row)}
                  placeholder="Category"
                  className="budget-input-label"
                />
                <input
                  type="number"
                  value={row.value}
                  onChange={(e) => handleRowChange(incomeRows, setIncomeRows, row.id, 'value', e.target.value)}
                  onBlur={() => handleRowBlur(incomeRows, setIncomeRows, row)}
                  placeholder="Amount"
                  className="budget-input-amount"
                />
                <button
                  type="button"
                  className="budget-row-delete-btn"
                  onClick={() => deleteRow(incomeRows, setIncomeRows, row.id)}
                  aria-label="Remove income row"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={addIncomeRow}
              className="budget-add-income-btn"
              type="button"
              disabled={incomeHasEmptyRow}
            >
              Add income
            </button>
          </section>

          {/* Expenditure input */}
          <section className="budget-section">
            <h2 className="budget-section-title">Expenditure</h2>
            {expenseRows.map((row) => (
              <div key={row.id} className="budget-row">
                <input
                  value={row.label}
                  onChange={(e) => handleRowChange(expenseRows, setExpenseRows, row.id, 'label', e.target.value)}
                  onBlur={() => handleRowBlur(expenseRows, setExpenseRows, row)}
                  placeholder="Category"
                  className="budget-input-label"
                />
                <input
                  type="number"
                  value={row.value}
                  onChange={(e) => handleRowChange(expenseRows, setExpenseRows, row.id, 'value', e.target.value)}
                  onBlur={() => handleRowBlur(expenseRows, setExpenseRows, row)}
                  placeholder="Amount"
                  className="budget-input-amount"
                />
                <button
                  type="button"
                  className="budget-row-delete-btn"
                  onClick={() => deleteRow(expenseRows, setExpenseRows, row.id)}
                  aria-label="Remove expense row"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={addExpenseRow}
              className="budget-add-expense-btn"
              type="button"
              disabled={expenseHasEmptyRow}
            >
              Add expense
            </button>
          </section>

          {/* Totals */}
          <div className="budget-totals">
            <div className="budget-total-row">
              <span className="label">Total income</span>
              <span className="value">{totalIncome.toFixed(2)}</span>
            </div>
            <div className="budget-total-row">
              <span className="label">Total expenses</span>
              <span className="value">{totalExpense.toFixed(2)}</span>
            </div>
            <div className="budget-total-row budget-total-row--net">
              <span className="label">Net</span>
              <span
                className={`value ${
                  net >= 0 ? 'value-positive' : 'value-negative'
                }`}
              >
                {net >= 0 ? '+' : ''}
                {net.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Manual Save button at the end of the input tab */}
          <button
            type="button"
            onClick={saveBudgetToLocalStorage}
            className="budget-save-btn"
          >
            Save
          </button>
        </div>
      ) : (
        <BudgetVisualisation incomeRows={incomeRows} expenseRows={expenseRows} />
      )}
    </div>
  );
}
