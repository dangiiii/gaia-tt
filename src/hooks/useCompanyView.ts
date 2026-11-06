'use client';

import { useEffect, useState } from 'react';
import { CompanyViewResponse } from '@/lib/types';
import { TopicKey } from '@/lib/topicConfig';

export function useCompanyView(topic: TopicKey) {
  const [data, setData] = useState<CompanyViewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCompanyView() {
      setIsLoading(true);
      setError(null);
      setData(null);

      try {
        const response = await fetch(
          `/investment-tech-tree/api/company-view?topic=${topic}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error('Failed to fetch company view data');
        }

        setData((await response.json()) as CompanyViewResponse);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to fetch company view data',
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadCompanyView();
    return () => controller.abort();
  }, [topic]);

  return { data, isLoading, error };
}
