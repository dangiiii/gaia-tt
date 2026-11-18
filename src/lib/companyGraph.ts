import ELK from 'elkjs/lib/elk.bundled.js';
import { Edge, MarkerType, Position } from '@xyflow/react';
import {
  CompanyGraphNode,
  CompanySummary,
  CompanyTechnologyMapping,
  DataNode,
  LABEL_COLORS_VARIABLES,
  NodeLabel,
  ProductRegion,
  TechTree,
} from '@/lib/types';
import { getProductRegion } from '@/lib/geography';

const elk = new ELK();
const COMPANY_WIDTH = 190;
const COMPANY_HEIGHT = 84;
const TECHNOLOGY_WIDTH = 180;
const TECHNOLOGY_HEIGHT = 84;

export interface CompanyGraphFilters {
  searchTerm: string;
  region: ProductRegion;
  category: string;
  primaryOnly: boolean;
  focusedNodeId: string | null;
}

export interface CompanyGraphProjection {
  companies: CompanySummary[];
  technologies: DataNode[];
  mappings: CompanyTechnologyMapping[];
}

export type CompanyDirectorySort = 'name' | 'trl' | 'funding';

export interface CompanyDirectoryEntry {
  company: CompanySummary;
  mappings: CompanyTechnologyMapping[];
  technologyCount: number;
}

function includesSearch(value: unknown, searchTerm: string): boolean {
  return typeof value === 'string' && value.toLowerCase().includes(searchTerm);
}

export function buildCompanyDirectory(
  companies: CompanySummary[],
  mappings: CompanyTechnologyMapping[],
  techTree: TechTree,
  filters: Omit<CompanyGraphFilters, 'focusedNodeId'>,
  sort: CompanyDirectorySort,
): CompanyDirectoryEntry[] {
  const projection = buildCompanyGraphProjection(
    companies,
    mappings,
    techTree,
    { ...filters, focusedNodeId: null },
  );
  const mappingsByCompany = new Map<string, CompanyTechnologyMapping[]>();

  projection.mappings.forEach((mapping) => {
    const current = mappingsByCompany.get(mapping.company_id) ?? [];
    current.push(mapping);
    mappingsByCompany.set(mapping.company_id, current);
  });

  return projection.companies
    .map((company) => {
      const companyMappings = mappingsByCompany.get(company.id) ?? [];
      return {
        company,
        mappings: companyMappings,
        technologyCount: new Set(
          companyMappings.map((mapping) => mapping.tech_tree_node_id),
        ).size,
      };
    })
    .sort((left, right) => {
      if (sort === 'trl') {
        const trlDifference =
          (right.company.trl_level ?? -1) - (left.company.trl_level ?? -1);
        if (trlDifference) return trlDifference;
      }
      if (sort === 'funding') {
        const fundingDifference =
          (right.company.funding_total_usd ?? -1) -
          (left.company.funding_total_usd ?? -1);
        if (fundingDifference) return fundingDifference;
      }
      return left.company.canonical_name.localeCompare(
        right.company.canonical_name,
      );
    });
}

export function buildSelectedCompanyGraphProjection(
  company: CompanySummary,
  mappings: CompanyTechnologyMapping[],
  techTree: TechTree,
  primaryOnly: boolean,
): CompanyGraphProjection {
  const companyMappings = mappings.filter(
    (mapping) =>
      mapping.company_id === company.id &&
      (!primaryOnly || mapping.is_primary),
  );
  const technologyIds = new Set(
    companyMappings.map((mapping) => mapping.tech_tree_node_id),
  );

  return {
    companies: [company],
    technologies: techTree.nodes.filter((node) => technologyIds.has(node.id)),
    mappings: companyMappings,
  };
}

