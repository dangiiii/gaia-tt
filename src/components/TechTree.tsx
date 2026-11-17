'use client';

import {
  EdgeWeightData,
  LayoutResult,
  edgeMarker,
  edgeStrokeWidth,
  layoutProjection,
  nodeShadow,
  selectVisibleTree,
} from '@/lib/elkjs';
import { HighlightedElements, UiNode, GroupingMode, CompanyInfo, CompanyNodeData, KgEntity, KgExpandResponse, KgPaperDossier, LiteratureNodeData, TechTree as TechTreeData } from '@/lib/types';
import { TopicKey } from '@/lib/topicConfig';
import {
  AggregationMode,
  TreeProjection,
  aggregateNodeId,
  groupFrameId,
  groupKeysOf,
  projectTree,
} from '@/lib/treeProjection';
import { Bounds, minZoomForBounds } from '@/lib/canvasZoom';
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MarkerType,
  ReactFlow,
  XYPosition,
  getViewportForBounds,
  useReactFlow,
  useStore,
} from '@xyflow/react';
import React, { useCallback, useEffect, useLayoutEffect, useState, useMemo, useRef } from 'react';
import { Legend } from './Legend';
import { LoadingSpinner } from './LoadingSpinner';
import { GroupSelector } from './GroupSelector';
import { KnowledgeBaseSelector } from './KnowledgeBaseSelector';
import { MoreCompaniesNodeData } from './MoreCompaniesNode';
import { TECH_TREE_NODE_TYPES } from './techTreeNodeTypes';
import {
  TechTreeNodeActions,
  TechTreeNodeActionsContext,
} from './techTreeNodeActions';
import { ZoomDetailLevelSync } from './ZoomDetailLevelSync';
import { TreeComparison, ComparisonMode } from './TreeComparison';
import { useCanvasWheel } from '@/hooks/useCanvasWheel';
import PaperDetails from './PaperDetails';
import LiteratureReview from './LiteratureReview';
import { VoteCounts, fetchVotes, optimisticVote } from '@/lib/votes';
import TabPanel from './TabPanel';
import EditInterface from './EditInterface';
import { useTechTree } from '@/hooks/useTechTree';
import { setAdminPassword, verifyAdminPassword } from '@/lib/adminClient';
import { DEFAULT_MIN_RELEVANCE, filterSmrTechTree, isSmrTree } from '@/lib/smrFilters';
import { pathwaySourceTree } from '@/lib/technologyCatalog';
import { usePathwayMode } from '@/hooks/usePathwayMode';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { PathwayGuide } from './pathway/PathwayGuide';

// Suppress hydration warnings for Radix UI
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Hydration failed') &&
      args[0].includes('aria-controls')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

interface TechTreeProps {
  topic: TopicKey;
  onTopicChange: (value: TopicKey) => void;
  requestedTechnologyId?: string;
  technologyFocusRequestKey?: number;
  /** Reports the node shown in the details panel so it can be shared. */
  onFocusChange?: (nodeId: string | null) => void;
  /** Target of the guided pathway, from the URL. */
  pathwayTargetId?: string | null;
  pathwayStep?: number;
  onPathwayStepChange?: (step: number) => void;
  /** Leaves the pathway, optionally focusing a node in the full map. */
  onExitPathway?: (focusNodeId?: string) => void;
  /** Opens the technology picker. */
  onChooseTechnology?: () => void;
  /** Side-panel tab from the URL (`panel=`). */
  panel?: 'details' | 'chat' | 'simulations' | null;
  onPanelChange?: (panel: 'details' | 'chat' | 'simulations') => void;
}

const FIT_VIEW_OPTIONS = { padding: 0.5, maxZoom: 1.25 };

const EMPTY_HIGHLIGHTS: HighlightedElements = {
  nodeIds: new Set(),
  edgeIds: new Set(),
};

const EMPTY_IDS: ReadonlySet<string> = new Set();

/** What a layout is computed from; identity changes mark it stale. */
interface LayoutInput {
  /** Tree the layout came from, so a new topic never shows the old one. */
  source: TechTreeData;
  /** Filtered tree before aggregation and folding. */
  visibleTree: TechTreeData;
  projection: TreeProjection;
  isPathway: boolean;
  /** Node the connected-nodes view is centred on. */
  anchorNodeId: string | null;
  showFoldControls: boolean;
}

/**
 * Keeps a folded or unfolded element where it was on screen after the
 * relayout, so toggling never throws the reader somewhere else.
 */
interface CameraAnchor {
  /** Id the element has after the relayout (aggregate ↔ frame). */
  targetId: string;
  /** Screen position of the element's top-left corner before the toggle. */
  screen: XYPosition;
  zoom: number;
}

