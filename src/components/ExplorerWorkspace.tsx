'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import {
  CompanySummary,
  ExplorerSelection,
  ExplorerViewMode,
  UiNode,
} from '@/lib/types';
import { DEFAULT_TOPIC, TopicKey } from '@/lib/topicConfig';
import {
  OnboardingState,
  readOnboardingState,
  writeOnboardingState,
} from '@/lib/onboardingStorage';
import { isReactorNode } from '@/lib/reactorEntities';
import { useTechTree } from '@/hooks/useTechTree';
import { useCompanyView } from '@/hooks/useCompanyView';
import { useExplorerUrlState } from '@/hooks/useExplorerUrlState';
import TechTree from './TechTree';
import { CompanyExplorer } from './CompanyExplorer';
import { WorldExplorer } from './WorldExplorer';
import { ViewModeSelector } from './ViewModeSelector';
import { KnowledgeBaseSelector } from './KnowledgeBaseSelector';
import { LoadingSpinner } from './LoadingSpinner';
import {
  MOBILE_WARNING_DISMISSED_EVENT,
  isMobileWarningPending,
} from './MobileWarning';
import { WelcomeFlow, WelcomeStep } from './onboarding/WelcomeFlow';

/**
 * Reads persisted preferences before mounting the workspace so a returning
 * visitor's last topic is fetched directly instead of the default first.
 */
export function ExplorerWorkspace() {
  const [storedState, setStoredState] = useState<OnboardingState | null>(null);

  useEffect(() => {
    setStoredState(readOnboardingState());
  }, []);

  if (!storedState) {
    return (
      <div className="h-full w-full bg-gray-100">
        <LoadingSpinner />
      </div>
    );
  }

  return <ExplorerWorkspaceContent initialOnboarding={storedState} />;
}

interface ExplorerWorkspaceContentProps {
  initialOnboarding: OnboardingState;
}

