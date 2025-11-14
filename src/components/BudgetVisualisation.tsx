// components/BudgetVisualisationD3.tsx
'use client';

import React from 'react';
import type { Row } from '@/app/types';
import BudgetSankey from '@/components/BudgetSankey';

type Props = {
  incomeRows: Row[];
  expenseRows: Row[];
  width?: number;
  height?: number;
};

export default function BudgetVisualisationD3({
  incomeRows,
  expenseRows,
  width = 900,
  height = 420,
}: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">
        Budget Sankey (draggable, custom layout)
      </h2>
      <BudgetSankey
        incomeRows={incomeRows}
        expenseRows={expenseRows}
        width={width}
        height={height}
      />
    </div>
  );
}
