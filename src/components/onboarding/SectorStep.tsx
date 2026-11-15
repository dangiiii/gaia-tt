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
    <div className="animate-fade-rise flex flex-col px-5 py-5 sm:px-7 sm:py-7">
      <header className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
          Investment Tech Tree
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-neutral-500 hover:text-neutral-900"
          onClick={onSkip}
        >
          Skip
        </Button>
      </header>

      <div className="mt-8 space-y-2 sm:mt-10">
        <DialogTitle className="text-[1.75rem] font-semibold leading-tight tracking-tight text-neutral-900 sm:text-[2rem]">
          Where do you want to start?
        </DialogTitle>
        <DialogDescription className="max-w-md text-[15px] leading-relaxed text-neutral-500">
          Choose a sector. Next you&apos;ll pick one technology to follow step by
          step.
        </DialogDescription>
      </div>

      <div className="mt-7 space-y-2.5" role="list">
        {SECTOR_ORDER.map((topic, index) => (
          <div
            key={topic}
            className="animate-fade-rise"
            style={{ animationDelay: `${80 + index * 60}ms`, animationFillMode: 'both' }}
            role="listitem"
          >
            <SectorChoice
              topic={topic}
              isCurrent={topic === currentTopic}
              onSelect={onSelectSector}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface SectorChoiceProps {
  topic: TopicKey;
  isCurrent: boolean;
  onSelect: (topic: TopicKey) => void;
}

function SectorChoice({ topic, isCurrent, onSelect }: SectorChoiceProps) {
  const { icon: Icon, tagline } = SECTOR_COPY[topic];
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
      className="choice-row group"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition duration-300 group-hover:scale-[1.03]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-[15px] font-semibold text-neutral-900">
          {TOPICS[topic].label}
        </span>
        <span className="block text-[13px] leading-snug text-neutral-500">
          {tagline}
        </span>
        <span className="block min-h-4 text-[11px] text-neutral-400">
          {showCounts && <SectorCounts topic={topic} />}
        </span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-neutral-300 transition duration-300 group-hover:translate-x-0.5 group-hover:text-neutral-700"
        aria-hidden
      />
    </button>
  );
}

function SectorCounts({ topic }: { topic: TopicKey }) {
  const { techTree, error } = useTechTree(topic);
  if (error) return <>Counts unavailable</>;
  if (!techTree) return <span className="animate-pulse">Loading…</span>;
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
