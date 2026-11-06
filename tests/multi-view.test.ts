import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCompanyViewResponse } from '@/lib/companyData';
import {
  buildCompanyDirectory,
  buildCompanyGraphProjection,
  buildSelectedCompanyGraphProjection,
} from '@/lib/companyGraph';
import {
  aggregateCompaniesByCountry,
  buildTechnologyDistribution,
  getCountryBubbleRadius,
  getProductRegion,
  groupCompanyLocations,
  normalizeCountryIso,
} from '@/lib/geography';
import {
  CompanySummary,
  CompanyTechnologyMapping,
  TechTree,
} from '@/lib/types';

const companies: CompanySummary[] = [
  {
    id: 'alpha',
    canonical_name: 'Alpha Energy',
    country_iso: 'US',
    manufacturing_countries: ['US', 'DE'],
    primary_approach: 'Fusion',
    tech_tree_primary_node: 'tech-a',
    trl_level: 6,
    trl_band: 'mid',
    funding_total_usd: null,
    vc_funding_stage: null,
    headcount_range: null,
    description: null,
    domain: null,
    geopolitical_risk_score: null,
    geopolitical_risk_label: null,
  },
  {
    id: 'beta',
    canonical_name: 'Beta Systems',
    country_iso: null,
    manufacturing_countries: ['CN'],
    primary_approach: 'Fission',
    tech_tree_primary_node: 'tech-b',
    trl_level: null,
    trl_band: null,
    funding_total_usd: null,
    vc_funding_stage: null,
    headcount_range: null,
    description: null,
    domain: null,
    geopolitical_risk_score: null,
    geopolitical_risk_label: null,
  },
];

const mappings: CompanyTechnologyMapping[] = [
  {
    id: 'alpha__tech-a',
    company_id: 'alpha',
    tech_tree_node_id: 'tech-a',
    is_primary: true,
    confidence: 0.9,
    method: 'source',
    reasoning: null,
  },
  {
    id: 'alpha__tech-b',
    company_id: 'alpha',
    tech_tree_node_id: 'tech-b',
    is_primary: false,
    confidence: 0.7,
    method: 'source',
    reasoning: null,
  },
  {
    id: 'beta__tech-b',
    company_id: 'beta',
    tech_tree_node_id: 'tech-b',
    is_primary: true,
    confidence: 0.8,
    method: 'source',
    reasoning: null,
  },
];

const techTree: TechTree = {
  nodes: [
    {
      id: 'tech-a',
      data: {
        label: 'Technology A',
        nodeLabel: 'ReactorConcept',
        description: 'A',
        category: 'Fusion',
      },
    },
    {
      id: 'tech-b',
      data: {
        label: 'Technology B',
        nodeLabel: 'EnablingTechnology',
        description: 'B',
        category: 'Fission',
      },
    },
  ],
  edges: [],
};

test('company response reports mapped and geography coverage', () => {
  const response = buildCompanyViewResponse(
    [
      {
        ...companies[0],
      },
      {
        ...companies[1],
      },
      {
        id: 'unmapped',
        canonical_name: 'Unmapped',
        country_iso: 'GB',
      },
    ],
    mappings,
    'Nuclear',
  );

  assert.equal(response.available, true);
  assert.equal(response.coverage.totalCompanies, 3);
  assert.equal(response.coverage.mappedCompanies, 2);
  assert.equal(response.coverage.excludedUnmappedCompanies, 1);
  assert.equal(response.coverage.mappedWithHeadquarters, 1);
  assert.equal(response.coverage.mappedWithManufacturing, 2);
});

test('company response returns a typed unavailable state without mappings', () => {
  const response = buildCompanyViewResponse(
    [{ id: 'company', canonical_name: 'Company' }],
    [],
    'Fossil Fuels',
  );

  assert.equal(response.available, false);
  assert.match(response.reason, /Fossil Fuels/);
  assert.deepEqual(response.companies, []);
});

