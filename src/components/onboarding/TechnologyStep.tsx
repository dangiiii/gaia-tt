'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Search } from 'lucide-react';
import { TOPICS, TopicKey } from '@/lib/topicConfig';
import {
  buildTechnologyCatalog,
  suggestTechnologies,
} from '@/lib/technologyCatalog';
import { useTechTree } from '@/hooks/useTechTree';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SECTOR_COPY } from './sectors';
import { TechnologyCard } from './TechnologyCard';

interface TechnologyStepProps {
  topic: TopicKey;
  lastTechnologyId: string | null;
  onBack: () => void;
  onSkip: () => void;
  onSelectTechnology: (technologyId: string) => void;
}

const ALL_CATEGORIES = 'All';

export function TechnologyStep({
  topic,
  lastTechnologyId,
  onBack,
  onSkip,
  onSelectTechnology,
}: TechnologyStepProps) {
  const { techTree, isLoading, error, retry } = useTechTree(topic);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [browsingAll, setBrowsingAll] = useState(false);

  const catalog = useMemo(
    () => (techTree ? buildTechnologyCatalog(techTree) : []),
    [techTree],
  );
  const suggested = useMemo(
    () => suggestTechnologies(catalog, lastTechnologyId),
    [catalog, lastTechnologyId],
  );
  const categories = useMemo(() => {
    const unique = new Set(
      catalog.map((entry) => entry.category).filter((value): value is string => !!value),
    );
    return [ALL_CATEGORIES, ...[...unique].sort()];
  }, [catalog]);
  const visible = useMemo(() => {
    const source = browsingAll ? catalog : suggested;
    const needle = query.trim().toLowerCase();
    return source
      .filter((entry) => category === ALL_CATEGORIES || entry.category === category)
      .filter(
        (entry) =>
          !needle ||
          [entry.label, entry.category, entry.blurb].some((text) =>
            text?.toLowerCase().includes(needle),
          ),
      )
      .sort(
        (a, b) =>
          (a.category ?? '').localeCompare(b.category ?? '') ||
          a.label.localeCompare(b.label),
      );
  }, [browsingAll, catalog, suggested, category, query]);

  const sectorLabel = TOPICS[topic].label;
  const clearFilters = () => {
    setQuery('');
    setCategory(ALL_CATEGORIES);
  };

  return (
    <div className="animate-fade-rise flex max-h-[min(84vh,760px)] flex-col">
      <div className="shrink-0 px-5 pt-5 sm:px-7 sm:pt-7">
        <header className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 h-8 gap-1 text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-neutral-500 hover:text-neutral-900"
            onClick={onSkip}
          >
            Skip
          </Button>
        </header>

        <div className="mt-5 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            {sectorLabel}
          </p>
          <DialogTitle className="text-[1.55rem] font-semibold leading-tight tracking-tight text-neutral-900 sm:text-[1.75rem]">
            Pick one to follow
          </DialogTitle>
          <DialogDescription className="max-w-md text-[15px] leading-relaxed text-neutral-500">
            We&apos;ll walk the prerequisites for this{' '}
            {SECTOR_COPY[topic].pickerNoun} — one step at a time.
          </DialogDescription>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-7 sm:pb-7">
        {error ? (
          <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-red-200 bg-red-50/80 p-5">
            <p className="flex items-center gap-2 font-medium text-red-800">
              <AlertTriangle className="h-5 w-5" aria-hidden />
              Couldn&apos;t load {sectorLabel}
            </p>
            <p className="text-sm text-red-700">{error}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={retry}>
                Try again
              </Button>
              <Button size="sm" variant="outline" onClick={onBack}>
                Pick another sector
              </Button>
            </div>
          </div>
        ) : (
          <>
            {(browsingAll || catalog.length > suggested.length) && (
              <div className="mt-5 flex flex-col gap-3">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      if (event.target.value.trim()) setBrowsingAll(true);
                    }}
                    placeholder={
                      browsingAll ? 'Search all technologies' : 'Search suggestions'
                    }
                    aria-label="Search technologies"
                    className="h-11 rounded-xl border-neutral-200/80 bg-white/70 pl-10"
                  />
                </div>
                {browsingAll && categories.length > 2 && (
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label="Filter by category"
                  >
                    {categories.map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={category === option}
                        onClick={() => setCategory(option)}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20',
                          category === option
                            ? 'bg-neutral-900 text-white'
                            : 'bg-white/60 text-neutral-600 hover:bg-white',
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-[12px] font-medium text-neutral-400" aria-live="polite">
                {isLoading
                  ? 'Loading…'
                  : browsingAll
                    ? `${visible.length} technologies`
                    : 'Suggested for you'}
              </p>
              {!isLoading && catalog.length > suggested.length && (
                <button
                  type="button"
                  className="text-[12px] font-medium text-neutral-700 underline-offset-2 hover:underline"
                  onClick={() => {
                    setBrowsingAll((current) => !current);
                    if (browsingAll) clearFilters();
                  }}
                >
                  {browsingAll ? 'Show suggestions' : `Browse all (${catalog.length})`}
                </button>
              )}
            </div>

            <div
              className={cn(
                'mt-3 gap-2.5',
                browsingAll
                  ? 'grid sm:grid-cols-2'
                  : 'flex flex-col',
              )}
            >
              {isLoading &&
                Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className="h-[4.5rem] animate-pulse rounded-2xl bg-white/50"
                  />
                ))}
              {visible.map((entry, index) => (
                <div
                  key={entry.id}
                  className="animate-fade-rise"
                  style={{
                    animationDelay: `${40 + index * 40}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  <TechnologyCard
                    entry={entry}
                    topic={topic}
                    compact={!browsingAll}
                    isLastViewed={entry.id === lastTechnologyId}
                    onSelect={(selected) => onSelectTechnology(selected.id)}
                  />
                </div>
              ))}
            </div>

            {!isLoading && visible.length === 0 && (
              <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-neutral-200 p-5">
                <p className="text-sm text-neutral-700">
                  {catalog.length === 0
                    ? `No deployment concepts are recorded for ${sectorLabel} yet.`
                    : 'No technologies match your filters.'}
                </p>
                {catalog.length > 0 && (
                  <Button size="sm" variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
