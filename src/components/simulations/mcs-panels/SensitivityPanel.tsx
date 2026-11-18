import React, { useMemo, useState } from 'react';
import { SensitivityRow } from '../mcsTypes';

interface Props {
  sensitivity: SensitivityRow[];
  labelToId: Map<string, string>;
  onNodeSelect?: (nodeId: string) => void;
}

export const SensitivityPanel: React.FC<Props> = ({ sensitivity, labelToId, onNodeSelect }) => {
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...sensitivity]
        .filter((r) => r.YearsPerTRL_rho !== null || r.RandomDelay_rho !== null)
        .sort(
          (a, b) =>
            Math.abs(b.YearsPerTRL_rho ?? 0) + Math.abs(b.RandomDelay_rho ?? 0) -
            (Math.abs(a.YearsPerTRL_rho ?? 0) + Math.abs(a.RandomDelay_rho ?? 0)),
        ),
    [sensitivity],
  );

  const handleRowClick = (label: string) => {
    if (!onNodeSelect) return;
    const nodeId = labelToId.get(label);
    if (!nodeId) return;
    if (highlightedNode === label) {
      setHighlightedNode(null);
    } else {
      setHighlightedNode(label);
      onNodeSelect(nodeId);
    }
  };

  const isClickable = !!onNodeSelect;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Spearman rank correlation (ρ) between each uncertainty input and a node&apos;s completion
        year. A higher absolute value means that input drives more of the timing variance.
        Positive ρ = later completion when the input is larger.
      </p>

      {isClickable && (
        <p className="text-xs text-blue-600 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Click a row to highlight that node and its connections in the tech tree
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 text-left">
                Node
              </th>
              <th className="px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 text-right">
                Global delay ρ
              </th>
              <th className="px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 text-right">
                Local delay ρ
              </th>
              <th className="px-3 py-2 font-semibold text-gray-700 border-b border-gray-200 text-center">
                Dominant driver
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const g = row.YearsPerTRL_rho ?? 0;
              const l = row.RandomDelay_rho ?? 0;
              const dominant = Math.abs(g) >= Math.abs(l) ? 'Global' : 'Local';
              const isHighlighted = highlightedNode === row.Node;
              const canClick = isClickable && labelToId.has(row.Node);

              return (
                <tr
                  key={row.Node}
                  onClick={() => canClick && handleRowClick(row.Node)}
                  className={`border-b border-gray-100 transition-colors ${
                    canClick ? 'cursor-pointer' : ''
                  } ${
                    isHighlighted
                      ? 'bg-orange-50 ring-1 ring-inset ring-orange-300'
                      : canClick
                      ? i % 2 === 0
                        ? 'bg-white hover:bg-blue-50'
                        : 'bg-gray-50 hover:bg-blue-50'
                      : i % 2 === 0
                      ? 'bg-white'
                      : 'bg-gray-50'
                  }`}
                >
                  <td
                    className="px-3 py-2 font-medium text-gray-800 max-w-[220px] truncate"
                    title={row.Node}
                  >
                    <span className="block truncate">{row.Node}</span>
                    {isHighlighted && (
                      <span className="text-xs text-orange-500 font-normal">↗ highlighted</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className="font-mono"
                      style={{ color: g >= 0 ? '#3b82f6' : '#ef4444' }}
                    >
                      {g.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className="font-mono"
                      style={{ color: l >= 0 ? '#3b82f6' : '#ef4444' }}
                    >
                      {l.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        dominant === 'Global'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {dominant}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};