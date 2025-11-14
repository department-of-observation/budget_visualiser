/* This page lists all budgets and provides a way to create new ones.
 * It uses local component state and localStorage to persist budget names and IDs on the client.
 */
'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface Budget {
  id: string;
  name: string;
}

export default function BudgetsPage() {
  // State for the list of budgets and the input for a new budget name.
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [newBudgetName, setNewBudgetName] = useState('');

  // Load budgets from localStorage on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('budgets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setBudgets(parsed);
        }
      }
    } catch {
      // ignore parsing errors
    }
  }, []);

  // Persist budgets to localStorage whenever they change.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('budgets', JSON.stringify(budgets));
    }
  }, [budgets]);

  // Generate a unique identifier for a new budget.
  function generateId() {
    return Math.random().toString(36).substring(2, 10);
  }

  // Add a new budget to the list.
  function addBudget() {
    const trimmed = newBudgetName.trim();
    if (!trimmed) return;
    const id = generateId();
    setBudgets((prev) => [...prev, { id, name: trimmed }]);
    setNewBudgetName('');
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Budgets Overview</h1>
      {/* Input for new budget */}
      <div className="mb-4 flex gap-2">
        <input
          value={newBudgetName}
          onChange={(e) => setNewBudgetName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addBudget();
            }
          }}
          placeholder="New budget name"
          className="flex-grow min-w-[10rem] rounded-md border px-2 py-1 dark:bg-black dark:border-gray-700"
        />
        <button
          onClick={addBudget}
          className="rounded-md bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
        >
          Add Budget
        </button>
      </div>
      {/* List of budgets */}
      {budgets.length === 0 ? (
        <p className="text-gray-500">No budgets yet. Create one above.</p>
      ) : (
        <ul className="space-y-2">
          {budgets.map((budget) => (
            <li key={budget.id} className="p-3 border rounded flex justify-between items-center dark:border-gray-700">
              <Link href={`/budgets/${budget.id}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {budget.name || '(Untitled Budget)'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}