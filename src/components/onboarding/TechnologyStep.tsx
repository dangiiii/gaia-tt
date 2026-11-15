'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Search } from 'lucide-react';
import { TOPICS, TopicKey } from '@/lib/topicConfig';
import { buildTechnologyCatalog } from '@/lib/technologyCatalog';
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

  const catalog = useMemo(
    () => (techTree ? buildTechnologyCatalog(techTree) : []),
    [techTree],
  );
  const categories = useMemo(() => {
    const unique = new Set(
      catalog.map((entry) => entry.category).filter((value): value is string => !!value),
    );
    return [ALL_CATEGORIES, ...[...unique].sort()];
  }, [catalog]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog
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
  }, [catalog, category, query]);

  const sectorLabel = TOPICS[topic].label;
  const clearFilters = () => {
    setQuery('');
    setCategory(ALL_CATEGORIES);
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-6 py-8 md:py-10">
      <header className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-3">
          <ArrowLeft aria-hidden />
          All sectors
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip to the full map
        </Button>
      </header>

      <div className="mt-6 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Step 2 of 2 · {sectorLabel}
        </p>
        <DialogTitle className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          Which {SECTOR_COPY[topic].pickerNoun} do you want to follow?
        </DialogTitle>
        <DialogDescription>
          Each card shows today&apos;s readiness and how many prerequisites sit
          on its path. Choosing one starts a guided walk through that path.
        </DialogDescription>
      </div>

      {error ? (
        <div className="mt-10 flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="flex items-center gap-2 font-medium text-red-800">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            We couldn&apos;t load the {sectorLabel} tech tree.
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
          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative md:w-80">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search technologies"
                aria-label="Search technologies"
                className="h-10 bg-white pl-9"
              />
            </div>
            {categories.length > 2 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
                {categories.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={category === option}
                    onClick={() => setCategory(option)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                      category === option
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500',
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="mt-4 text-sm text-gray-500" aria-live="polite">
            {isLoading
              ? 'Loading technologies…'
              : `${visible.length} of ${catalog.length} technologies`}
          </p>

          <div className="mt-3 grid gap-4 pb-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading &&
              Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="h-52 animate-pulse rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="h-4 w-20 rounded bg-gray-200" />
                  <div className="mt-4 h-5 w-3/4 rounded bg-gray-200" />
                  <div className="mt-2 h-4 w-full rounded bg-gray-100" />
                  <div className="mt-1 h-4 w-5/6 rounded bg-gray-100" />
                </div>
              ))}
            {visible.map((entry) => (
              <TechnologyCard
                key={entry.id}
                entry={entry}
                topic={topic}
                isLastViewed={entry.id === lastTechnologyId}
                onSelect={(selected) => onSelectTechnology(selected.id)}
              />
            ))}
          </div>

          {!isLoading && visible.length === 0 && (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-gray-300 p-6">
              <p className="text-gray-700">
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
  );
}
