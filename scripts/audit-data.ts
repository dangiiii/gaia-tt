import * as fs from 'node:fs';
import * as path from 'node:path';
import { isValid as isValidCountryCode } from 'i18n-iso-countries';

interface RawNode {
  id?: unknown;
  label?: unknown;
  type?: unknown;
  trl_current?: unknown;
  references?: unknown;
}

interface RawEdge {
  id?: unknown;
  source?: unknown;
  target?: unknown;
  targets?: unknown;
}

interface RawGraph {
  nodes?: RawNode[];
  edges?: RawEdge[];
}

interface CsvRow {
  [key: string]: string;
}

const ROOT = path.resolve(__dirname, '..');
const ACTIVE_DATASETS = [
  path.join(ROOT, 'data/nuclear_tt_v2.json'),
  path.join(ROOT, 'data/fossil_fuel_tt_v2.json'),
];
const COMPANY_DATASET = path.join(ROOT, 'data/tt-companies.csv');
const COMPANY_LOCATIONS_DATASET = path.join(
  ROOT,
  'data/company_locations.json',
);

const errors: string[] = [];
const warnings: string[] = [];

function addError(scope: string, message: string) {
  errors.push(`[${scope}] ${message}`);
}

function addWarning(scope: string, message: string) {
  warnings.push(`[${scope}] ${message}`);
}

function readGraph(filePath: string): RawGraph {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
    graph?: RawGraph;
    nodes?: RawNode[];
    edges?: RawEdge[];
  };
  return parsed.graph ?? parsed;
}

function normalizeTargets(edge: RawEdge): string[] {
  if (typeof edge.target === 'string' && edge.target) return [edge.target];
  if (Array.isArray(edge.targets)) {
    return edge.targets.filter(
      (target): target is string => typeof target === 'string' && !!target,
    );
  }
  return [];
}

function isValidTrl(value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const normalized = String(value).trim();
  const match = normalized.match(/^([1-9])(?:-([1-9]))?$/);
  if (!match) return false;
  return match[2] === undefined || Number(match[1]) <= Number(match[2]);
}

function auditGraph(filePath: string): Set<string> {
  const scope = path.basename(filePath);
  const graph = readGraph(filePath);
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];

  if (nodes.length === 0) addError(scope, 'Graph contains no nodes.');
  if (edges.length === 0) addError(scope, 'Graph contains no edges.');

  const nodeIds = new Set<string>();
  const duplicateNodeIds = new Set<string>();
  nodes.forEach((node, index) => {
    if (typeof node.id !== 'string' || !node.id.trim()) {
      addError(scope, `Node at index ${index} has no valid id.`);
      return;
    }
    if (nodeIds.has(node.id)) duplicateNodeIds.add(node.id);
    nodeIds.add(node.id);

    if (!isValidTrl(node.trl_current)) {
      addError(scope, `Node "${node.id}" has invalid trl_current.`);
    }
    if (!Array.isArray(node.references) || node.references.length === 0) {
      addError(scope, `Node "${node.id}" has no references.`);
    }
  });
  duplicateNodeIds.forEach((id) => addError(scope, `Duplicate node id "${id}".`));

  const edgeIds = new Set<string>();
  const edgePairs = new Set<string>();
  const connectedNodeIds = new Set<string>();
  edges.forEach((edge, index) => {
    const edgeId =
      typeof edge.id === 'string' && edge.id.trim() ? edge.id : `index:${index}`;
    if (edgeIds.has(edgeId)) addError(scope, `Duplicate edge id "${edgeId}".`);
    edgeIds.add(edgeId);

    if (typeof edge.source !== 'string' || !nodeIds.has(edge.source)) {
      addError(scope, `Edge "${edgeId}" has an unknown source.`);
      return;
    }

    const targets = normalizeTargets(edge);
    if (targets.length === 0) {
      addError(scope, `Edge "${edgeId}" has no target.`);
      return;
    }

    targets.forEach((target) => {
      if (!nodeIds.has(target)) {
        addError(scope, `Edge "${edgeId}" targets unknown node "${target}".`);
        return;
      }
      const pair = `${edge.source}->${target}`;
      if (edgePairs.has(pair)) {
        addError(scope, `Duplicate prerequisite pair "${pair}".`);
      }
      edgePairs.add(pair);
      connectedNodeIds.add(edge.source as string);
      connectedNodeIds.add(target);
    });
  });

  nodes.forEach((node) => {
    if (typeof node.id === 'string' && !connectedNodeIds.has(node.id)) {
      addWarning(scope, `Node "${node.id}" is isolated and requires review.`);
    }
  });

  console.log(
    `${scope}: ${nodes.length} nodes, ${edgePairs.size} normalized edges`,
  );
  return nodeIds;
}

function parseCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      record.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      record.push(cell);
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell || record.length) {
    record.push(cell);
    if (record.some((value) => value.trim())) records.push(record);
  }
  if (records.length === 0) return [];

  const headers = records[0].map((header) => header.trim());
  return records.slice(1).map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [header, values[index]?.trim() ?? '']),
    ),
  );
}

