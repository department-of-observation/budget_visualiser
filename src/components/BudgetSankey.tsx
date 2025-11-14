// components/BudgetSankey.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Row } from '@/app/types';

type Props = {
  incomeRows: Row[];
  expenseRows: Row[];
  width?: number;
  height?: number;
};

type NodeType = 'income' | 'expense' | 'savings' | 'debt' | 'pool';

type NodeDatum = {
  id: string;
  name: string;
  type: NodeType;
  value: number;
};

type NodeLayout = NodeDatum & {
  colKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type LinkDatum = {
  source: string;
  target: string;
  value: number;
};

export default function BudgetSankey({
  incomeRows,
  expenseRows,
  width = 900,
  height = 420,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const margin = { top: 24, right: 40, bottom: 24, left: 40 };
    const innerWidth = Math.max(10, width - margin.left - margin.right);
    const innerHeight = Math.max(10, height - margin.top - margin.bottom);

    const toNum = (s: string) => {
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    // --- Build base data -----------------------------------------------------
    const incomes = incomeRows
      .map((r) => ({
        id: `inc-${r.id}`,
        label: r.label || 'Income',
        value: toNum(r.value),
      }))
      .filter((d) => d.value > 0);

    const expenses = expenseRows
      .map((r) => ({
        id: `exp-${r.id}`,
        label: r.label || 'Expense',
        value: toNum(r.value),
      }))
      .filter((d) => d.value > 0);

    const totalIncome = d3.sum(incomes, (d) => d.value);
    const totalExpense = d3.sum(expenses, (d) => d.value);

    if (totalIncome <= 0 && totalExpense <= 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#9ca3af')
        .style('font-size', 14)
        .text('Add some income and expense amounts to see the flow.');
      return;
    }

    let debtTotal = 0;
    let savingsTotal = 0;

    if (totalExpense > totalIncome) {
      debtTotal = totalExpense - totalIncome;
    } else {
      savingsTotal = totalIncome - totalExpense;
    }

    const nodesRaw: NodeDatum[] = [];

    // Sources: income
    for (const inc of incomes) {
      nodesRaw.push({
        id: inc.id,
        name: inc.label,
        type: 'income',
        value: inc.value,
      });
    }

    // Debt as extra source on left if needed
    if (debtTotal > 0) {
      nodesRaw.push({
        id: 'debt',
        name: 'Debt',
        type: 'debt',
        value: debtTotal,
      });
    }

    const budgetInTotal = totalIncome + debtTotal;

    // Middle pool
    nodesRaw.push({
      id: 'budget',
      name: 'Total Budget',
      type: 'pool',
      value: budgetInTotal,
    });

    // Outputs: expenses + savings
    for (const exp of expenses) {
      nodesRaw.push({
        id: exp.id,
        name: exp.label,
        type: 'expense',
        value: exp.value,
      });
    }

    if (savingsTotal > 0) {
      nodesRaw.push({
        id: 'savings',
        name: 'Savings',
        type: 'savings',
        value: savingsTotal,
      });
    }

    const links: LinkDatum[] = [];

    // Income -> Budget
    for (const inc of incomes) {
      if (inc.value > 0) {
        links.push({
          source: inc.id,
          target: 'budget',
          value: inc.value,
        });
      }
    }

    // Debt -> Budget
    if (debtTotal > 0) {
      links.push({
        source: 'debt',
        target: 'budget',
        value: debtTotal,
      });
    }

    // Budget -> Expenses
    for (const exp of expenses) {
      if (exp.value > 0) {
        links.push({
          source: 'budget',
          target: exp.id,
          value: exp.value,
        });
      }
    }

    // Budget -> Savings
    if (savingsTotal > 0) {
      links.push({
        source: 'budget',
        target: 'savings',
        value: savingsTotal,
      });
    }

    if (!links.length) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#9ca3af')
        .style('font-size', 14)
        .text('Add some income and expense amounts to see the flow.');
      return;
    }

    // --- In/out totals per node ---------------------------------------------
    const nodeIn = new Map<string, number>();
    const nodeOut = new Map<string, number>();

    for (const n of nodesRaw) {
      nodeIn.set(n.id, 0);
      nodeOut.set(n.id, 0);
    }

    for (const l of links) {
      nodeOut.set(l.source, (nodeOut.get(l.source) || 0) + l.value);
      nodeIn.set(l.target, (nodeIn.get(l.target) || 0) + l.value);
    }

    const nodes: NodeDatum[] = nodesRaw.map((n) => {
      const vIn = nodeIn.get(n.id) || 0;
      const vOut = nodeOut.get(n.id) || 0;
      const val = Math.max(vIn, vOut, n.value || 0);
      return { ...n, value: val };
    });

    const nodeTotalMap = new Map<string, number>();
    nodes.forEach((n) => nodeTotalMap.set(n.id, n.value));

    // --- Columns: sources -> budget -> outputs ------------------------------
    const sources = nodes.filter(
      (n) => n.type === 'income' || n.type === 'debt',
    );
    const budgetNodes = nodes.filter((n) => n.type === 'pool');
    const outs = nodes.filter(
      (n) => n.type === 'expense' || n.type === 'savings',
    );

    type Column = { key: string; nodes: NodeDatum[] };
    const columns: Column[] = [];
    if (sources.length) columns.push({ key: 'source', nodes: sources });
    if (budgetNodes.length) columns.push({ key: 'budget', nodes: budgetNodes });
    if (outs.length) columns.push({ key: 'out', nodes: outs });

    if (!columns.length) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#9ca3af')
        .style('font-size', 14)
        .text('No nodes to display.');
      return;
    }

    const nodeWidthPx = 18;
    const nodePadding = 10;
    const minNodeHeight = 8;

    const nCol = columns.length;
    const colSpacing = nCol > 1 ? innerWidth / (nCol - 1) : 0;

    const nodeColorForType = (type: NodeType) => {
      switch (type) {
        case 'income':
          return '#16a34a';
        case 'expense':
          return '#ef4444';
        case 'savings':
          return '#2563eb';
        case 'debt':
          return '#ea580c';
        case 'pool':
          return '#6b7280';
        default:
          return '#9ca3af';
      }
    };

    // --- Global vertical scale: comparable bar heights across columns -------
    const kyCandidates: number[] = [];
    columns.forEach((col) => {
      const colNodes = col.nodes;
      const totalVal = d3.sum(colNodes, (d) => d.value);
      const pad = nodePadding * Math.max(colNodes.length - 1, 0);
      if (totalVal > 0 && innerHeight > pad) {
        kyCandidates.push((innerHeight - pad) / totalVal);
      }
    });

    let ky =
      kyCandidates.length > 0
        ? d3.min(kyCandidates)!
        : innerHeight / (d3.max(nodes, (d) => d.value) || 1);

    if (!Number.isFinite(ky) || ky <= 0) ky = 1;

    const nodesLayout: NodeLayout[] = [];
    const nodeById = new Map<string, NodeLayout>();
    const colMap = new Map<string, NodeLayout[]>();

    // Initial layout per column
    columns.forEach((col, colIndex) => {
      const colNodes: NodeLayout[] = [];
      const x = margin.left + colIndex * colSpacing;

      let yPos = margin.top;
      col.nodes.forEach((n) => {
        const rawHeight = n.value * ky;
        const h = Math.max(minNodeHeight, rawHeight);

        const layout: NodeLayout = {
          ...n,
          colKey: col.key,
          x,
          y: yPos,
          width: nodeWidthPx,
          height: h,
        };

        yPos += h + nodePadding;

        nodesLayout.push(layout);
        colNodes.push(layout);
        nodeById.set(layout.id, layout);
      });

      colMap.set(col.key, colNodes);
    });

    const gRoot = svg.append('g').attr('class', 'budget-sankey-root');
    const linkGroup = gRoot.append('g').attr('class', 'links');
    const nodeGroup = gRoot.append('g').attr('class', 'nodes');

    const linkSelection = linkGroup
      .selectAll<SVGPathElement, LinkDatum>('path')
      .data(links)
      .join('path')
      .attr('fill', (l) => {
        const sourceNode = nodeById.get(l.source);
        return sourceNode ? nodeColorForType(sourceNode.type) : '#9ca3af';
      })
      .attr('fill-opacity', 0.35)
      .attr('stroke', 'none');

    const nodeSelection = nodeGroup
      .selectAll<SVGGElement, NodeLayout>('g')
      .data(nodesLayout)
      .join('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x},${d.y})`);

    nodeSelection
      .append('rect')
      .attr('width', (d) => d.width)
      .attr('height', (d) => d.height)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', (d) => nodeColorForType(d.type))
      .attr('stroke', '#000')
      .attr('stroke-opacity', 0.08)
      .attr('stroke-width', 0.5)
      .style('cursor', 'ns-resize');

    nodeSelection
      .append('text')
      .attr('x', (d) => d.width + 6)
      .attr('y', (d) => d.height / 2)
      .attr('dy', '0.35em')
      .text((d) => d.name)
      .style('font-size', 12)
      .style('fill', '#111827')
      .style('pointer-events', 'none');

    // --- LINKS: always recomputed from current node.y so they stay glued ----
    const updateLinkPaths = () => {
      const nodeSourceOffset = new Map<string, number>();
      const nodeTargetOffset = new Map<string, number>();

      linkSelection.attr('d', (l: LinkDatum) => {
        const source = nodeById.get(l.source);
        const target = nodeById.get(l.target);
        if (!source || !target) return '';

        const sTotal =
          nodeOut.get(l.source) ||
          nodeTotalMap.get(l.source) ||
          0;
        const tTotal =
          nodeIn.get(l.target) ||
          nodeTotalMap.get(l.target) ||
          0;

        const sH = sTotal > 0 ? (l.value / sTotal) * source.height : 0;
        const tH = tTotal > 0 ? (l.value / tTotal) * target.height : 0;

        const sUsed = nodeSourceOffset.get(l.source) || 0;
        const tUsed = nodeTargetOffset.get(l.target) || 0;

        const syTop = source.y + sUsed;
        const syBottom = syTop + sH;

        const tyTop = target.y + tUsed;
        const tyBottom = tyTop + tH;

        nodeSourceOffset.set(l.source, sUsed + sH);
        nodeTargetOffset.set(l.target, tUsed + tH);

        const sx = source.x + source.width;
        const tx = target.x;
        const mx = (sx + tx) / 2;

        return [
          'M', sx, syTop,
          'C', mx, syTop, mx, tyTop, tx, tyTop,
          'L', tx, tyBottom,
          'C', mx, tyBottom, mx, syBottom, sx, syBottom,
          'Z',
        ].join(' ');
      });
    };

    updateLinkPaths();

    // --- Highlight logic -----------------------------------------------------
    const clearHighlight = () => {
      (linkSelection as any)
        .transition()
        .duration(220)
        .ease(d3.easeCubicOut)
        .attr('fill-opacity', 0.35);

      nodeSelection
        .select<SVGRectElement>('rect')
        .transition()
        .duration(220)
        .ease(d3.easeCubicOut)
        .attr('opacity', 1)
        .attr('stroke-width', 0.5);
    };

    const highlightFromNode = (startId: string) => {
      const visitedNodes = new Set<string>();
      const visitedLinks = new Set<number>();

      const queue: string[] = [startId];
      visitedNodes.add(startId);

      while (queue.length) {
        const nid = queue.shift()!;
        links.forEach((l, idx) => {
          if (visitedLinks.has(idx)) return;
          if (l.source === nid || l.target === nid) {
            visitedLinks.add(idx);
            const other = l.source === nid ? l.target : l.source;
            if (!visitedNodes.has(other)) {
              visitedNodes.add(other);
              queue.push(other);
            }
          }
        });
      }

      (linkSelection as any)
        .transition()
        .duration(220)
        .ease(d3.easeCubicOut)
        .attr('fill-opacity', (_l: LinkDatum, i: number) =>
          visitedLinks.has(i) ? 0.9 : 0.08,
        );

      nodeSelection
        .select<SVGRectElement>('rect')
        .transition()
        .duration(220)
        .ease(d3.easeCubicOut)
        .attr('opacity', (d: NodeLayout) =>
          visitedNodes.has(d.id) ? 1 : 0.3,
        )
        .attr('stroke-width', (d: NodeLayout) =>
          visitedNodes.has(d.id) ? 2 : 0.5,
        );
    };

    // --- Helper: animate one node to targetY, and keep links in sync --------
    const animateNodeTo = (node: NodeLayout, targetY: number) => {
      const startY = node.y;
      if (Math.abs(targetY - startY) < 0.5) return;

      const sel = nodeSelection.filter(
        (nd) => (nd as NodeLayout).id === node.id,
      );

      sel
        .interrupt()
        .transition()
        .duration(260)
        .ease(d3.easeCubicOut)
        .tween('move', function () {
          const self = d3.select(this as SVGGElement);
          const interp = d3.interpolateNumber(startY, targetY);
          return (t: number) => {
            node.y = interp(t);
            self.attr('transform', `translate(${node.x},${node.y})`);
            updateLinkPaths();
          };
        });
    };

    // --- Drag with live continuous reordering & soft motion -----------------
    const dragBehaviour = d3
      .drag<SVGGElement, NodeLayout>()
      .on('start', function (event, d) {
        // prevent background click
        event.sourceEvent.stopPropagation();
        (d as any)._snapY = d.y;
      })
      .on('drag', function (event, d) {
        const colNodes = colMap.get(d.colKey);
        if (!colNodes) return;

        const minY = margin.top;
        const maxY = margin.top + innerHeight - d.height;

        // move dragged node, but clamp to canvas
        d.y = Math.max(minY, Math.min(maxY, d.y + event.dy));
        d3.select(this).attr('transform', `translate(${d.x},${d.y})`);

        const centerD = d.y + d.height / 2;

        // "snap zones" so dragging to top/bottom always lets it become first/last
        const topSnapZone = margin.top + nodePadding * 0.5;
        const bottomSnapZone =
          margin.top + innerHeight - nodePadding * 0.5 - d.height;

        let newIndex: number;

        if (d.y <= topSnapZone) {
          // force to very top slot
          newIndex = 0;
        } else if (d.y >= bottomSnapZone) {
          // force to very bottom slot
          newIndex = colNodes.length - 1;
        } else {
          // otherwise: choose slot based on center relative to other slots
          const others = colNodes.filter((n) => n.id !== d.id);
          let yPos = margin.top;
          const slotCenters: number[] = [];

          // imagine the column stacked WITHOUT the dragged node
          others.forEach((n) => {
            const c = yPos + n.height / 2;
            slotCenters.push(c);
            yPos += n.height + nodePadding;
          });

          newIndex = 0;
          for (let i = 0; i < slotCenters.length; i++) {
            if (centerD > slotCenters[i]) newIndex = i + 1;
          }
        }

        const currIndex = colNodes.findIndex((n) => n.id === d.id);
        if (currIndex === -1) return;

        // update logical order in this column
        if (newIndex !== currIndex) {
          colNodes.splice(currIndex, 1);
          colNodes.splice(newIndex, 0, d);
        }

        // now re-stack all nodes in that column according to new order
        let yPos = margin.top;
        colNodes.forEach((n) => {
          const targetY = yPos;
          yPos += n.height + nodePadding;

          if (n.id === d.id) {
            // dragged node will snap here on release
            (d as any)._snapY = targetY;
          } else {
            // neighbours ease into their slots
            animateNodeTo(n, targetY);
          }
        });

        // keep links glued to whatever the current node.y is
        updateLinkPaths();
      })
      .on('end', function () {
        const d = (this as any).__data__ as NodeLayout;
        const snapY = (d as any)._snapY ?? d.y;

        const startY = d.y;
        const sel = d3.select(this as SVGGElement);

        if (Math.abs(snapY - startY) < 0.5) {
          d.y = snapY;
          sel.attr('transform', `translate(${d.x},${d.y})`);
          updateLinkPaths();
          return;
        }

        // soft snap into its final slot
        sel
          .interrupt()
          .transition()
          .duration(260)
          .ease(d3.easeCubicOut)
          .tween('move', () => {
            const interp = d3.interpolateNumber(startY, snapY);
            return (t: number) => {
              d.y = interp(t);
              sel.attr('transform', `translate(${d.x},${d.y})`);
              updateLinkPaths();
            };
          });
      });

    (nodeSelection as any).call(dragBehaviour as any);


    // --- Click interactions --------------------------------------------------
    nodeSelection.on('click', (event, d) => {
      event.stopPropagation();
      highlightFromNode(d.id);
    });

    linkSelection.on('click', (event, l) => {
      event.stopPropagation();
      highlightFromNode(l.source);
    });

    svg.on('click', () => {
      clearHighlight();
    });

    // --- Zoom / pan ---------------------------------------------------------
    const zoomBehaviour = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2])
      .on('zoom', (event) => {
        gRoot.attr('transform', event.transform as any);
      });

    (svg as any).call(zoomBehaviour as any);

    clearHighlight();
  }, [incomeRows, expenseRows, width, height]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ border: '1px solid #eee', borderRadius: 6 }}
    />
  );
}