function ExplorerWorkspaceContent({
  initialOnboarding,
}: ExplorerWorkspaceContentProps) {
  const { urlState, updateUrl } = useExplorerUrlState();
  const topic: TopicKey =
    urlState.topic ?? initialOnboarding.lastTopic ?? DEFAULT_TOPIC.id;
  const viewMode = urlState.view;

  const [companyDataRequested, setCompanyDataRequested] = useState(
    viewMode !== 'technology',
  );
  const { techTree } = useTechTree(topic);
  const companyView = useCompanyView(topic, {
    enabled: companyDataRequested || viewMode !== 'technology',
  });
  const [selection, setSelection] = useState<ExplorerSelection>();
  const [companyFocusNodeId, setCompanyFocusNodeId] = useState<string | null>(
    null,
  );
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [lastTechnologyId, setLastTechnologyId] = useState(
    initialOnboarding.lastTechnologyId,
  );
  // First bare visit only: shared links (focus, pathway, other views) open
  // directly on what was shared.
  const [welcomeStep, setWelcomeStep] = useState<WelcomeStep | null>(() =>
    !initialOnboarding.completedAt &&
    !urlState.pathway &&
    !urlState.focus &&
    urlState.view === 'technology'
      ? 'sector'
      : null,
  );
  const [welcomeSession, setWelcomeSession] = useState(0);
  // A modal dialog would block the mobile overlay's dismiss button.
  const [mobileWarningPending, setMobileWarningPending] = useState(
    isMobileWarningPending,
  );

  useEffect(() => {
    if (viewMode !== 'technology') setCompanyDataRequested(true);
  }, [viewMode]);

  useEffect(() => {
    writeOnboardingState({ lastTopic: topic });
  }, [topic]);

  // Deep-link: ?view=world&tech=smr:… opens the reactor entity panel.
  useEffect(() => {
    if (viewMode !== 'world' || !urlState.tech || !techTree) return;
    if (selection?.kind === 'reactor' && selection.nodeId === urlState.tech) {
      return;
    }
    const node = techTree.nodes.find((entry) => entry.id === urlState.tech);
    if (!node || !isReactorNode(node)) return;
    setSelection({
      kind: 'reactor',
      nodeId: node.id,
      label: node.data.label,
    });
  }, [viewMode, urlState.tech, techTree, selection]);

  useEffect(() => {
    const handleDismissed = () => setMobileWarningPending(false);
    window.addEventListener(MOBILE_WARNING_DISMISSED_EVENT, handleDismissed);
    return () =>
      window.removeEventListener(MOBILE_WARNING_DISMISSED_EVENT, handleDismissed);
  }, []);

  const openWelcome = useCallback((step: WelcomeStep) => {
    setWelcomeStep(step);
    setWelcomeSession((current) => current + 1);
  }, []);

  const openTechnologyPicker = useCallback(
    () => openWelcome('technology'),
    [openWelcome],
  );

  const handleWelcomeSkip = () => {
    writeOnboardingState({ completedAt: Date.now() });
    setWelcomeStep(null);
  };

  const handleChooseTechnology = (nextTopic: TopicKey, technologyId: string) => {
    writeOnboardingState({
      completedAt: Date.now(),
      lastTopic: nextTopic,
      lastTechnologyId: technologyId,
    });
    setLastTechnologyId(technologyId);
    setSelection(undefined);
    setCompanyFocusNodeId(null);
    setWelcomeStep(null);
    updateUrl({
      topic: nextTopic,
      view: 'technology',
      focus: null,
      pathway: technologyId,
      step: 0,
    });
  };

  const handlePathwayStepChange = useCallback(
    (step: number) => updateUrl({ step }),
    [updateUrl],
  );

  const handleExitPathway = useCallback(
    (focusNodeId?: string) => {
      setFocusRequestKey((current) => current + 1);
      updateUrl({ pathway: null, step: null, focus: focusNodeId ?? null });
    },
    [updateUrl],
  );

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
    updateUrl({ topic: nextTopic, focus: null, pathway: null, step: null });
  };

  const handleViewModeChange = (nextView: ExplorerViewMode) => {
    updateUrl({ view: nextView });
  };

  const handleFocusChange = useCallback(
    (nodeId: string | null) => updateUrl({ focus: nodeId }),
    [updateUrl],
  );

  const showTechnology = (nodeId: string) => {
    const dataNode = techTree?.nodes.find((node) => node.id === nodeId);
    if (!dataNode) return;
    const node: UiNode = { ...dataNode, position: { x: 0, y: 0 } };
    setSelection({ kind: 'technology', node });
    setFocusRequestKey((current) => current + 1);
    updateUrl({ view: 'technology', focus: nodeId, pathway: null, step: null });
  };

  const showCompany = (company: CompanySummary) => {
    setSelection({ kind: 'company', company });
    setCompanyFocusNodeId(`company:${company.id}`);
    updateUrl({ view: 'company', tech: null });
  };

  const showReactor = (nodeId: string, label: string) => {
    const fromCountry =
      selection?.kind === 'country'
        ? selection
        : selection?.kind === 'reactor' && selection.fromCountryIso
          ? {
              countryIso: selection.fromCountryIso,
              countryName: selection.fromCountryName ?? selection.fromCountryIso,
              layer: selection.fromLayer ?? ('headquarters' as const),
              companies: selection.fromCompanies ?? [],
            }
          : null;
    setSelection({
      kind: 'reactor',
      nodeId,
      label,
      ...(fromCountry
        ? {
            fromCountryIso: fromCountry.countryIso,
            fromCountryName: fromCountry.countryName,
            fromLayer: fromCountry.layer,
            fromCompanies: fromCountry.companies,
          }
        : {}),
    });
    updateUrl({ view: 'world', tech: nodeId });
  };

  const clearReactor = () => {
    if (selection?.kind !== 'reactor') return;
    setSelection(undefined);
    updateUrl({ tech: null });
  };

  const backFromReactor = () => {
    if (selection?.kind !== 'reactor' || !selection.fromCountryIso) {
      clearReactor();
      return;
    }
    setSelection({
      kind: 'country',
      countryIso: selection.fromCountryIso,
      countryName: selection.fromCountryName ?? selection.fromCountryIso,
      layer: selection.fromLayer ?? 'headquarters',
      companies: selection.fromCompanies ?? [],
    });
    updateUrl({ tech: null });
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
        <ViewModeSelector value={viewMode} onChange={handleViewModeChange} />
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
            requestedTechnologyId={urlState.focus ?? undefined}
            technologyFocusRequestKey={focusRequestKey}
            onFocusChange={handleFocusChange}
            pathwayTargetId={urlState.pathway}
            pathwayStep={urlState.step}
            onPathwayStepChange={handlePathwayStepChange}
            onExitPathway={handleExitPathway}
            onChooseTechnology={openTechnologyPicker}
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
          topic={topic}
          isLoading={companyView.isLoading}
          error={companyView.error}
          selectedCountryIso={
            selection?.kind === 'country'
              ? selection.countryIso
              : selection?.kind === 'reactor'
                ? selection.fromCountryIso
                : undefined
          }
          selectedReactor={
            selection?.kind === 'reactor'
              ? {
                  nodeId: selection.nodeId,
                  label: selection.label,
                  fromCountryName: selection.fromCountryName,
                }
              : null
          }
          onSelectCountry={(countryIso, countryName, layer, companies) => {
            setSelection({
              kind: 'country',
              countryIso,
              countryName,
              layer,
              companies,
            });
            updateUrl({ tech: null });
          }}
          onClearCountry={() => {
            if (
              selection?.kind === 'country' ||
              selection?.kind === 'reactor'
            ) {
              setSelection(undefined);
              updateUrl({ tech: null });
            }
          }}
          onShowReactor={showReactor}
          onClearReactor={clearReactor}
          onBackFromReactor={
            selection?.kind === 'reactor' && selection.fromCountryIso
              ? backFromReactor
              : undefined
          }
          onShowCompany={showCompany}
          onShowTechnology={showTechnology}
        />
      </div>

      {welcomeStep && !mobileWarningPending && (
        <WelcomeFlow
          key={welcomeSession}
          initialStep={welcomeStep}
          initialTopic={topic}
          lastTechnologyId={lastTechnologyId}
          onSkip={handleWelcomeSkip}
          onChooseTechnology={handleChooseTechnology}
        />
      )}
    </div>
  );
}