test('company graph defaults can retain only primary mappings', () => {
  const projection = buildCompanyGraphProjection(companies, mappings, techTree, {
    searchTerm: '',
    region: 'All',
    category: 'All',
    primaryOnly: true,
    focusedNodeId: null,
  });

  assert.equal(projection.mappings.length, 2);
  assert.deepEqual(
    projection.mappings.map((mapping) => mapping.id).sort(),
    ['alpha__tech-a', 'beta__tech-b'],
  );
});

test('company graph combines region, category, and connected focus filters', () => {
  const projection = buildCompanyGraphProjection(companies, mappings, techTree, {
    searchTerm: '',
    region: 'North America',
    category: 'Fission',
    primaryOnly: false,
    focusedNodeId: 'company:alpha',
  });

  assert.equal(projection.companies.length, 1);
  assert.equal(projection.technologies[0]?.id, 'tech-b');
  assert.equal(projection.mappings[0]?.id, 'alpha__tech-b');
});

test('company directory filters and sorts without creating an all-company graph', () => {
  const directory = buildCompanyDirectory(
    companies,
    mappings,
    techTree,
    {
      searchTerm: '',
      region: 'All',
      category: 'All',
      primaryOnly: true,
    },
    'trl',
  );

  assert.deepEqual(
    directory.map((entry) => entry.company.id),
    ['alpha', 'beta'],
  );
  assert.equal(directory[0]?.technologyCount, 1);
});

test('selected-company graph contains one company and only its technologies', () => {
  const projection = buildSelectedCompanyGraphProjection(
    companies[0],
    mappings,
    techTree,
    false,
  );

  assert.deepEqual(
    projection.companies.map((company) => company.id),
    ['alpha'],
  );
  assert.deepEqual(
    projection.technologies.map((technology) => technology.id).sort(),
    ['tech-a', 'tech-b'],
  );
  assert.equal(projection.mappings.length, 2);
});

test('headquarters and manufacturing aggregation remain separate', () => {
  const headquarters = aggregateCompaniesByCountry(companies, 'headquarters');
  const manufacturing = aggregateCompaniesByCountry(companies, 'manufacturing');

  assert.deepEqual(
    headquarters.map((country) => country.countryIso),
    ['US'],
  );
  assert.deepEqual(
    manufacturing.map((country) => country.countryIso).sort(),
    ['CN', 'DE', 'US'],
  );
});

test('country bubbles use bounded square-root scaling', () => {
  const small = getCountryBubbleRadius(1, 100);
  const medium = getCountryBubbleRadius(25, 100);
  const maximum = getCountryBubbleRadius(100, 100);

  assert.ok(small >= 8);
  assert.ok(medium > small);
  assert.ok(maximum > medium);
  assert.equal(maximum, 26);
});

test('verified company coordinates group colocated companies without inventing points', () => {
  const groups = groupCompanyLocations(
    [
      {
        company_id: 'alpha',
        label: 'Boston, MA',
        country_iso: 'US',
        latitude: 42.36,
        longitude: -71.06,
        source_field: 'linkedin_headquarters',
        source_url: null,
      },
      {
        company_id: 'beta',
        label: 'Boston, MA',
        country_iso: 'US',
        latitude: 42.36,
        longitude: -71.06,
        source_field: 'linkedin_headquarters',
        source_url: null,
      },
      {
        company_id: 'unknown',
        label: 'Unknown',
        country_iso: 'US',
        latitude: 0,
        longitude: 0,
        source_field: 'linkedin_headquarters',
        source_url: null,
      },
    ],
    companies,
  );

  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].companies.map((company) => company.id).sort(),
    ['alpha', 'beta'],
  );
});

test('country drawer technology distribution counts unique company mappings', () => {
  const distribution = buildTechnologyDistribution(companies, mappings, techTree);

  assert.deepEqual(
    distribution.map((technology) => [
      technology.technologyId,
      technology.companyCount,
    ]),
    [
      ['tech-b', 2],
      ['tech-a', 1],
    ],
  );
});

test('country normalization and product regions handle unknown values', () => {
  assert.equal(normalizeCountryIso(' us '), 'US');
  assert.equal(normalizeCountryIso('USA'), null);
  assert.equal(getProductRegion('CN'), 'China');
  assert.equal(getProductRegion('DE'), 'Europe');
  assert.equal(getProductRegion(null), 'Other/Unknown');
});
