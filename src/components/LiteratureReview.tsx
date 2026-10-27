'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TopicKey } from '@/lib/topicConfig';

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
  const [showRejectedOnly, setShowRejectedOnly] = useState(false);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, entityId, verdict, topic }),
      });
      if (!res.ok) return;
      setNodes((prev) =>
        prev.map((n) =>
          n.nodeId !== nodeId
            ? n
            : {
                ...n,
                items: n.items.map((it) =>
                  it.entityId === entityId
                    ? { ...it, status: verdict === 'accept' ? 'accepted' : 'rejected', curated: true }
                    : it,
                ),
              },
        ),
      );
      onVerdictChanged(nodeId);
    } finally {
      setBusy(null);
    }
  };

  const counts = nodes.reduce(
    (acc, n) => {
      n.items.forEach((it) =>
        it.status === 'accepted' ? acc.accepted++ : acc.rejected++,
      );
      return acc;
    },
    { accepted: 0, rejected: 0 },
  );

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
              {counts.accepted} accepted · {counts.rejected} rejected — human verdicts persist across rebuilds
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={showRejectedOnly}
                onChange={(e) => setShowRejectedOnly(e.target.checked)}
              />
              rejected only
            </label>
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
          {nodes.map((node) => {
            const items = showRejectedOnly
              ? node.items.filter((i) => i.status === 'rejected')
              : node.items;
            if (!items.length) return null;
            return (
              <div key={node.nodeId}>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">
                  {node.nodeLabel}
                  <span className="ml-2 font-normal text-gray-400">({node.nodeId})</span>
                </h3>
                <ul className="space-y-1">
                  {items.map((it) => {
                    const key = `${node.nodeId}::${it.entityId}`;
                    const accepted = it.status === 'accepted';
                    return (
                      <li
                        key={it.entityId}
                        className={`flex items-start gap-2 p-2 rounded-md border text-sm ${
                          accepted
                            ? 'border-gray-200 bg-white'
                            : 'border-red-100 bg-red-50/40'
                        }`}
                      >
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
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {it.curated && (
                            <span className="text-[10px] text-gray-400 mr-1">manual</span>
                          )}
                          <Button
                            variant={accepted ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={busy === key}
                            onClick={() =>
                              setVerdict(node.nodeId, it.entityId, accepted ? 'reject' : 'accept')
                            }
                          >
                            {accepted ? 'Reject' : 'Accept'}
                          </Button>
                        </div>
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
