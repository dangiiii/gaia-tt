'use client';

import React, { useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { ArrowRight, X } from 'lucide-react';
import { TOPICS, TopicKey } from '@/lib/topicConfig';
import { NODE_LABELS, TechTree, UiNode } from '@/lib/types';
import { loadTechTree, peekTechTree } from '@/hooks/useTechTree';
import {
  AGGREGATION_MODE_LABELS,
  AggregationMode,
  TreeSummary,
  projectTree,
  summarizeTree,
} from '@/lib/treeProjection';
import { layoutProjection, roleColor } from '@/lib/elkjs';
import { nodeRolePluralLabel } from '@/lib/nodeRoles';
import {
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TECH_TREE_NODE_TYPES } from './techTreeNodeTypes';
import { TechTreeNodeActionsContext } from './techTreeNodeActions';

export type ComparisonMode = Exclude<AggregationMode, 'none'>;

export const COMPARISON_MODES: ComparisonMode[] = [
  'category-role',
  'category',
  'role',
];

const TOPIC_KEYS = Object.keys(TOPICS) as TopicKey[];
/** One neutral hue: the TRL bars measure readiness, not a node role. */
const TRL_BAR_COLOR = '#64748b';
/** Tallest bar's share of the plot height; the rest is room for its label. */
const TRL_PLOT_FILL = 0.82;

type TreeState =
  | { status: 'loading' }
  | { status: 'ready'; tree: TechTree }
  | { status: 'error' };

function useTechTrees(enabled: boolean): Record<TopicKey, TreeState> {
  const [states, setStates] = useState(
    () =>
      Object.fromEntries(
        TOPIC_KEYS.map((topic) => {
          const tree = peekTechTree(topic);
          return [topic, tree ? { status: 'ready', tree } : { status: 'loading' }];
        }),
      ) as Record<TopicKey, TreeState>,
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    for (const topic of TOPIC_KEYS) {
      loadTechTree(topic).then(
        (tree) => {
          if (!cancelled) {
            setStates((current) =>
              current[topic].status === 'ready' &&
              (current[topic] as { tree: TechTree }).tree === tree
                ? current
                : { ...current, [topic]: { status: 'ready', tree } },
            );
          }
        },
        () => {
          if (!cancelled) {
            setStates((current) => ({ ...current, [topic]: { status: 'error' } }));
          }
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return states;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

interface TreeComparisonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTopic: TopicKey;
  initialMode: ComparisonMode;
  /** Opens a tree in the main view, aggregated the same way. */
  onOpenTopic: (topic: TopicKey, mode: ComparisonMode) => void;
}

/**
 * Every tech tree side by side, scaled down to aggregates: headline figures,
 * role mix and readiness on shared scales, then each tree's aggregated
 * structure.
 */
export function TreeComparison({
  open,
  onOpenChange,
  currentTopic,
  initialMode,
  onOpenTopic,
}: TreeComparisonProps) {
  const [mode, setMode] = useState<ComparisonMode>(initialMode);
  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode]);

  const states = useTechTrees(open);
  const summaries = useMemo(
    () =>
      Object.fromEntries(
        TOPIC_KEYS.map((topic) => {
          const state = states[topic];
          return [
            topic,
            state.status === 'ready' && state.tree.nodes.length
              ? summarizeTree(state.tree)
              : null,
          ];
        }),
      ) as Record<TopicKey, TreeSummary | null>,
    [states],
  );
  // One y-scale for every TRL chart, so bar heights compare across trees.
  const maxTrlShare = Math.max(
    0.01,
    ...TOPIC_KEYS.flatMap((topic) => {
      const summary = summaries[topic];
      const rated = summary
        ? summary.nodeCount - summary.unratedCount
        : 0;
      return summary && rated
        ? summary.trlHistogram.map((count) => count / rated)
        : [];
    }),
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[80]" />
        <DialogPrimitive.Content className="fixed inset-2 z-[81] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl focus:outline-none md:inset-6">
          {/* Comparison previews are static: no tree actions inside. */}
          <TechTreeNodeActionsContext.Provider value={null}>
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
              <div className="space-y-1">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Compare trees
                </DialogTitle>
                <DialogDescription className="max-w-2xl text-sm text-gray-600">
                  Each tree scaled down to aggregate nodes, with the same
                  measures side by side. Figures cover the full dataset,
                  before any filters.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
                  role="radiogroup"
                  aria-label="Aggregate by"
                >
                  {COMPARISON_MODES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={mode === option}
                      onClick={() => setMode(option)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        mode === option
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {AGGREGATION_MODE_LABELS[option]}
                    </button>
                  ))}
                </div>
                <DialogPrimitive.Close
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="Close comparison"
                >
                  <X className="h-5 w-5" aria-hidden />
                </DialogPrimitive.Close>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
                  <caption className="sr-only">
                    Headline figures for each tech tree
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="w-48" />
                      {TOPIC_KEYS.map((topic) => (
                        <th
                          key={topic}
                          scope="col"
                          className="px-4 pb-3 text-left align-bottom font-normal"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold text-gray-900">
                              {TOPICS[topic].label}
                            </span>
                            {topic === currentTopic && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                                Current
                              </span>
                            )}
                          </div>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto px-0 py-1 text-xs"
                            disabled={!summaries[topic]}
                            onClick={() => onOpenTopic(topic, mode)}
                          >
                            Open aggregated
                            <ArrowRight aria-hidden />
                          </Button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    <MetricRow
                      first
                      label="Nodes"
                      summaries={summaries}
                      states={states}
                      value={(s) => s.nodeCount.toLocaleString()}
                    />
                    <MetricRow
                      label="Links"
                      summaries={summaries}
                      states={states}
                      value={(s) => s.edgeCount.toLocaleString()}
                    />
                    <MetricRow
                      label="Categories"
                      summaries={summaries}
                      states={states}
                      value={(s) => String(s.categoryCount)}
                    />
                    <MetricRow
                      label="Longest prerequisite chain"
                      hint="Nodes on the longest path from a foundation to the node it unlocks"
                      summaries={summaries}
                      states={states}
                      value={(s) =>
                        `${s.longestChain} node${s.longestChain === 1 ? '' : 's'}`
                      }
                    />
                    <MetricRow
                      label="Median TRL"
                      summaries={summaries}
                      states={states}
                      value={(s) =>
                        s.medianTrl === null ? '—' : String(s.medianTrl)
                      }
                    />
                    <MetricRow
                      label="Mature (TRL 7–9)"
                      hint="Share of rated nodes demonstrated as a system or better"
                      summaries={summaries}
                      states={states}
                      value={(s) =>
                        s.matureShare === null ? '—' : percent(s.matureShare)
                      }
                    />
                    <tr className="border-t border-gray-100 align-top">
                      <th
                        scope="row"
                        className="py-3 pr-4 text-left font-medium text-gray-600"
                      >
                        Role mix
                      </th>
                      {TOPIC_KEYS.map((topic) => (
                        <td key={topic} className="px-4 py-3">
                          {summaries[topic] ? (
                            <RoleMix summary={summaries[topic]!} />
                          ) : (
                            <EmptyCell state={states[topic]} compact />
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-t border-gray-100 align-top">
                      <th
                        scope="row"
                        className="py-3 pr-4 text-left font-medium text-gray-600"
                      >
                        Readiness
                        <span className="block text-xs font-normal text-gray-500">
                          Share of rated nodes at each TRL, same scale for
                          every tree
                        </span>
                      </th>
                      {TOPIC_KEYS.map((topic) => (
                        <td key={topic} className="px-4 py-3">
                          {summaries[topic] ? (
                            <TrlDistribution
                              summary={summaries[topic]!}
                              maxShare={maxTrlShare}
                            />
                          ) : (
                            <EmptyCell state={states[topic]} compact />
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="mt-8 text-sm font-semibold text-gray-900">
                Aggregated structure
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Grouped by {AGGREGATION_MODE_LABELS[mode].toLowerCase()}. Edge
                labels count the links each arrow stands for.
              </p>
              <div className="mt-3 grid gap-4 lg:grid-cols-3">
                {TOPIC_KEYS.map((topic) => {
                  const state = states[topic];
                  return (
                    <section
                      key={topic}
                      aria-label={`${TOPICS[topic].label}, aggregated`}
                      className="overflow-hidden rounded-xl border border-gray-200"
                    >
                      <div className="border-b border-gray-100 px-4 py-2 text-sm font-medium text-gray-800">
                        {TOPICS[topic].label}
                      </div>
                      <div className="h-[380px]">
                        {state.status === 'ready' && state.tree.nodes.length ? (
                          <AggregatedPreview tree={state.tree} mode={mode} />
                        ) : (
                          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500">
                            <EmptyCell state={state} />
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </TechTreeNodeActionsContext.Provider>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

function EmptyCell({
  state,
  compact = false,
}: {
  state: TreeState;
  /** Rows after the first say it once: a dash instead of the reason. */
  compact?: boolean;
}) {
  if (compact && state.status !== 'loading') {
    return <span className="text-sm font-normal text-gray-300">—</span>;
  }
  return (
    <span className="text-sm font-normal text-gray-400">
      {state.status === 'loading'
        ? 'Loading…'
        : state.status === 'error'
          ? 'Could not load this tree'
          : 'No nodes in this database'}
    </span>
  );
}

function MetricRow({
  label,
  hint,
  summaries,
  states,
  value,
  first = false,
}: {
  label: string;
  hint?: string;
  first?: boolean;
  summaries: Record<TopicKey, TreeSummary | null>;
  states: Record<TopicKey, TreeState>;
  value: (summary: TreeSummary) => string;
}) {
  return (
    <tr className="border-t border-gray-100">
      <th
        scope="row"
        className="py-2.5 pr-4 text-left font-medium text-gray-600"
        title={hint}
      >
        {label}
      </th>
      {TOPIC_KEYS.map((topic) => (
        <td key={topic} className="px-4 py-2.5 font-semibold text-gray-900">
          {summaries[topic] ? (
            value(summaries[topic]!)
          ) : (
            <EmptyCell state={states[topic]} compact={!first} />
          )}
        </td>
      ))}
    </tr>
  );
}

/**
 * Thin segmented bar plus one row per role. The rows carry names and
 * figures (and act as the legend), so identity never rests on colour alone.
 */
function RoleMix({ summary }: { summary: TreeSummary }) {
  const total = Math.max(summary.nodeCount, 1);
  const roles = NODE_LABELS.filter((role) => summary.roleCounts[role] > 0);
  return (
    <div className="space-y-2">
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {roles.map((role) => (
          <span
            key={role}
            style={{
              width: `${(summary.roleCounts[role] / total) * 100}%`,
              background: roleColor(role),
            }}
          />
        ))}
      </div>
      <ul className="space-y-1 text-xs">
        {NODE_LABELS.map((role) => (
          <li key={role} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: roleColor(role) }}
              aria-hidden
            />
            <span className="flex-1 text-gray-700">
              {nodeRolePluralLabel(role)}
            </span>
            <span className="font-semibold text-gray-900">
              {summary.roleCounts[role]}
            </span>
            <span className="w-9 text-right text-gray-500">
              {percent(summary.roleCounts[role] / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Columns for TRL 1–9 on a y-scale shared by every tree. */
function TrlDistribution({
  summary,
  maxShare,
}: {
  summary: TreeSummary;
  maxShare: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const rated = summary.nodeCount - summary.unratedCount;
  const shares = summary.trlHistogram.map((count) =>
    rated ? count / rated : 0,
  );
  const peak = shares.indexOf(Math.max(...shares));

  if (!rated) {
    return <span className="text-sm text-gray-400">No TRL ratings</span>;
  }

  return (
    <figure className="space-y-1">
      <div
        className="relative flex h-20 items-end gap-0.5 border-b border-gray-200"
        onMouseLeave={() => setActive(null)}
      >
        {shares.map((share, index) => {
          const count = summary.trlHistogram[index];
          const isActive = active === index;
          return (
            <div
              key={index}
              tabIndex={0}
              role="img"
              aria-label={`TRL ${index + 1}: ${count} node${
                count === 1 ? '' : 's'
              }, ${percent(share)} of rated`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              className="relative flex h-full flex-1 items-end justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {(isActive || (active === null && index === peak)) &&
                count > 0 && (
                  <span
                    className={`pointer-events-none absolute z-10 whitespace-nowrap text-[10px] font-semibold ${
                      isActive
                        ? 'rounded bg-gray-900 px-1.5 py-0.5 text-white shadow'
                        : 'text-gray-700'
                    }`}
                    style={{
                      bottom: `calc(${(share / maxShare) * TRL_PLOT_FILL * 100}% + 2px)`,
                    }}
                  >
                    {isActive
                      ? `TRL ${index + 1} · ${count} · ${percent(share)}`
                      : percent(share)}
                  </span>
                )}
              <span
                className="w-full max-w-6 rounded-t"
                style={{
                  height: count
                    ? `${Math.max((share / maxShare) * TRL_PLOT_FILL * 100, 2)}%`
                    : 0,
                  background: TRL_BAR_COLOR,
                  opacity: active === null || isActive ? 1 : 0.55,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-0.5 text-[10px] text-gray-500" aria-hidden>
        {shares.map((_, index) => (
          <span key={index} className="flex-1 text-center">
            {index + 1}
          </span>
        ))}
      </div>
      <figcaption className="text-[11px] text-gray-500">
        TRL · {rated} rated
        {summary.unratedCount ? `, ${summary.unratedCount} unrated` : ''}
      </figcaption>
      <table className="sr-only">
        <caption>Nodes per TRL</caption>
        <tbody>
          {summary.trlHistogram.map((count, index) => (
            <tr key={index}>
              <th scope="row">TRL {index + 1}</th>
              <td>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** A tree's aggregate graph, laid out like the main view but static. */
function AggregatedPreview({
  tree,
  mode,
}: {
  tree: TechTree;
  mode: ComparisonMode;
}) {
  const [layout, setLayout] = useState<{
    nodes: UiNode[];
    edges: Edge[];
    key: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    layoutProjection(projectTree(tree, { mode })).then((result) => {
      if (cancelled) return;
      setLayout({
        nodes: result.layoutedNodes,
        edges: result.layoutedEdges,
        key: `${mode}:${result.layoutedNodes.length}`,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [tree, mode]);

  if (!layout) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Laying out…
      </div>
    );
  }

  return (
    // A fresh provider per layout: this sits inside the main tree's provider
    // and must not share its viewport; remounting also refits the view.
    <ReactFlowProvider key={layout.key}>
      <ReactFlow
        nodes={layout.nodes}
        edges={layout.edges}
        nodeTypes={TECH_TREE_NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.05}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        // Let the dialog scroll; zoom with pinch or the controls.
        zoomOnScroll={false}
        preventScrolling={false}
        colorMode="light"
      >
        <Background bgColor="white" variant={BackgroundVariant.Dots} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
