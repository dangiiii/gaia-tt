'use client';

import { useState } from 'react';
import { ArrowRight, GitBranch } from 'lucide-react';
import { TechnologyCatalogEntry } from '@/lib/technologyCatalog';
import { TopicKey } from '@/lib/topicConfig';
import { topicImageUrl } from '@/lib/smrImages';
import { Badge } from '@/components/ui/badge';
import { TrlMeter } from './TrlMeter';

interface TechnologyCardProps {
  entry: TechnologyCatalogEntry;
  topic: TopicKey;
  isLastViewed?: boolean;
  onSelect: (entry: TechnologyCatalogEntry) => void;
}

export function TechnologyCard({
  entry,
  topic,
  isLastViewed = false,
  onSelect,
}: TechnologyCardProps) {
  const coverImageId = entry.smr?.coverImageId;
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-white/60 bg-white/55 text-left shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 hover:border-blue-300/80 hover:bg-white/75 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      {coverImageId && !imageFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={topicImageUrl(topic, coverImageId)}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="aspect-[16/9] w-full bg-gray-100 object-cover"
        />
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.category && (
            <Badge variant="outline" className="font-medium text-gray-600">
              {entry.category}
            </Badge>
          )}
          {isLastViewed && (
            <Badge className="border-transparent bg-blue-100 text-blue-800 shadow-none hover:bg-blue-100">
              Last viewed
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold leading-snug text-gray-900">
            {entry.label}
          </h3>
          {entry.blurb && (
            <p className="line-clamp-3 text-sm text-gray-600">{entry.blurb}</p>
          )}
        </div>

        <TrlMeter trl={entry.trl} trlLabel={entry.trlLabel} className="mt-auto" />

        <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" aria-hidden />
            {entry.prerequisiteCount === 0
              ? 'No tracked prerequisites'
              : `${entry.prerequisiteCount} prerequisite${entry.prerequisiteCount === 1 ? '' : 's'}`}
          </span>
          <span className="flex items-center gap-1 font-medium text-blue-700 opacity-80 transition group-hover:opacity-100">
            Follow
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </button>
  );
}
