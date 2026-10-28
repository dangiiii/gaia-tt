'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TopicKey } from '@/lib/topicConfig';
import { adminHeaders } from '@/lib/adminClient';
import { PAPER_PART_SCOPE } from '@/lib/kgKeys';

interface ReviewItem {
  entityId: string;
  kind: 'paper' | 'device' | 'finding';
  title: string;
  summary: string | null;
  meta: string | null;
  llmReason: string | null;
  llmVerdict: 'keep' | 'drop' | null;
  status: 'accepted' | 'rejected';
  curated: boolean;
  curatedAt: string | null;
  votes: { up: number; down: number };
  parts?: ReviewPart[];
}

/** A paper part (experiment), curated globally under the '*' scope. */
interface ReviewPart {
  partId: string;
  label: string;
  status: 'accepted' | 'rejected';
  curated: boolean;
  curatedAt: string | null;
  votes: { up: number; down: number };
}

interface ReviewNode {
  nodeId: string;
  nodeLabel: string;
  items: ReviewItem[];
}

interface LiteratureReviewProps {
  topic: TopicKey;
  onClose: () => void;
  onVerdictChanged: (nodeId: string) => void;
}

const KIND_BADGE: Record<string, string> = {
  paper: 'bg-indigo-100 text-indigo-700',
  device: 'bg-teal-100 text-teal-700',
  finding: 'bg-amber-100 text-amber-700',
};

