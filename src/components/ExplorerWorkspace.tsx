'use client';

import { useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import {
  CompanySummary,
  ExplorerSelection,
  ExplorerViewMode,
  UiNode,
} from '@/lib/types';
import { TopicKey } from '@/lib/topicConfig';
import { useTechTree } from '@/hooks/useTechTree';
import { useCompanyView } from '@/hooks/useCompanyView';
import TechTree from './TechTree';
import { CompanyExplorer } from './CompanyExplorer';
import { WorldExplorer } from './WorldExplorer';
import { ViewModeSelector } from './ViewModeSelector';
import { KnowledgeBaseSelector } from './KnowledgeBaseSelector';

interface ExplorerWorkspaceProps {
  topic: TopicKey;
  onTopicChange: (topic: TopicKey) => void;
}

export function ExplorerWorkspace({
  topic,
  onTopicChange,
}: ExplorerWorkspaceProps) {
  const { techTree } = useTechTree(topic);
  const companyView = useCompanyView(topic);
  const [viewMode, setViewMode] = useState<ExplorerViewMode>('technology');
  const [selection, setSelection] = useState<ExplorerSelection>();
  const [companyFocusNodeId, setCompanyFocusNodeId] = useState<string | null>(
    null,
  );
  const [technologyFocus, setTechnologyFocus] = useState<{
    id: string;
    requestKey: number;
  } | null>(null);

  const selectedEntityId = useMemo(() => {
    if (selection?.kind === 'company') return `company:${selection.company.id}`;
    if (selection?.kind === 'technology') {
      return `technology:${selection.node.id}`;
    }
    return undefined;
  }, [selection]);

  const handleTopicChange = (nextTopic: TopicKey) => {
    setSelection(undefined);
    setCompanyFocusNodeId(null);
    setTechnologyFocus(null);
    onTopicChange(nextTopic);
  };

  const showTechnology = (nodeId: string) => {
    const dataNode = techTree?.nodes.find((node) => node.id === nodeId);
    if (!dataNode) return;
    const node: UiNode = { ...dataNode, position: { x: 0, y: 0 } };
    setSelection({ kind: 'technology', node });
    setTechnologyFocus((current) => ({
      id: nodeId,
      requestKey: (current?.requestKey ?? 0) + 1,
    }));
    setViewMode('technology');
  };

  const showCompany = (company: CompanySummary) => {
    setSelection({ kind: 'company', company });
    setCompanyFocusNodeId(`company:${company.id}`);
    setViewMode('company');
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-100">
      <div
        className={`absolute bottom-4 z-[70] ${
          viewMode === 'technology'
            ? 'left-1/4 -translate-x-1/2'
            : 'right-4'
        }`}
      >
        <ViewModeSelector value={viewMode} onChange={setViewMode} />
      </div>

      {viewMode !== 'technology' && (
        <KnowledgeBaseSelector
          topic={topic}
          onTopicChange={handleTopicChange}
        />
      )}

      <div
        hidden={viewMode !== 'technology'}
        inert={viewMode !== 'technology'}
        aria-hidden={viewMode !== 'technology'}
        className="h-full w-full"
      >
        <ReactFlowProvider>
          <TechTree
            topic={topic}
            onTopicChange={handleTopicChange}
            requestedTechnologyId={technologyFocus?.id}
            technologyFocusRequestKey={technologyFocus?.requestKey}
          />
        </ReactFlowProvider>
      </div>

      <div
        hidden={viewMode !== 'company'}
        inert={viewMode !== 'company'}
        aria-hidden={viewMode !== 'company'}
        className="h-full w-full"
      >
        <ReactFlowProvider>
          <CompanyExplorer
            topic={topic}
            isActive={viewMode === 'company'}
            data={companyView.data}
            techTree={techTree}
            isLoading={companyView.isLoading}
            error={companyView.error}
            selectedEntityId={selectedEntityId}
            requestedFocusNodeId={companyFocusNodeId}
            onSelectTechnology={(node) => showTechnology(node.id)}
            onSelectCompany={(company) => {
              setSelection({ kind: 'company', company });
              setCompanyFocusNodeId(null);
            }}
          />
        </ReactFlowProvider>
      </div>

      <div
        hidden={viewMode !== 'world'}
        inert={viewMode !== 'world'}
        aria-hidden={viewMode !== 'world'}
        className="h-full w-full"
      >
        <WorldExplorer
          data={companyView.data}
          techTree={techTree}
          isLoading={companyView.isLoading}
          error={companyView.error}
          selectedCountryIso={
            selection?.kind === 'country' ? selection.countryIso : undefined
          }
          onSelectCountry={(countryIso, countryName, layer, companies) => {
            setSelection({
              kind: 'country',
              countryIso,
              countryName,
              layer,
              companies,
            });
          }}
          onClearCountry={() => {
            if (selection?.kind === 'country') setSelection(undefined);
          }}
          onShowCompany={showCompany}
          onShowTechnology={showTechnology}
        />
      </div>
    </div>
  );
}
