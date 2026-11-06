import {
  CompanySummary,
  CompanyTechnologyMapping,
  CompanyLocation,
  GeographyLayer,
  ProductRegion,
  TechTree,
} from '@/lib/types';

const NORTH_AMERICA = new Set(['CA', 'MX', 'US']);
const EUROPE = new Set([
  'AD',
  'AL',
  'AT',
  'BA',
  'BE',
  'BG',
  'BY',
  'CH',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GB',
  'GR',
  'HR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MC',
  'MD',
  'ME',
  'MK',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'RS',
  'RU',
  'SE',
  'SI',
  'SK',
  'SM',
  'UA',
  'VA',
]);
const ASIA_PACIFIC = new Set([
  'AF',
  'AU',
  'BD',
  'BN',
  'BT',
  'FJ',
  'HK',
  'ID',
  'IN',
  'JP',
  'KH',
  'KI',
  'KP',
  'KR',
  'KZ',
  'LA',
  'LK',
  'MM',
  'MN',
  'MO',
  'MV',
  'MY',
  'NP',
  'NZ',
  'PG',
  'PH',
  'PK',
  'SG',
  'TH',
  'TJ',
  'TL',
  'TM',
  'TW',
  'UZ',
  'VN',
]);
const LATIN_AMERICA = new Set([
  'AR',
  'BO',
  'BR',
  'BZ',
  'CL',
  'CO',
  'CR',
  'CU',
  'DO',
  'EC',
  'GT',
  'GY',
  'HN',
  'HT',
  'NI',
  'PA',
  'PE',
  'PR',
  'PY',
  'SR',
  'SV',
  'UY',
  'VE',
]);
const MIDDLE_EAST = new Set([
  'AE',
  'BH',
  'EG',
  'IL',
  'IQ',
  'IR',
  'JO',
  'KW',
  'LB',
  'OM',
  'PS',
  'QA',
  'SA',
  'SY',
  'TR',
  'YE',
]);
const AFRICA = new Set([
  'AO',
  'BF',
  'BI',
  'BJ',
  'BW',
  'CD',
  'CF',
  'CG',
  'CI',
  'CM',
  'CV',
  'DJ',
  'DZ',
  'ER',
  'ET',
  'GA',
  'GH',
  'GM',
  'GN',
  'GQ',
  'GW',
  'KE',
  'KM',
  'LR',
  'LS',
  'LY',
  'MA',
  'MG',
  'ML',
  'MR',
  'MU',
  'MW',
  'MZ',
  'NA',
  'NE',
  'NG',
  'RW',
  'SC',
  'SD',
  'SL',
  'SN',
  'SO',
  'SS',
  'ST',
  'SZ',
  'TD',
  'TG',
  'TN',
  'TZ',
  'UG',
  'ZA',
  'ZM',
  'ZW',
]);

export function normalizeCountryIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export function getProductRegion(countryIso: string | null): ProductRegion {
  const country = normalizeCountryIso(countryIso);
  if (!country) return 'Other/Unknown';
  if (country === 'CN') return 'China';
  if (NORTH_AMERICA.has(country)) return 'North America';
  if (EUROPE.has(country)) return 'Europe';
  if (ASIA_PACIFIC.has(country)) return 'Asia-Pacific';
  if (LATIN_AMERICA.has(country)) return 'Latin America';
  if (MIDDLE_EAST.has(country)) return 'Middle East';
  if (AFRICA.has(country)) return 'Africa';
  return 'Other/Unknown';
}

export function getCountryName(countryIso: string): string {
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return displayNames.of(countryIso) ?? countryIso;
  } catch {
    return countryIso;
  }
}

export function getCompanyCountries(
  company: CompanySummary,
  layer: GeographyLayer,
): string[] {
  if (layer === 'headquarters') {
    const country = normalizeCountryIso(company.country_iso);
    return country ? [country] : [];
  }

  return [
    ...new Set(
      company.manufacturing_countries
        .map(normalizeCountryIso)
        .filter((country): country is string => country !== null),
    ),
  ];
}

export interface CountryCompanyAggregate {
  countryIso: string;
  countryName: string;
  region: ProductRegion;
  companies: CompanySummary[];
}

export interface TechnologyDistributionItem {
  technologyId: string;
  label: string;
  companyCount: number;
}

export interface CompanyLocationGroup {
  key: string;
  label: string;
  countryIso: string;
  coordinates: [number, number];
  companies: CompanySummary[];
}

export function groupCompanyLocations(
  locations: CompanyLocation[],
  companies: CompanySummary[],
): CompanyLocationGroup[] {
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const groups = new Map<string, CompanyLocationGroup>();

  locations.forEach((location) => {
    const company = companyById.get(location.company_id);
    if (!company) return;
    const key = `${location.country_iso}:${location.latitude}:${location.longitude}`;
    const current = groups.get(key) ?? {
      key,
      label: location.label,
      countryIso: location.country_iso,
      coordinates: [location.longitude, location.latitude] as [number, number],
      companies: [],
    };
    current.companies.push(company);
    groups.set(key, current);
  });

  return [...groups.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export function buildTechnologyDistribution(
  companies: CompanySummary[],
  mappings: CompanyTechnologyMapping[],
  techTree: TechTree | null,
): TechnologyDistributionItem[] {
  const companyIds = new Set(companies.map((company) => company.id));
  const technologyCounts = new Map<string, number>();

  mappings.forEach((mapping) => {
    if (!companyIds.has(mapping.company_id)) return;
    technologyCounts.set(
      mapping.tech_tree_node_id,
      (technologyCounts.get(mapping.tech_tree_node_id) ?? 0) + 1,
    );
  });

  return [...technologyCounts.entries()]
    .map(([technologyId, companyCount]) => ({
      technologyId,
      companyCount,
      label: String(
        techTree?.nodes.find((node) => node.id === technologyId)?.data.label ??
          technologyId,
      ),
    }))
    .sort(
      (left, right) =>
        right.companyCount - left.companyCount ||
        left.label.localeCompare(right.label),
    );
}

export function getCountryBubbleRadius(count: number, maximum: number): number {
  if (count <= 0 || maximum <= 0) return 0;
  return 8 + Math.sqrt(count / maximum) * 18;
}

export function aggregateCompaniesByCountry(
  companies: CompanySummary[],
  layer: GeographyLayer,
  region: ProductRegion = 'All',
): CountryCompanyAggregate[] {
  const companiesByCountry = new Map<string, CompanySummary[]>();

  companies.forEach((company) => {
    getCompanyCountries(company, layer).forEach((countryIso) => {
      if (region !== 'All' && getProductRegion(countryIso) !== region) return;
      const current = companiesByCountry.get(countryIso) ?? [];
      current.push(company);
      companiesByCountry.set(countryIso, current);
    });
  });

  return [...companiesByCountry.entries()]
    .map(([countryIso, countryCompanies]) => ({
      countryIso,
      countryName: getCountryName(countryIso),
      region: getProductRegion(countryIso),
      companies: countryCompanies.sort((left, right) =>
        left.canonical_name.localeCompare(right.canonical_name),
      ),
    }))
    .sort((left, right) => {
      const countDifference = right.companies.length - left.companies.length;
      return countDifference || left.countryName.localeCompare(right.countryName);
    });
}