export function buildCompanyGraphProjection(
  companies: CompanySummary[],
  mappings: CompanyTechnologyMapping[],
  techTree: TechTree,
  filters: CompanyGraphFilters,
): CompanyGraphProjection {
  const normalizedSearch = filters.searchTerm.trim().toLowerCase();
  const technologyById = new Map(techTree.nodes.map((node) => [node.id, node]));
  const companyById = new Map(companies.map((company) => [company.id, company]));

  let filteredMappings = mappings.filter((mapping) => {
    if (filters.primaryOnly && !mapping.is_primary) return false;

    const company = companyById.get(mapping.company_id);
    const technology = technologyById.get(mapping.tech_tree_node_id);
    if (!company || !technology) return false;

    if (
      filters.region !== 'All' &&
      getProductRegion(company.country_iso) !== filters.region
    ) {
      return false;
    }

    if (
      filters.category !== 'All' &&
      technology.data.category !== filters.category
    ) {
      return false;
    }

    if (normalizedSearch) {
      const companyMatches =
        includesSearch(company.canonical_name, normalizedSearch) ||
        includesSearch(company.primary_approach, normalizedSearch) ||
        includesSearch(company.country_iso, normalizedSearch);
      const technologyMatches =
        includesSearch(technology.data.label, normalizedSearch) ||
        includesSearch(technology.data.category, normalizedSearch) ||
        includesSearch(technology.data.subtype, normalizedSearch);
      if (!companyMatches && !technologyMatches) return false;
    }

    return true;
  });

  if (filters.focusedNodeId) {
    filteredMappings = filteredMappings.filter(
      (mapping) =>
        `company:${mapping.company_id}` === filters.focusedNodeId ||
        `technology:${mapping.tech_tree_node_id}` === filters.focusedNodeId,
    );
  }

  const visibleCompanyIds = new Set(
    filteredMappings.map((mapping) => mapping.company_id),
  );
  const visibleTechnologyIds = new Set(
    filteredMappings.map((mapping) => mapping.tech_tree_node_id),
  );

  return {
    companies: companies.filter((company) => visibleCompanyIds.has(company.id)),
    technologies: techTree.nodes.filter((technology) =>
      visibleTechnologyIds.has(technology.id),
    ),
    mappings: filteredMappings,
  };
}

export async function layoutCompanyGraph(
  projection: CompanyGraphProjection,
): Promise<{ nodes: CompanyGraphNode[]; edges: Edge[] }> {
  const companyNodes: CompanyGraphNode[] = projection.companies.map((company) => ({
    id: `company:${company.id}`,
    type: 'companyGraphCompany',
    position: { x: 0, y: 0 },
    sourcePosition: Position.Right,
    width: COMPANY_WIDTH,
    height: COMPANY_HEIGHT,
    data: {
      label: company.canonical_name,
      nodeType: 'companyGraphCompany',
      company,
    },
    style: {
      width: COMPANY_WIDTH,
      height: COMPANY_HEIGHT,
      border: '2px solid #ca8a04',
      borderRadius: '8px',
      background: '#fffbeb',
    },
  }));

  const technologyNodes: CompanyGraphNode[] = projection.technologies.map(
    (technology) => ({
      id: `technology:${technology.id}`,
      type: 'companyGraphTechnology',
      position: { x: 0, y: 0 },
      targetPosition: Position.Left,
      width: TECHNOLOGY_WIDTH,
      height: TECHNOLOGY_HEIGHT,
      data: {
        label: String(technology.data.label),
        nodeType: 'companyGraphTechnology',
        technologyNode: technology,
      },
      style: {
        width: TECHNOLOGY_WIDTH,
        height: TECHNOLOGY_HEIGHT,
        border: `2px solid ${
          LABEL_COLORS_VARIABLES[technology.data.nodeLabel as NodeLabel]
        }`,
        borderRadius: '8px',
        background: '#ffffff',
      },
    }),
  );

  const nodes = [...companyNodes, ...technologyNodes];
  const edges: Edge[] = projection.mappings.map((mapping) => ({
    id: `mapping:${mapping.id}`,
    source: `company:${mapping.company_id}`,
    target: `technology:${mapping.tech_tree_node_id}`,
    style: {
      stroke: mapping.is_primary ? '#ca8a04' : '#94a3b8',
      strokeWidth: mapping.is_primary ? 2 : 1,
      strokeDasharray: mapping.is_primary ? undefined : '5 4',
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: mapping.is_primary ? '#ca8a04' : '#94a3b8',
    },
  }));

  if (nodes.length === 0) return { nodes, edges };

  const graph = await elk.layout({
    id: 'company-graph',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '26',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.width,
      height: node.height,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  });
  const positions = new Map(
    graph.children?.map((node) => [
      node.id,
      { x: node.x ?? 0, y: node.y ?? 0 },
    ]) ?? [],
  );

  return {
    nodes: nodes.map((node) => ({
      ...node,
      position: positions.get(node.id) ?? node.position,
    })),
    edges,
  };
}