function toggled(set: ReadonlySet<string>, id: string, on: boolean) {
  if (set.has(id) === on) return set;
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

function areSetsEqual(left: Set<string>, right: Set<string>): boolean {
  return (
    left.size === right.size &&
    [...left].every((value) => right.has(value))
  );
}

const TechTree: React.FC<TechTreeProps> = ({
  topic,
  onTopicChange,
  requestedTechnologyId,
  technologyFocusRequestKey,
  onFocusChange,
  pathwayTargetId,
  pathwayStep = 0,
  onPathwayStepChange,
  onExitPathway,
  onChooseTechnology,
  panel = null,
  onPanelChange,
}) => {
  const {
    techTree,
    isLoading: isLoadingData,
    error,
    retry: retryTechTree,
  } = useTechTree(topic);
  const [nodes, setNodes] = useState<UiNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const layoutedNodesRef = useRef<UiNode[]>([]);
  const layoutedEdgesRef = useRef<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<UiNode | undefined>(undefined);
  const [highlightedElements, setHighlightedElements] = useState<HighlightedElements>({
    nodeIds: new Set(),
    edgeIds: new Set(),
  });
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('None');
  const [showingRelatedNodes, setShowingRelatedNodes] = useState<string | null>(null);
  const [showOnlyConnected, setShowOnlyConnected] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  // Company overlay state
  const [companyNodes, setCompanyNodes] = useState<UiNode[]>([]);
  const [companyEdges, setCompanyEdges] = useState<Edge[]>([]);
  const [expandedCompanyNodeIds, setExpandedCompanyNodeIds] = useState<Set<string>>(new Set());

  // Literature (KG) overlay state
  const [literatureNodes, setLiteratureNodes] = useState<UiNode[]>([]);
  const [literatureEdges, setLiteratureEdges] = useState<Edge[]>([]);
  const [expandedLiteratureNodeIds, setExpandedLiteratureNodeIds] = useState<Set<string>>(new Set());
  const [paperDossier, setPaperDossier] = useState<KgPaperDossier | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [showLitEdgeLabels, setShowLitEdgeLabels] = useState(false);
  const [litVotes, setLitVotes] = useState<Map<string, VoteCounts>>(new Map());
  // 'overview': lit nodes on top of the full tree; 'focused': only parent + lit nodes
  const [litViewMode, setLitViewMode] = useState<'overview' | 'focused'>('overview');
  // nodeId -> {papers, weakMatch} for nodes that actually have KG enrichment
  const [enrichedNodes, setEnrichedNodes] = useState<Map<string, { papers: number; weakMatch: boolean }>>(new Map());
 
  // Category filtering state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Scaling the tree down: aggregate groups, unfold some, fold branches.
  const [aggregationMode, setAggregationMode] = useState<AggregationMode>('none');
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const [foldedNodeIds, setFoldedNodeIds] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const [isComparing, setIsComparing] = useState(false);

  // SMR-style trees (large, relevance-rated, provenance-tagged edges)
  const smrTree = useMemo(() => isSmrTree(techTree), [techTree]);
  const [minRelevance, setMinRelevance] = useState<number>(DEFAULT_MIN_RELEVANCE);
  const [sourceBackedOnly, setSourceBackedOnly] = useState<boolean>(false);
  const revealedFocusKeyRef = useRef<number | undefined>(undefined);
  const revealedHiddenFocusRef = useRef<string | null>(null);
  const appliedFocusRef = useRef<string | null>(null);
  const smrFilteredTree = useMemo(
    () =>
      techTree && smrTree
        ? filterSmrTechTree(techTree, {
            minRelevance,
            sourceBackedOnly,
            category: selectedCategory,
          })
        : null,
    [techTree, smrTree, minRelevance, sourceBackedOnly, selectedCategory],
  );

  // Guided pathway (URL-driven). It ignores category, search and grouping
  // but respects the SMR detail threshold.
  const pathwaySource = useMemo(() => {
    if (!techTree || !pathwayTargetId) return null;
    return smrTree ? pathwaySourceTree(techTree, minRelevance) : techTree;
  }, [techTree, pathwayTargetId, smrTree, minRelevance]);
  const pathwayMode = usePathwayMode({
    sourceTree: pathwaySource,
    targetId: pathwayTargetId,
    step: pathwayStep,
  });
  const pathwayActive = pathwayMode !== null;
  const pathwayTree = pathwayMode?.pathwayTree ?? null;
  const currentPathwayStep = pathwayMode?.currentStep ?? null;
  const emptyPathwayTargetId =
    pathwayMode && !pathwayTree ? pathwayMode.pathway.targetId : null;
  const nodeById = useMemo(
    () => new Map((techTree?.nodes ?? []).map((node) => [node.id, node])),
    [techTree],
  );

  // Switching topics invalidates node-specific view state.
  const previousTopicRef = useRef(topic);
  useEffect(() => {
    if (previousTopicRef.current === topic) return;
    previousTopicRef.current = topic;
    setSelectedNode(undefined);
    setShowingRelatedNodes(null);
    setShowOnlyConnected(false);
    setSearchInput('');
    setSearchTerm('');
    setSelectedCategory('All');
    setHighlightedElements(EMPTY_HIGHLIGHTS);
    // Group keys and node ids belong to the old tree; the mode carries over.
    setExpandedGroups(EMPTY_IDS);
    setFoldedNodeIds(EMPTY_IDS);
  }, [topic]);

  // Refs to imperatively switch TabPanel tabs / sub-views
  const showNodeDetailsTabRef = useRef<(() => void) | null>(null);
  const showCompaniesSubViewRef = useRef<(() => void) | null>(null);
  const showChatTabRef = useRef<(() => void) | null>(null);

  const MAX_VISIBLE_COMPANIES = 5;
  
  const { fitView, getNodesBounds, setViewport, getViewport } = useReactFlow();

  // Extract unique categories from nodes
  const uniqueCategories = useMemo(() => {
    if (!techTree) return [];
    const categories = new Set<string>();
    categories.add('All');
    techTree.nodes.forEach(node => {
      if (node.data.category) {
        categories.add(node.data.category);
      }
    });
    return Array.from(categories).sort();
  }, [techTree]);

  const handleEnterEditMode = async () => {
    const password = prompt('Please enter the admin password:');
    if (password === null) return;
    if (await verifyAdminPassword(password)) {
      setAdminPassword(password);
      setIsEditing(true);
    } else {
      alert('Incorrect password.');
    }
  };

  const handleExitEditMode = () => {
    if (window.confirm('Are you sure you want to exit edit mode? Any unsaved changes will be lost.')) {
      setIsEditing(false);
    }
  };

  const handleOpenReview = async () => {
    const password = prompt('Please enter the admin password:');
    if (password === null) return;
    if (await verifyAdminPassword(password)) {
      setAdminPassword(password);
      setShowReview(true);
    } else {
      alert('Incorrect password.');
    }
  };

  // Function to find connected nodes and edges
  const findConnectedElements = useCallback(
    (nodeId: string, allEdges: Edge[]) => {
      const connectedNodeIds = new Set<string>();
      const connectedEdgeIds = new Set<string>();

      connectedNodeIds.add(nodeId);

      allEdges.forEach((edge) => {
        if (edge.source === nodeId || edge.target === nodeId) {
          connectedEdgeIds.add(edge.id);
          if (edge.source === nodeId) {
            connectedNodeIds.add(edge.target);
          }
          if (edge.target === nodeId) {
            connectedNodeIds.add(edge.source);
          }
        }
      });

      return { nodeIds: connectedNodeIds, edgeIds: connectedEdgeIds };
    },
    [],
  );

  useEffect(() => {
    setSearchTerm(searchInput);
  }, [searchInput, searchTerm]);

  // Fetch which nodes have KG literature (icon gating), once per topic.
  const refreshEnrichedNodes = useCallback(() => {
    fetch(`/investment-tech-tree/api/kg?topic=${topic}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.enrichedNodes) return;
        setEnrichedNodes(
          new Map(
            d.enrichedNodes.map((n: { nodeId: string; papers: number; weakMatch: boolean }) => [
              n.nodeId,
              { papers: n.papers, weakMatch: n.weakMatch },
            ]),
          ),
        );
      })
      .catch(() => {});
  }, [topic]);

  useEffect(() => {
    refreshEnrichedNodes();
  }, [refreshEnrichedNodes]);

  // Smoothly refit when entering or leaving focused literature mode.
  const litFocused =
    litViewMode === 'focused' && expandedLiteratureNodeIds.size > 0;
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    fitView({ duration: reducedMotion ? 0 : 400, padding: 0.35 });
  }, [litFocused, fitView, reducedMotion]);

  // Everything the ELK layout depends on. A pathway replaces the filtered
  // tree with its own subgraph; identity changes mark the layout as stale.
  const layoutInput = useMemo((): LayoutInput | null => {
    if (!techTree) return null;
    if (pathwayTree) {
      return {
        source: techTree,
        visibleTree: pathwayTree,
        projection: projectTree(pathwayTree),
        isPathway: true,
        anchorNodeId: null,
        showFoldControls: false,
      };
    }

    let tree = smrFilteredTree ?? techTree;
    if (!smrFilteredTree && selectedCategory !== 'All') {
      const inCategory = new Set(
        techTree.nodes
          .filter((node) => node.data.category === selectedCategory)
          .map((node) => node.id),
      );
      tree = {
        nodes: techTree.nodes.filter((node) => inCategory.has(node.id)),
        edges: techTree.edges.filter(
          (edge) => inCategory.has(edge.source) && inCategory.has(edge.target),
        ),
      };
    }
    const visibleTree = selectVisibleTree(
      groupingMode,
      showingRelatedNodes,
      showOnlyConnected,
      searchTerm,
      tree,
    );
    // The connected-nodes view is already small and centred on one node, so
    // it is never aggregated or folded.
    const transformable = !showingRelatedNodes;
    return {
      source: techTree,
      visibleTree,
      projection: projectTree(
        visibleTree,
        transformable
          ? { mode: aggregationMode, expandedGroups, foldedNodeIds }
          : {},
      ),
      isPathway: false,
      anchorNodeId: showingRelatedNodes,
      showFoldControls: transformable,
    };
  }, [
    techTree,
    pathwayTree,
    smrFilteredTree,
    selectedCategory,
    groupingMode,
    showingRelatedNodes,
    showOnlyConnected,
    searchTerm,
    aggregationMode,
    expandedGroups,
    foldedNodeIds,
  ]);
  const [layoutedInput, setLayoutedInput] = useState<LayoutInput | null>(null);
  const isLayoutReady = layoutInput !== null && layoutedInput === layoutInput;
  // Keep the previous graph on screen while a relayout of the same tree
  // runs (folding, filters); only a new tree shows the spinner.
  const hasLayout = layoutedInput !== null && layoutedInput.source === techTree;
  // Pathway layouts are framed by the step camera instead of React Flow's
  // automatic fit, so the two never race.
  const autoFit = !layoutInput?.isPathway;

  // Zoom-out limit: far enough to see the whole tree, however large.
  const [layoutBounds, setLayoutBounds] = useState<Bounds | null>(null);
  const canvasWidth = useStore((state) => state.width);
  const canvasHeight = useStore((state) => state.height);
  const minZoom = useMemo(
    () => minZoomForBounds(layoutBounds, canvasWidth, canvasHeight),
    [layoutBounds, canvasWidth, canvasHeight],
  );
  const fitViewOptions = useMemo(
    () => ({ ...FIT_VIEW_OPTIONS, minZoom }),
    [minZoom],
  );

  const groupKeys = useMemo(
    () =>
      layoutInput && !layoutInput.isPathway && !layoutInput.anchorNodeId
        ? groupKeysOf(layoutInput.visibleTree, aggregationMode)
        : [],
    [layoutInput, aggregationMode],
  );
  const foldedBranchCount = useMemo(
    () =>
      layoutInput?.projection.nodes.filter(
        (node) => node.kind === 'node' && node.foldedCount > 0,
      ).length ?? 0,
    [layoutInput],
  );

  // Clear company overlay whenever the ELK layout is about to regenerate
  // so company nodes don't linger at stale positions.
  useEffect(() => {
    setCompanyNodes([]);
    setCompanyEdges([]);
    setExpandedCompanyNodeIds(new Set());
    setLiteratureNodes([]);
    setLiteratureEdges([]);
    setExpandedLiteratureNodeIds(new Set());
  }, [layoutInput]);

  // Set by a fold/unfold just before the relayout it causes.
  const pendingAnchorRef = useRef<CameraAnchor | null>(null);
  // How to frame a finished layout; consumed once the canvas can move.
  const cameraRequestRef = useRef<{
    layout: LayoutInput;
    anchor: CameraAnchor | null;
  } | null>(null);
  const layoutResultRef = useRef<LayoutResult | null>(null);

  useEffect(() => {
    if (!layoutInput) return;
    // ELK is async: a slower, older layout must not overwrite a newer one.
    let cancelled = false;

    const loadLayout = async () => {
      const result = await layoutProjection(layoutInput.projection, {
        anchorNodeId: layoutInput.anchorNodeId,
        showFoldControls: layoutInput.showFoldControls,
      });
      if (cancelled) return;
      layoutResultRef.current = result;
      layoutedNodesRef.current = result.layoutedNodes;
      layoutedEdgesRef.current = result.layoutedEdges;
      setNodes(() => result.layoutedNodes);
      setEdges(() => result.layoutedEdges);
      setLayoutBounds(result.bounds);
      setLayoutedInput(layoutInput);
      cameraRequestRef.current = {
        layout: layoutInput,
        anchor: pendingAnchorRef.current,
      };
      pendingAnchorRef.current = null;
    };

    loadLayout();
    return () => {
      cancelled = true;
    };
  }, [layoutInput]);

  const isPanZoomReady = useStore((state) => state.panZoom !== null);

  // Frame each new layout once it is on screen: a fold keeps the toggled
  // element in place, anything else shows the whole tree. Runs before paint
  // so the new layout never flashes at the old camera.
  useLayoutEffect(() => {
    const request = cameraRequestRef.current;
    if (
      !request ||
      request.layout !== layoutedInput ||
      !isPanZoomReady ||
      !canvasWidth ||
      !canvasHeight
    ) {
      return;
    }
    cameraRequestRef.current = null;
    if (request.layout.isPathway) return;
    if (request.anchor) {
      const { targetId, screen, zoom: previousZoom } = request.anchor;
      const position = layoutResultRef.current?.absolutePositions.get(targetId);
      if (position) {
        const zoom = Math.max(previousZoom, minZoom);
        setViewport({
          x: screen.x - position.x * zoom,
          y: screen.y - position.y * zoom,
          zoom,
        });
      }
      return;
    }
    fitView(fitViewOptions);
  }, [
    layoutedInput,
    isPanZoomReady,
    canvasWidth,
    canvasHeight,
    minZoom,
    fitView,
    fitViewOptions,
    setViewport,
  ]);

  const dimOthers = currentPathwayStep?.dimOthers ?? false;
  // The "show connected" anchor is styled by the layout itself; keep it.
  const layoutAnchorId = layoutedInput?.anchorNodeId ?? null;

  // Update node and edge styles based on highlighted elements. Also re-runs
  // after every layout, which replaces the styled nodes.
  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        // Frames are backdrops; they keep their own look.
        if (node.type === 'groupFrame') return node;
        const isHighlighted =
          highlightedElements.nodeIds.has(node.id) || node.id === layoutAnchorId;
        return {
          ...node,
          style: {
            ...node.style,
            borderWidth: isHighlighted ? '3px' : '1px',
            boxShadow: nodeShadow(node, isHighlighted),
            fontWeight: isHighlighted ? 'bold' : 'normal',
            opacity: dimOthers && !isHighlighted ? 0.25 : 1,
            transition: 'opacity 300ms ease',
          },
        };
      }),
    );

    setEdges((currentEdges) =>
      currentEdges.map((edge) => {
        const isHighlighted = highlightedElements.edgeIds.has(edge.id);
        // Aggregated edges are drawn thicker by how many links they carry.
        const weight = (edge.data as EdgeWeightData | undefined)?.weight ?? 1;
        const baseWidth = edgeStrokeWidth(weight);
        const color = isHighlighted ? '#f97316' : '#374151';
        return {
          ...edge,
          style: {
            ...edge.style,
            strokeWidth: isHighlighted ? baseWidth + 2 : baseWidth,
            stroke: color,
            opacity: dimOthers && !isHighlighted ? 0.2 : 1,
            transition: 'opacity 300ms ease',
          },
          markerEnd: edgeMarker(color, weight),
        };
      }),
    );
  }, [highlightedElements, dimOthers, layoutAnchorId, layoutedInput]);

  const handleShowCompanies = useCallback(
    async (nodeId: string) => {
      if (expandedCompanyNodeIds.has(nodeId)) {
        // Toggle off
        setCompanyNodes((prev) =>
          prev.filter((n) => {
            const d = n.data as unknown as CompanyNodeData | MoreCompaniesNodeData;
            return d.parentNodeId !== nodeId;
          }),
        );
        setCompanyEdges((prev) =>
          prev.filter((e) => !e.id.startsWith(`company-edge-${nodeId}-`)),
        );
        setExpandedCompanyNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        return;
      }

      // Collapse any previously expanded company nodes before showing new ones
      setCompanyNodes([]);
      setCompanyEdges([]);
      setExpandedCompanyNodeIds(new Set());
      
      // update selected node and highlights when expanding a new node
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (targetNode) {
        setSelectedNode(() => ({ ...targetNode }));
        const connected = findConnectedElements(nodeId, edges);
        setHighlightedElements(connected);
      }

      try {
        const res = await fetch(`/investment-tech-tree/api/companies?nodeId=${encodeURIComponent(nodeId)}&topic=${topic}`);
        if (!res.ok) return;
        const data = await res.json();
        const allCompanies: CompanyInfo[] = data.companies ?? [];
        if (!allCompanies.length) return;

        const parentNode = nodes.find((n) => n.id === nodeId);
        if (!parentNode) return;
        // Members of an unfolded group are positioned inside its frame.
        const parentPosition =
          layoutResultRef.current?.absolutePositions.get(nodeId) ??
          parentNode.position;

        const visibleCompanies = allCompanies.slice(0, MAX_VISIBLE_COMPANIES);
        const remainingCount = allCompanies.length - visibleCompanies.length;

        const companyWidth = 140;
        const companyHeight = 80;
        const companyGap = 10;
        const px = parentPosition.x - companyWidth - 30;
        const visibleCount = visibleCompanies.length + (remainingCount > 0 ? 1 : 0);
        const totalHeight = visibleCount * (companyHeight + companyGap) - companyGap;
        const startY = parentPosition.y + 40 - totalHeight / 2;

        const newCompanyNodes: UiNode[] = visibleCompanies.map((company, index) => ({
          id: `company-${company.id}`,
          type: 'company',
          position: { x: px, y: startY + index * (companyHeight + companyGap) },
          width: companyWidth,
          height: companyHeight,
          data: {
            label: company.canonical_name,
            nodeType: 'company',
            company,
            parentNodeId: nodeId,
          } as unknown as UiNode['data'],
          style: {
            background: '#ffffff',
            borderColor: company.is_primary ? '#ca8a04' : '#eab308',
            borderStyle: 'solid',
            borderWidth: company.is_primary ? '2px' : '1px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        }));

        if (remainingCount > 0) {
          const moreY = startY + visibleCompanies.length * (companyHeight + companyGap);
          newCompanyNodes.push({
            id: `more-companies-${nodeId}`,
            type: 'moreCompanies',
            position: { x: px, y: moreY },
            width: companyWidth,
            height: companyHeight,
            data: {
              label: `+${remainingCount} More Companies`,
              nodeType: 'moreCompanies',
              parentNodeId: nodeId,
            } as unknown as UiNode['data'],
            style: {
              background: '#f8fafc',
              borderColor: '#94a3b8',
              borderStyle: 'dashed',
              borderWidth: '2px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          });
        }

        const newCompanyEdges: Edge[] = visibleCompanies.map((company) => ({
          id: `company-edge-${nodeId}-${company.id}`,
          source: `company-${company.id}`,
          target: nodeId,
          style: { strokeWidth: 1, stroke: '#eab308', strokeDasharray: '4 2' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: '#eab308',
          },
        }));

        if (remainingCount > 0) {
          newCompanyEdges.push({
            id: `company-edge-${nodeId}-more`,
            source: `more-companies-${nodeId}`,
            target: nodeId,
            style: { strokeWidth: 1, stroke: '#94a3b8', strokeDasharray: '4 2' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color: '#94a3b8',
            },
          });
        }

        setCompanyNodes((prev) => [...prev, ...newCompanyNodes]);
        setCompanyEdges((prev) => [...prev, ...newCompanyEdges]);
        setExpandedCompanyNodeIds((prev) => new Set([...prev, nodeId]));
      } catch (err) {
        console.error('Error fetching companies:', err);
      }
    },
    [
      nodes,
      edges,
      topic,
      expandedCompanyNodeIds,
      MAX_VISIBLE_COMPANIES,
      findConnectedElements,
    ],
  );

  const handleShowLiterature = useCallback(
    async (nodeId: string) => {
      if (expandedLiteratureNodeIds.has(nodeId)) {
        // Toggle off
        setLiteratureNodes((prev) =>
          prev.filter(
            (n) => (n.data as unknown as LiteratureNodeData).parentNodeId !== nodeId,
          ),
        );
        setLiteratureEdges((prev) =>
          prev.filter((e) => !e.id.startsWith(`lit-edge-${nodeId}-`)),
        );
        setExpandedLiteratureNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        return;
      }

      // Collapse any previously expanded literature before showing new ones
      setLiteratureNodes([]);
      setLiteratureEdges([]);
      setExpandedLiteratureNodeIds(new Set());

      // update selected node and highlights when expanding a new node
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (targetNode) {
        setSelectedNode(() => ({ ...targetNode }));
        const connected = findConnectedElements(nodeId, edges);
        setHighlightedElements(connected);
      }

      try {
        const res = await fetch(
          `/investment-tech-tree/api/kg?nodeId=${encodeURIComponent(nodeId)}&topic=${topic}`,
        );
        if (!res.ok) return;
        const data: KgExpandResponse = await res.json();
        if (!data.entities?.length) return;

        const parentNode = nodes.find((n) => n.id === nodeId);
        if (!parentNode) return;
        const parentPosition =
          layoutResultRef.current?.absolutePositions.get(nodeId) ??
          parentNode.position;

        const litWidth = 160;
        const litHeight = 80;
        const litGap = 10;
        // Literature nodes render to the RIGHT of the parent (companies go left).
        const px = parentPosition.x + 150 + 30;
        const totalHeight =
          data.entities.length * (litHeight + litGap) - litGap;
        const startY = parentPosition.y + 40 - totalHeight / 2;

        const kindBorder: Record<string, string> = {
          paper: '#6366f1',
          device: '#14b8a6',
          finding: '#f59e0b',
        };

        const newLitNodes: UiNode[] = data.entities.map((entity, index) => ({
          id: `lit-${entity.id}`,
          type: 'literature',
          position: { x: px, y: startY + index * (litHeight + litGap) },
          width: litWidth,
          height: litHeight,
          data: {
            label:
              entity.kind === 'paper'
                ? (entity.paper?.title ?? entity.name)
                : entity.name,
            nodeType: 'literature',
            entity,
            parentNodeId: nodeId,
          } as unknown as UiNode['data'],
          style: {
            background: '#ffffff',
            borderColor: kindBorder[entity.kind] ?? '#94a3b8',
            borderStyle: 'solid',
            borderWidth: entity.kind === 'paper' ? '2px' : '1px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        }));

        const newLitEdges: Edge[] = data.entities.map((entity) => {
          const color = kindBorder[entity.kind] ?? '#94a3b8';
          return {
            id: `lit-edge-${nodeId}-${entity.id}`,
            source: `lit-${entity.id}`,
            target: nodeId,
            targetHandle: 'lit-target',
            label: entity.relation,
            labelStyle: { fontSize: 9, fill: color },
            labelBgStyle: { fill: '#ffffff', fillOpacity: 0.85 },
            style: { strokeWidth: 1, stroke: color, strokeDasharray: '4 2' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color,
            },
          };
        });

        setLiteratureNodes((prev) => [...prev, ...newLitNodes]);
        setLiteratureEdges((prev) => [...prev, ...newLitEdges]);
        setExpandedLiteratureNodeIds((prev) => new Set([...prev, nodeId]));
        // Fetch vote tallies for votable overlay entities (paper votes live in PaperDetails).
        fetchVotes(
          topic,
          data.entities.filter((e) => e.kind !== 'paper').map((e) => e.id),
        ).then((v) =>
          setLitVotes((prev) => new Map([...prev, ...Object.entries(v)])),
        );
      } catch (err) {
        console.error('Error fetching KG literature:', err);
      }
    },
    [nodes, edges, topic, expandedLiteratureNodeIds, findConnectedElements],
  );

  const handleLitVote = useCallback(
    async (targetId: string, vote: 'up' | 'down' | null) => {
      await optimisticVote(topic, targetId, vote, litVotes.get(targetId), (counts) =>
        setLitVotes((prev) => {
          const next = new Map(prev);
          if (counts) next.set(targetId, counts);
          else next.delete(targetId);
          return next;
        }),
      );
    },
    [topic, litVotes],
  );

  const handleShowPaper = useCallback(
    async (entity: KgEntity) => {
      const paperId = entity.paper?.paperId;
      if (!paperId) return;
      try {
        const res = await fetch(
          `/investment-tech-tree/api/kg/paper/${encodeURIComponent(paperId)}?topic=${topic}`,
        );
        if (!res.ok) return;
        setPaperDossier(await res.json());
      } catch (err) {
        console.error('Error fetching paper dossier:', err);
      }
    },
    [topic],
  );

  // Re-expand an open literature overlay after a curation verdict changed,
  // and refresh the icon-availability map.
  const handleVerdictChanged = useCallback(
    (nodeId: string) => {
      refreshEnrichedNodes();
      if (!expandedLiteratureNodeIds.has(nodeId)) return;
      setLiteratureNodes((prev) =>
        prev.filter(
          (n) => (n.data as unknown as LiteratureNodeData).parentNodeId !== nodeId,
        ),
      );
      setLiteratureEdges((prev) =>
        prev.filter((e) => !e.id.startsWith(`lit-edge-${nodeId}-`)),
      );
      setExpandedLiteratureNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      setTimeout(() => handleShowLiterature(nodeId), 0);
    },
    [expandedLiteratureNodeIds, refreshEnrichedNodes, handleShowLiterature],
  );

  const handleShowCompanyDetails = useCallback(
    (companyId: string) => {
      const companyNode = companyNodes.find(
        (n) => (n.data as unknown as CompanyNodeData).company?.id === companyId,
      );
      if (companyNode) {
        const parentNodeId = (companyNode.data as unknown as CompanyNodeData).parentNodeId;
        const parentNode = nodes.find((n) => n.id === parentNodeId);
        if (parentNode) {
          setSelectedNode(() => ({ ...parentNode }));
          const connected = findConnectedElements(parentNodeId, edges);
          setHighlightedElements(connected);
          // Ensure panel is expanded then switch to companies sub-view
          setIsPanelExpanded(true);
          if (showCompaniesSubViewRef.current) showCompaniesSubViewRef.current();
        }
      }
    },
    [companyNodes, nodes, edges, findConnectedElements],
  );

  const handleShowMoreCompanies = useCallback(
    (parentNodeId: string) => {
      const parentNode = nodes.find((n) => n.id === parentNodeId);
      if (parentNode) {
        const isSameNode = selectedNode?.id === parentNodeId;

        setSelectedNode(() => ({ ...parentNode }));
        const connected = findConnectedElements(parentNodeId, edges);
        setHighlightedElements(connected);

        // Always expand the panel
        setIsPanelExpanded(true);

        if (isSameNode) {
          // selectedNode.id won't change, so the TabPanel effect won't fire.
          // Call both refs directly: first switch to details tab, then set sub-view.
          if (showNodeDetailsTabRef.current) showNodeDetailsTabRef.current();
          if (showCompaniesSubViewRef.current) showCompaniesSubViewRef.current();
        } else {
          // selectedNode.id will change, TabPanel's useEffect will consume pendingSubViewRef.
          // Set pending before the state update propagates.
          if (showCompaniesSubViewRef.current) showCompaniesSubViewRef.current();
        }
      }
    },
    [nodes, edges, findConnectedElements, selectedNode],
  );

  const handleShowDetails = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNode(() => ({ ...node }));
        const connected = findConnectedElements(nodeId, edges);
        setHighlightedElements(connected);
        
        // Always switch to details tab when clicking node buttons
        if (showNodeDetailsTabRef.current) {
          showNodeDetailsTabRef.current();
        }

        // Auto-expand panel on mobile when node details are shown
        if (window.innerWidth < 768) {
          setIsPanelExpanded(true);
        }
        // The pathway step owns the URL while a pathway is active.
        if (!pathwayActive) onFocusChange?.(nodeId);
      }
    },
    [nodes, edges, findConnectedElements, onFocusChange, pathwayActive],
  );

  // Called from the simulation panel when a top-N row is clicked.
  // Highlights the node and its connections just like clicking the info button,
  // but does NOT switch the tab to "details".
  const handleSimulationNodeSelect = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNode(() => ({ ...node }));
        const connected = findConnectedElements(nodeId, edges);
        setHighlightedElements(connected);
      }
    },
    [nodes, edges, findConnectedElements],
  );

  const handleShowConnected = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        // The connected view needs the full tree, so it ends a pathway.
        if (pathwayActive) onExitPathway?.();
        setSelectedNode(() => ({ ...node }));
        setShowingRelatedNodes(nodeId);
        setShowOnlyConnected(true);
        setSearchInput('');
        setSearchTerm('');
        setHighlightedElements(EMPTY_HIGHLIGHTS);
        onFocusChange?.(null);
      }
    },
    [nodes, onFocusChange, pathwayActive, onExitPathway],
  );

  const handleExitPathway = useCallback(() => {
    const targetId = pathwayMode?.pathway.targetId;
    setShowingRelatedNodes(null);
    setShowOnlyConnected(false);
    setHighlightedElements(EMPTY_HIGHLIGHTS);
    onExitPathway?.(targetId);
  }, [pathwayMode, onExitPathway]);

  // Panel list only: the graph overlay sits left of the node, which in a
  // pathway layout is exactly where its prerequisites are.
  const handlePathwayShowCompanies = useCallback(() => {
    setIsPanelExpanded(true);
    showNodeDetailsTabRef.current?.();
    showCompaniesSubViewRef.current?.();
  }, []);

  const handlePathwayAskAssistant = useCallback(() => {
    setIsPanelExpanded(true);
    showChatTabRef.current?.();
  }, []);

  // Each step highlights its stage and moves the details panel along.
  useEffect(() => {
    if (!currentPathwayStep || !isLayoutReady) return;
    setHighlightedElements({
      nodeIds: new Set(currentPathwayStep.highlightNodeIds),
      edgeIds: new Set(currentPathwayStep.highlightEdgeIds),
    });
    const focusNode = layoutedNodesRef.current.find(
      (node) => node.id === currentPathwayStep.focusNodeId,
    );
    if (focusNode) {
      setSelectedNode((current) => (current?.id === focusNode.id ? current : focusNode));
    }
    showNodeDetailsTabRef.current?.();
  }, [currentPathwayStep, isLayoutReady]);

  // Frame the step, keeping it clear of the floating guide (bottom) and the
  // toolbars (top). The viewport is computed directly because the queued
  // `fitView({ nodes })` only resolves after a re-measure, which never comes
  // for this controlled graph once node styles change.
  const graphCanvasRef = useRef<HTMLDivElement | null>(null);
  const pathwayGuideRef = useRef<HTMLElement>(null);
  const framedLayoutRef = useRef<typeof layoutInput>(null);
  useEffect(() => {
    if (!currentPathwayStep || !isLayoutReady || !isPanZoomReady) return;
    const fitNodeIds = currentPathwayStep.fitNodeIds;
    if (fitNodeIds.length === 0) return;
    // Jump on a fresh layout (nothing to animate from); glide between steps.
    const duration =
      !reducedMotion && framedLayoutRef.current === layoutedInput ? 500 : 0;
    const frame = requestAnimationFrame(() => {
      framedLayoutRef.current = layoutedInput;
      const canvas = graphCanvasRef.current;
      if (!canvas) return;
      const { width, height } = canvas.getBoundingClientRect();
      const guideHeight = pathwayGuideRef.current?.offsetHeight ?? 0;
      const viewport = getViewportForBounds(
        getNodesBounds(fitNodeIds),
        width,
        height,
        minZoom,
        1.25,
        // Bare numbers are viewport ratios; pixel paddings need the unit.
        {
          top: '120px',
          bottom: `${guideHeight + 88}px`,
          left: '48px',
          right: '48px',
        },
      );
      setViewport(viewport, { duration });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    currentPathwayStep,
    isLayoutReady,
    isPanZoomReady,
    layoutedInput,
    getNodesBounds,
    setViewport,
    reducedMotion,
    minZoom,
  ]);

  // No prerequisites: fall back to the existing direct-connections view, and
  // undo it however the pathway ends (exit, new pathway, cross-view focus).
  const emptyFallbackTargetRef = useRef<string | null>(null);
  useEffect(() => {
    if (emptyPathwayTargetId) {
      emptyFallbackTargetRef.current = emptyPathwayTargetId;
      setShowingRelatedNodes(emptyPathwayTargetId);
      setShowOnlyConnected(true);
      setSearchInput('');
      setSearchTerm('');
      return;
    }
    const fallbackTarget = emptyFallbackTargetRef.current;
    if (!fallbackTarget) return;
    emptyFallbackTargetRef.current = null;
    setShowingRelatedNodes((current) => (current === fallbackTarget ? null : current));
  }, [emptyPathwayTargetId]);

  // An unknown pathway target (stale or mistyped link) falls back to the map.
  useEffect(() => {
    if (pathwayTargetId && techTree && !pathwayMode) onExitPathway?.();
  }, [pathwayTargetId, techTree, pathwayMode, onExitPathway]);

  // Remembers where the toggled element sits on screen so the relayout can
  // put it back there (see CameraAnchor).
  const captureAnchor = useCallback(
    (currentId: string, targetId: string) => {
      const position = layoutResultRef.current?.absolutePositions.get(currentId);
      if (!position) return;
      const { x, y, zoom } = getViewport();
      pendingAnchorRef.current = {
        targetId,
        screen: { x: position.x * zoom + x, y: position.y * zoom + y },
        zoom,
      };
    },
    [getViewport],
  );

  const handleToggleFold = useCallback(
    (nodeId: string) => {
      captureAnchor(nodeId, nodeId);
      setFoldedNodeIds((current) => toggled(current, nodeId, !current.has(nodeId)));
    },
    [captureAnchor],
  );

  const handleExpandGroup = useCallback(
    (groupKey: string, aggregateId: string) => {
      captureAnchor(aggregateId, groupFrameId(groupKey));
      setExpandedGroups((current) => toggled(current, groupKey, true));
    },
    [captureAnchor],
  );

  const handleCollapseGroup = useCallback(
    (groupKey: string, frameId: string) => {
      captureAnchor(frameId, aggregateNodeId(groupKey));
      setExpandedGroups((current) => toggled(current, groupKey, false));
    },
    [captureAnchor],
  );

  const handleAggregationModeChange = useCallback((mode: AggregationMode) => {
    setAggregationMode(mode);
    setExpandedGroups(EMPTY_IDS);
  }, []);

  const handleOpenComparedTopic = useCallback(
    (nextTopic: TopicKey, mode: ComparisonMode) => {
      setIsComparing(false);
      handleAggregationModeChange(mode);
      if (nextTopic !== topic) onTopicChange(nextTopic);
    },
    [handleAggregationModeChange, onTopicChange, topic],
  );

  const handleGroupingModeChange = useCallback(
    (mode: GroupingMode) => {
      setGroupingMode(mode);
      setSelectedNode(undefined);
      setShowingRelatedNodes(null);
      setShowOnlyConnected(false);
      setHighlightedElements({ nodeIds: new Set(), edgeIds: new Set() });
      onFocusChange?.(null);
    },
    [onFocusChange],
  );

  const handleReset = useCallback(() => {
    setSelectedNode(undefined);
    setShowingRelatedNodes(null);
    setShowOnlyConnected(false);
    setSearchInput('');
    setSearchTerm('');
    setSelectedCategory('All');
    setHighlightedElements({ nodeIds: new Set(), edgeIds: new Set() });
    onFocusChange?.(null);
  }, [onFocusChange]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      setSelectedNode(undefined);
      setShowingRelatedNodes(null);
      setShowOnlyConnected(false);
      setHighlightedElements({ nodeIds: new Set(), edgeIds: new Set() });
      onFocusChange?.(null);
    },
    [onFocusChange],
  );

  // Apply each focus request (URL `focus` + request key) once, after the
  // layout that contains the node is ready, so later relayouts don't keep
  // re-selecting it or re-opening the panel.
  useEffect(() => {
    if (!requestedTechnologyId) {
      appliedFocusRef.current = null;
      return;
    }
    if (!isLayoutReady || pathwayActive) return;
    const focusKey = `${requestedTechnologyId}:${technologyFocusRequestKey ?? 0}`;
    if (appliedFocusRef.current === focusKey) return;
    const node = layoutedNodesRef.current.find(
      (candidate) => candidate.id === requestedTechnologyId,
    );
    if (!node) {
      // Drawn inside an aggregate or a folded branch: open that up once per
      // focus request, then the next layout contains the node.
      const projection = layoutInput?.projection;
      const drawnAs = projection?.representative.get(requestedTechnologyId);
      if (projection && drawnAs && drawnAs !== requestedTechnologyId) {
        const revealKey = `${focusKey}>${drawnAs}`;
        if (revealedHiddenFocusRef.current === revealKey) return;
        revealedHiddenFocusRef.current = revealKey;
        const groupKey = projection.groupKeyOf.get(requestedTechnologyId);
        if (groupKey && drawnAs === aggregateNodeId(groupKey)) {
          setExpandedGroups((current) => toggled(current, groupKey, true));
        } else {
          setFoldedNodeIds((current) => toggled(current, drawnAs, false));
        }
        return;
      }
      // Hidden by the SMR detail threshold: lower it once per focus request
      // so the node gets laid out (without fighting later slider changes).
      const smr = techTree?.nodes.find((n) => n.id === requestedTechnologyId)?.data.smr;
      if (
        smr?.kind === 'technology' &&
        smr.relevance < minRelevance &&
        revealedFocusKeyRef.current !== technologyFocusRequestKey
      ) {
        revealedFocusKeyRef.current = technologyFocusRequestKey;
        setSelectedCategory('All');
        setMinRelevance(smr.relevance);
      }
      return;
    }

    appliedFocusRef.current = focusKey;
    setSelectedNode((current) => (current?.id === node.id ? current : node));
    const connected = findConnectedElements(
      node.id,
      layoutedEdgesRef.current,
    );
    setHighlightedElements((current) =>
      areSetsEqual(current.nodeIds, connected.nodeIds) &&
      areSetsEqual(current.edgeIds, connected.edgeIds)
        ? current
        : connected,
    );
    setIsPanelExpanded(true);
    showNodeDetailsTabRef.current?.();
  }, [
    requestedTechnologyId,
    technologyFocusRequestKey,
    isLayoutReady,
    pathwayActive,
    findConnectedElements,
    techTree,
    minRelevance,
    layoutInput,
  ]);

  const nodeActions = useMemo<TechTreeNodeActions>(
    () => ({
      onShowDetails: handleShowDetails,
      onShowConnected: handleShowConnected,
      onShowCompanies: handleShowCompanies,
      isCompaniesExpanded: (id) => expandedCompanyNodeIds.has(id),
      literatureFor: (id) => enrichedNodes.get(id),
      onShowLiterature: handleShowLiterature,
      isLiteratureExpanded: (id) => expandedLiteratureNodeIds.has(id),
      onShowPaper: handleShowPaper,
      votesFor: (id) => litVotes.get(id),
      onLitVote: handleLitVote,
      onShowCompanyDetails: handleShowCompanyDetails,
      onShowMoreCompanies: handleShowMoreCompanies,
      onToggleFold: handleToggleFold,
      onExpandGroup: handleExpandGroup,
      onCollapseGroup: handleCollapseGroup,
    }),
    [
      handleShowDetails,
      handleShowConnected,
      handleShowCompanies,
      expandedCompanyNodeIds,
      enrichedNodes,
      handleShowLiterature,
      expandedLiteratureNodeIds,
      handleShowPaper,
      litVotes,
      handleLitVote,
      handleShowCompanyDetails,
      handleShowMoreCompanies,
      handleToggleFold,
      handleExpandGroup,
      handleCollapseGroup,
    ],
  );

  // Stable arrays, so React Flow only re-diffs when something changed.
  const flowNodes = useMemo(
    () =>
      // Focused mode: show only the expanded node + its literature.
      litFocused
        ? [
            ...nodes.filter((n) => expandedLiteratureNodeIds.has(n.id)),
            ...literatureNodes,
          ]
        : [...nodes, ...companyNodes, ...literatureNodes],
    [litFocused, nodes, companyNodes, literatureNodes, expandedLiteratureNodeIds],
  );
  const flowEdges = useMemo(
    () =>
      (litFocused
        ? literatureEdges.filter((e) =>
            [...expandedLiteratureNodeIds].some((id) =>
              e.id.startsWith(`lit-edge-${id}-`),
            ),
          )
        : [...edges, ...companyEdges, ...literatureEdges]
      ).map((e) =>
        !showLitEdgeLabels && e.id.startsWith('lit-edge-')
          ? { ...e, label: undefined }
          : e,
      ),
    [
      litFocused,
      edges,
      companyEdges,
      literatureEdges,
      expandedLiteratureNodeIds,
      showLitEdgeLabels,
    ],
  );

  // The canvas mounts after the first layout, so track the element itself.
  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(null);
  const setGraphCanvas = useCallback((element: HTMLDivElement | null) => {
    graphCanvasRef.current = element;
    setCanvasElement(element);
  }, []);
  useCanvasWheel(canvasElement);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-100">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <h2 className="mb-4 text-2xl font-bold text-red-600">
            Error Loading Data
          </h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={retryTechTree}
            className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-100 flex">
      <div className={`relative transition-all duration-300 flex flex-col h-full ${
        isPanelExpanded 
          ? 'w-full md:w-2/4'
          : 'w-full'
      }`}>
        <GroupSelector
          currentMode={groupingMode}
          onModeChange={handleGroupingModeChange}
          selectedNode={selectedNode}
          showingConnectedNodes={showingRelatedNodes !== null}
          pathwayActive={pathwayActive}
          onExitPathway={handleExitPathway}
          onChooseTechnology={onChooseTechnology}
          onReset={handleReset}
          searchInput={searchInput}
          onSearchChange={handleSearchChange}
          onEnterEditMode={handleEnterEditMode}
          onOpenReview={handleOpenReview}
          isEditing={isEditing}
          hasLiterature={enrichedNodes.size > 0}
          litViewMode={litViewMode}
          onLitViewModeChange={setLitViewMode}
          showLitEdgeLabels={showLitEdgeLabels}
          onToggleLitEdgeLabels={setShowLitEdgeLabels}
          showLegend={showLegend}
          showOptions={showOptions}
          onToggleLegend={() => setShowLegend(!showLegend)}
          onToggleOptions={() => setShowOptions(!showOptions)}
          selectedCategory={selectedCategory}
          categories={uniqueCategories}
          onCategoryChange={setSelectedCategory}
          aggregationMode={aggregationMode}
          onAggregationModeChange={handleAggregationModeChange}
          groupCount={groupKeys.length}
          expandedGroupCount={
            groupKeys.filter((key) => expandedGroups.has(key)).length
          }
          onUnfoldAllGroups={() => setExpandedGroups(new Set(groupKeys))}
          onFoldAllGroups={() => setExpandedGroups(EMPTY_IDS)}
          foldedBranchCount={foldedBranchCount}
          onUnfoldAllBranches={() => setFoldedNodeIds(EMPTY_IDS)}
          onCompareTrees={() => setIsComparing(true)}
          {...(smrTree
            ? {
                minRelevance,
                onMinRelevanceChange: setMinRelevance,
                visibleNodeCount: smrFilteredTree?.nodes.length,
                sourceBackedOnly,
                onSourceBackedOnlyChange: setSourceBackedOnly,
              }
            : {})}
        />
        {isLoadingData || !hasLayout ? (
          <div className="flex-grow flex items-center justify-center h-full">
            <LoadingSpinner />
          </div>
        ) : (
          <div ref={setGraphCanvas} className="flex-grow relative overscroll-none">
            <TechTreeNodeActionsContext.Provider value={nodeActions}>
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={TECH_TREE_NODE_TYPES}
                onNodesChange={undefined}
                onEdgesChange={undefined}
                onConnect={undefined}
                onEdgeClick={undefined}
                onNodeDragStop={undefined}
                draggable={false}
                nodesConnectable={false}
                colorMode={'light'}
                fitView={autoFit}
                fitViewOptions={fitViewOptions}
                minZoom={minZoom}
                className="h-full w-full"
              >
                <Background bgColor="white" variant={BackgroundVariant.Dots} />
                <Controls
                  showInteractive={false}
                  showZoom={true}
                  showFitView={true}
                  className="!left-4 !top-[180px] !bottom-auto md:!top-auto md:!bottom-4"
                />
                <ZoomDetailLevelSync />
              </ReactFlow>
            </TechTreeNodeActionsContext.Provider>
            
            {/* Knowledge Base Selector - Positioned above Legend. A pathway
                hides it and the legend so they don't cover framed nodes. */}
            {!pathwayActive && (
              <KnowledgeBaseSelector topic={topic} onTopicChange={onTopicChange} />
            )}

            {paperDossier && (
              <PaperDetails
                dossier={paperDossier}
                topic={topic}
                onClose={() => setPaperDossier(null)}
              />
            )}
            {showReview && (
              <LiteratureReview
                topic={topic}
                onClose={() => setShowReview(false)}
                onVerdictChanged={handleVerdictChanged}
              />
            )}
            
            {/* Legend */}
            {!pathwayActive && (
              <div className={`${showLegend ? 'block' : 'hidden'} md:block`}>
                <Legend
                  showAggregates={aggregationMode !== 'none' || foldedBranchCount > 0}
                />
              </div>
            )}

            {pathwayMode && onPathwayStepChange && (
              <PathwayGuide
                containerRef={pathwayGuideRef}
                topic={topic}
                pathway={pathwayMode.pathway}
                steps={pathwayMode.steps}
                stepIndex={pathwayMode.stepIndex}
                nodeById={nodeById}
                isIsolated={
                  !techTree?.edges.some(
                    (edge) =>
                      edge.source === pathwayMode.pathway.targetId ||
                      edge.target === pathwayMode.pathway.targetId,
                  )
                }
                onStepChange={onPathwayStepChange}
                onSelectNode={handleShowDetails}
                onExit={handleExitPathway}
                onChooseAnother={onChooseTechnology}
                onShowCompanies={handlePathwayShowCompanies}
                onAskAssistant={handlePathwayAskAssistant}
              />
            )}
          </div>
        )}
      </div>
      <div 
        className={`bg-white shadow-lg transition-all duration-300 relative ${
          isPanelExpanded 
            ? 'w-full md:w-2/4'
            : 'w-0'
        } ${
          isPanelExpanded ? 'fixed md:relative inset-0 md:inset-auto z-40 md:z-auto' : ''
        }`}
      >
        {isEditing ? (
          <EditInterface onExit={handleExitEditMode} topic={topic} />
        ) : (
          <TabPanel
            selectedNode={selectedNode}
            techTree={techTree}
            isPanelExpanded={isPanelExpanded}
            onTogglePanel={() => setIsPanelExpanded(!isPanelExpanded)}
            topic={topic}
            onNodeSelect={handleSimulationNodeSelect}
            onShowNodeDetailsRef={(fn) => { showNodeDetailsTabRef.current = fn; }}
            onShowCompaniesViewRef={(fn) => { showCompaniesSubViewRef.current = fn; }}
            onShowChatRef={(fn) => { showChatTabRef.current = fn; }}
            onChooseTechnology={onChooseTechnology}
            panel={panel}
            onPanelChange={onPanelChange}
          />
        )}
      </div>
      <TreeComparison
        open={isComparing}
        onOpenChange={setIsComparing}
        currentTopic={topic}
        initialMode={aggregationMode === 'none' ? 'category-role' : aggregationMode}
        onOpenTopic={handleOpenComparedTopic}
      />
    </div>
  );
};

export default TechTree;