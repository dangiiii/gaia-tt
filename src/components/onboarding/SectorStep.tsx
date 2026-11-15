'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { TOPICS, TopicKey } from '@/lib/topicConfig';
import { summarizeTree } from '@/lib/technologyCatalog';
import { peekTechTree, prefetchTechTree, useTechTree } from '@/hooks/useTechTree';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SECTOR_COPY, SECTOR_ORDER } from './sectors';

interface SectorStepProps {
  currentTopic: TopicKey;
  onSelectSector: (topic: TopicKey) => void;
  onSkip: () => void;
}

export function SectorStep({ currentTopic, onSelectSector, onSkip }: SectorStepProps) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-6 py-8 md:py-12">
      <header className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold tracking-wide text-gray-500">
          GAIA Lab · Investment Tech Tree
        </span>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip to the full map
        </Button>
      </header>

      <div className="mt-10 max-w-2xl space-y-4 md:mt-16">
        <DialogTitle className="text-3xl font-bold leading-tight tracking-tight text-gray-900 md:text-4xl">
          Follow a technology from research to deployment
        </DialogTitle>
        <DialogDescription className="text-base text-gray-600 md:text-lg">
          Pick a sector, then a deployment concept. We walk you through the
          milestones and enabling technologies it depends on, one step at a
          time, and point out where readiness is lowest.
        </DialogDescription>
      </div>

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Step 1 of 2 · Choose a sector
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {SECTOR_ORDER.map((topic) => (
          <SectorCard
            key={topic}
            topic={topic}
            isCurrent={topic === currentTopic}
            onSelect={onSelectSector}
          />
        ))}
      </div>

      <p className="mt-10 text-sm text-gray-500">
        Built for investors, researchers and policymakers comparing technology
        pathways. Readiness uses the 1–9 Technology Readiness Level (TRL) scale.
      </p>
    </div>
  );
}

interface SectorCardProps {
  topic: TopicKey;
  isCurrent: boolean;
  onSelect: (topic: TopicKey) => void;
}

function SectorCard({ topic, isCurrent, onSelect }: SectorCardProps) {
  const { icon: Icon, tagline } = SECTOR_COPY[topic];
  // Counts need the topic's tree, so other sectors load it on hover or focus.
  const [showCounts, setShowCounts] = useState(
    () => isCurrent || peekTechTree(topic) !== null,
  );
  const reveal = () => {
    prefetchTechTree(topic);
    setShowCounts(true);
  };

  return (
    <button
      type="button"
      onMouseEnter={reveal}
      onFocus={reveal}
      onClick={() => onSelect(topic)}
      className="group flex flex-col gap-4 rounded-xl border border-white/60 bg-white/55 p-5 text-left shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 hover:border-blue-300/80 hover:bg-white/75 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-900 text-white">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <span className="space-y-1">
        <span className="block text-lg font-semibold text-gray-900">
          {TOPICS[topic].label}
        </span>
        <span className="block text-sm text-gray-600">{tagline}</span>
      </span>
      <span className="mt-auto flex items-end justify-between gap-2">
        <span className="min-h-4 text-xs text-gray-500">
          {showCounts && <SectorCounts topic={topic} />}
        </span>
        <ArrowRight
          className="h-5 w-5 shrink-0 text-blue-600 transition group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </button>
  );
}

function SectorCounts({ topic }: { topic: TopicKey }) {
  const { techTree, error } = useTechTree(topic);
  if (error) return <>Counts unavailable</>;
  if (!techTree) return <span className="animate-pulse">Loading counts…</span>;

  if (techTree.nodes.length === 0) return <>No data loaded yet</>;

  const summary = summarizeTree(techTree);
  const parts: Array<[number, string, string]> = [
    [summary.concepts, 'concept', 'concepts'],
    [summary.milestones, 'milestone', 'milestones'],
    [summary.technologies, 'technology', 'technologies'],
  ];
  return (
    <>
      {parts
        .filter(([count]) => count > 0)
        .map(([count, singular, plural]) => `${count} ${count === 1 ? singular : plural}`)
        .join(' · ')}
    </>
  );
}