function splitPipe(value: string | undefined): string[] {
  return (value ?? '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}

function isValidIso2(value: string): boolean {
  return /^[A-Z]{2}$/.test(value) && isValidCountryCode(value);
}

function auditCompanies(validNuclearNodeIds: Set<string>): Set<string> {
  const scope = path.basename(COMPANY_DATASET);
  const rows = parseCsv(fs.readFileSync(COMPANY_DATASET, 'utf8'));
  const companyIds = new Set<string>();
  let mappingCount = 0;
  let companiesWithoutMappings = 0;
  let headquartersCount = 0;
  let manufacturingCount = 0;

  rows.forEach((row, index) => {
    const id = row.id;
    const rowLabel = id || `row ${index + 2}`;
    if (!id) {
      addError(scope, `Row ${index + 2} has no company id.`);
    } else if (companyIds.has(id)) {
      addError(scope, `Duplicate company id "${id}".`);
    } else {
      companyIds.add(id);
    }
    if (!row.canonical_name) {
      addError(scope, `Company "${rowLabel}" has no canonical_name.`);
    }

    if (row.country_iso) {
      headquartersCount += 1;
      if (!isValidIso2(row.country_iso)) {
        addError(
          scope,
          `Company "${rowLabel}" has invalid country_iso "${row.country_iso}".`,
        );
      }
    }

    const manufacturingCountries = splitPipe(row.manufacturing_countries).map(
      (entry) => entry.split(':')[0],
    );
    if (manufacturingCountries.length > 0) manufacturingCount += 1;
    manufacturingCountries.forEach((country) => {
      if (!isValidIso2(country)) {
        addError(
          scope,
          `Company "${rowLabel}" has invalid manufacturing country "${country}".`,
        );
      }
    });

    const mappedNodes = splitPipe(row.tech_tree_all_nodes);
    mappingCount += mappedNodes.length;
    if (mappedNodes.length === 0) companiesWithoutMappings += 1;
    mappedNodes.forEach((nodeId) => {
      if (!validNuclearNodeIds.has(nodeId)) {
        addError(
          scope,
          `Company "${rowLabel}" maps to unknown nuclear node "${nodeId}".`,
        );
      }
    });

    if (
      row.tech_tree_primary_node &&
      !mappedNodes.includes(row.tech_tree_primary_node)
    ) {
      addError(
        scope,
        `Company "${rowLabel}" primary node is absent from tech_tree_all_nodes.`,
      );
    }

    [
      'tech_tree_all_methods',
      'tech_tree_all_confidences',
      'tech_tree_all_reasonings',
      'tech_tree_all_source_urls',
    ].forEach((field) => {
      const values = splitPipe(row[field]);
      if (values.length > 0 && values.length !== mappedNodes.length) {
        addError(
          scope,
          `Company "${rowLabel}" has ${values.length} ${field} values for ${mappedNodes.length} mapped nodes.`,
        );
      }
    });
  });

  if (companiesWithoutMappings > 0) {
    addWarning(
      scope,
      `${companiesWithoutMappings} companies have no technology mapping and are excluded from the new views.`,
    );
  }

  console.log(
    `${scope}: ${rows.length} companies, ${mappingCount} mappings, ${headquartersCount} headquarters countries, ${manufacturingCount} manufacturing footprints`,
  );
  return companyIds;
}

function auditCompanyLocations(companyIds: Set<string>) {
  const scope = path.basename(COMPANY_LOCATIONS_DATASET);
  const parsed = JSON.parse(
    fs.readFileSync(COMPANY_LOCATIONS_DATASET, 'utf8'),
  ) as {
    locations?: Array<{
      company_id?: unknown;
      country_iso?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      label?: unknown;
    }>;
  };
  const locations = parsed.locations ?? [];
  const seenCompanyIds = new Set<string>();

  locations.forEach((location, index) => {
    const companyId =
      typeof location.company_id === 'string' ? location.company_id : '';
    if (!companyId || !companyIds.has(companyId)) {
      addError(scope, `Location ${index} references an unknown company.`);
    }
    if (seenCompanyIds.has(companyId)) {
      addError(scope, `Company "${companyId}" has duplicate location rows.`);
    }
    seenCompanyIds.add(companyId);
    if (
      typeof location.country_iso !== 'string' ||
      !isValidIso2(location.country_iso)
    ) {
      addError(scope, `Company "${companyId}" has an invalid country code.`);
    }
    if (
      typeof location.latitude !== 'number' ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      typeof location.longitude !== 'number' ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      addError(scope, `Company "${companyId}" has invalid coordinates.`);
    }
    if (typeof location.label !== 'string' || !location.label.trim()) {
      addError(scope, `Company "${companyId}" has no location label.`);
    }
  });

  console.log(`${scope}: ${locations.length} verified city locations`);
}

function main() {
  console.log('Auditing active technology-tree and company datasets…');
  const [nuclearNodeIds] = ACTIVE_DATASETS.map(auditGraph);
  const companyIds = auditCompanies(nuclearNodeIds);
  auditCompanyLocations(companyIds);

  warnings.forEach((warning) => console.warn(`WARNING ${warning}`));
  errors.forEach((error) => console.error(`ERROR ${error}`));

  if (errors.length > 0) {
    console.error(
      `Audit failed with ${errors.length} error(s) and ${warnings.length} warning(s).`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Audit passed with no structural errors and ${warnings.length} warning(s).`,
  );
}

main();
