'use client';

import { useState } from 'react';
import { ArrowRight, GitBranch } from 'lucide-react';
import { TechnologyCatalogEntry } from '@/lib/technologyCatalog';
import { TopicKey } from '@/lib/topicConfig';
import { topicImageUrl } from '@/lib/smrImages';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { TrlMeter } from './TrlMeter';

interface TechnologyCardProps {
  entry: TechnologyCatalogEntry;
  topic: TopicKey;
  isLastViewed?: boolean;
  /** Compact row for the suggested shortlist; richer card when browsing all. */
  compact?: boolean;
  onSelect: (entry: TechnologyCatalogEntry) => void;
}

export function TechnologyCard({
  entry,
  topic,
  isLastViewed = false,
  compact = false,
  onSelect,
}: TechnologyCardProps) {
  const coverImageId = entry.smr?.coverImageId;
  const [imageFailed, setImageFailed] = useState(false);

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onSelect(entry)}
        className="choice-row group"
      >
        {coverImageId && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={topicImageUrl(topic, coverImageId)}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-11 w-11 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-[11px] font-semibold text-neutral-500">
            {entry.trl != null ? `T${entry.trl}` : '—'}
          </span>
        )}
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-neutral-900">
              {entry.label}
            </span>
            {isLastViewed && (
              <Badge className="h-5 border-transparent bg-sky-100 px-1.5 text-[10px] text-sky-800 shadow-none hover:bg-sky-100">
                Last viewed
              </Badge>
            )}
          </span>
          <span className="block truncate text-[12px] text-neutral-500">
            {[
              entry.category,
              entry.prerequisiteCount > 0
                ? `${entry.prerequisiteCount} steps`
                : null,
              entry.trlLabel,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-neutral-300 transition duration-300 group-hover:translate-x-0.5 group-hover:text-neutral-700"
          aria-hidden
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/65 text-left shadow-sm backdrop-blur-md',
        'transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20',
      )}
    >
      {coverImageId && !imageFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={topicImageUrl(topic, coverImageId)}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="aspect-[16/9] w-full bg-neutral-100 object-cover"
        />
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.category && (
            <Badge variant="outline" className="font-medium text-neutral-600">
              {entry.category}
            </Badge>
          )}
          {isLastViewed && (
            <Badge className="border-transparent bg-sky-100 text-sky-800 shadow-none hover:bg-sky-100">
              Last viewed
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-[15px] font-semibold leading-snug text-neutral-900">
            {entry.label}
          </h3>
          {entry.blurb && (
            <p className="line-clamp-2 text-[13px] text-neutral-500">
              {entry.blurb}
            </p>
          )}
        </div>

        <TrlMeter trl={entry.trl} trlLabel={entry.trlLabel} className="mt-auto" />

        <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-[12px] text-neutral-500">
          <span className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" aria-hidden />
            {entry.prerequisiteCount === 0
              ? 'No tracked prerequisites'
              : `${entry.prerequisiteCount} prerequisite${entry.prerequisiteCount === 1 ? '' : 's'}`}
          </span>
          <span className="flex items-center gap-1 font-medium text-neutral-800 opacity-70 transition group-hover:opacity-100">
            Follow
            <ArrowRight
              className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </button>
  );
}