export const LiteratureReview: React.FC<LiteratureReviewProps> = ({
  topic,
  onClose,
  onVerdictChanged,
}) => {
  const [nodes, setNodes] = useState<ReviewNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'accepted' | 'rejected'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'ai'>('all');

  useEffect(() => {
    fetch(`/investment-tech-tree/api/kg/review?topic=${topic}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNodes(d?.nodes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [topic]);

  const setVerdict = async (nodeId: string, entityId: string, verdict: 'accept' | 'reject') => {
    const key = `${nodeId}::${entityId}`;
    setBusy(key);
    try {
      const res = await fetch('/investment-tech-tree/api/kg/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ nodeId, entityId, verdict, topic }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(`Verdict could not be saved: ${body.error ?? `HTTP ${res.status}`}`);
        return;
      }
      const patch = {
        status: (verdict === 'accept' ? 'accepted' : 'rejected') as ReviewItem['status'],
        curated: true,
        curatedAt: new Date().toISOString(),
      };
      setNodes((prev) =>
        prev.map((n) =>
          nodeId === PAPER_PART_SCOPE
            ? // Paper parts are global: update every occurrence of the part.
              {
                ...n,
                items: n.items.map((it) =>
                  it.parts?.some((p) => p.partId === entityId)
                    ? { ...it, parts: it.parts.map((p) => (p.partId === entityId ? { ...p, ...patch } : p)) }
                    : it,
                ),
              }
            : n.nodeId !== nodeId
              ? n
              : { ...n, items: n.items.map((it) => (it.entityId === entityId ? { ...it, ...patch } : it)) },
        ),
      );
      onVerdictChanged(nodeId);
    } finally {
      setBusy(null);
    }
  };

  const matches = (x: { status: string; curated: boolean }) =>
    (statusFilter === 'all' || x.status === statusFilter) &&
    (sourceFilter === 'all' || (sourceFilter === 'manual' ? x.curated : !x.curated));

  // An item is listed if it matches, or if any of its parts match (then only
  // matching parts are shown under it).
  const visibleNodes = nodes
    .map((node) => ({
      ...node,
      items: node.items
        .map((it) => ({ ...it, parts: (it.parts ?? []).filter(matches) }))
        .filter((it) => matches(it) || it.parts.length),
    }))
    .filter((node) => node.items.length);

  // Counts reflect the current filters, i.e. what is actually listed.
  const counts = { accepted: 0, rejected: 0 };
  visibleNodes.forEach((n) =>
    n.items.forEach((it) => {
      if (matches(it)) counts[it.status]++;
      it.parts.forEach((p) => counts[p.status]++);
    }),
  );
  const filtered = statusFilter !== 'all' || sourceFilter !== 'all';

  const renderVotes = (v: { up: number; down: number }) =>
    (v.up > 0 || v.down > 0) && (
      <div className="text-xs text-gray-500 mt-0.5">
        👍 {v.up} · 👎 {v.down}
      </div>
    );

  // "manual · date" stamp + Accept/Reject toggle, shared by items and paper parts.
  const renderCuration = (
    nodeId: string,
    entityId: string,
    x: { status: 'accepted' | 'rejected'; curated: boolean; curatedAt: string | null },
  ) => {
    const accepted = x.status === 'accepted';
    return (
      <div className="flex items-center gap-1 shrink-0">
        {x.curated && (
          <span
            className="text-[10px] text-gray-400 mr-1"
            title={x.curatedAt ? new Date(x.curatedAt).toLocaleString() : undefined}
          >
            manual{x.curatedAt ? ` · ${new Date(x.curatedAt).toLocaleDateString()}` : ''}
          </span>
        )}
        <Button
          variant={accepted ? 'default' : 'outline'}
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={busy === `${nodeId}::${entityId}`}
          onClick={() => setVerdict(nodeId, entityId, accepted ? 'reject' : 'accept')}
        >
          {accepted ? 'Reject' : 'Accept'}
        </Button>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Literature Curation</h2>
            <p className="text-xs text-gray-500">
              {counts.accepted} accepted · {counts.rejected} rejected
              {filtered ? ' (filtered)' : ''} — human verdicts persist across rebuilds
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="text-xs border border-gray-300 rounded px-1.5 py-1"
            >
              <option value="all">all statuses</option>
              <option value="accepted">accepted</option>
              <option value="rejected">rejected</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
              className="text-xs border border-gray-300 rounded px-1.5 py-1"
            >
              <option value="all">manual + AI</option>
              <option value="manual">manual</option>
              <option value="ai">AI</option>
            </select>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-5">
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {!loading && !nodes.length && (
            <p className="text-sm text-gray-500">No enriched nodes yet.</p>
          )}
          {!loading && nodes.length > 0 && !visibleNodes.length && (
            <p className="text-sm text-gray-500">No items match the current filters.</p>
          )}
          {visibleNodes.map((node) => {
            const items = node.items;
            return (
              <div key={node.nodeId}>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">
                  {node.nodeLabel}
                  <span className="ml-2 font-normal text-gray-400">({node.nodeId})</span>
                </h3>
                <ul className="space-y-1">
                  {items.map((it) => {
                    const accepted = it.status === 'accepted';
                    return (
                      <li
                        key={it.entityId}
                        className={`p-2 rounded-md border text-sm ${
                          accepted
                            ? 'border-gray-200 bg-white'
                            : 'border-red-100 bg-red-50/40'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Badge className={`${KIND_BADGE[it.kind]} text-[10px] shrink-0 mt-0.5`}>
                            {it.kind}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 leading-snug">
                              {it.title}
                            </div>
                            {it.meta && (
                              <div className="text-xs text-gray-500">{it.meta}</div>
                            )}
                            {it.llmReason && (
                              <div className="text-xs text-gray-400 italic mt-0.5">
                                LLM {it.llmVerdict}: {it.llmReason}
                              </div>
                            )}
                            {renderVotes(it.votes)}
                          </div>
                          {renderCuration(node.nodeId, it.entityId, it)}
                        </div>

                        {it.parts.length > 0 && (
                          <ul className="mt-2 ml-6 space-y-1 border-l-2 border-indigo-100 pl-3">
                            {it.parts.map((p) => (
                              <li
                                key={p.partId}
                                className={`flex items-start gap-2 text-xs rounded px-1.5 py-1 ${
                                  p.status === 'accepted' ? '' : 'bg-red-50/60'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className={p.status === 'accepted' ? 'text-gray-700' : 'text-gray-400 line-through'}>
                                    {p.label}
                                  </div>
                                  {renderVotes(p.votes)}
                                </div>
                                {renderCuration(PAPER_PART_SCOPE, p.partId, p)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LiteratureReview;
