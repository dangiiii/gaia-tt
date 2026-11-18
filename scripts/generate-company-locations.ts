import * as fs from 'node:fs';
import * as path from 'node:path';
import cities from 'cities.json';
import admin1Regions from 'cities.json/admin1';

interface CsvRow {
  [key: string]: string;
}

interface City {
  name: string;
  lat: string;
  lng: string;
  country: string;
  admin1: string;
}

interface CompanyLocation {
  company_id: string;
  label: string;
  country_iso: string;
  latitude: number;
  longitude: number;
  source_field: 'linkedin_headquarters';
  source_url: string | null;
}

const ROOT = path.resolve(__dirname, '..');
const INPUT_PATH = path.join(ROOT, 'data/tt-companies.csv');
const OUTPUT_PATH = path.join(ROOT, 'data/company_locations.json');

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

  const headers = records[0].map((header) => header.trim());
  return records.slice(1).map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [header, values[index]?.trim() ?? '']),
    ),
  );
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function candidateCityNames(headquarters: string): string[] {
  const parts = headquarters
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const first = parts[0] ?? headquarters;
  const aliases: Record<string, string> = {
    genova: 'Genoa',
  };
  const candidates = [
    headquarters,
    first,
    parts.at(-1) ?? '',
    first.replace(/-ku$/i, ''),
    first.replace(/ city$/i, ''),
    first.split(/\s+/)[0],
    aliases[normalize(first)] ?? '',
  ];

  return [...new Set(candidates.filter(Boolean))];
}

function resolveCity(
  headquarters: string,
  countryIso: string,
  cityIndex: Map<string, City[]>,
  regionIndex: Map<string, string>,
): City | null {
  const regionText = headquarters.split(',').slice(1).join(' ').trim();
  const normalizedRegion = normalize(regionText);

  for (const candidate of candidateCityNames(headquarters)) {
    const normalizedCandidate = normalize(candidate);
    const matches =
      cityIndex.get(`${countryIso}|${normalizedCandidate}`) ??
      cityIndex.get(
        `${countryIso}|${normalizedCandidate.replaceAll('ue', 'u')}`,
      );
    if (!matches?.length) continue;
    if (matches.length === 1) return matches[0];

    const regionMatch = matches.find((city) => {
      const regionName = regionIndex.get(`${city.country}.${city.admin1}`) ?? '';
      return (
        normalizedRegion === normalize(city.admin1) ||
        normalizedRegion === normalize(regionName)
      );
    });
    if (regionMatch) return regionMatch;
  }

  return null;
}

function main() {
  const rows = parseCsv(fs.readFileSync(INPUT_PATH, 'utf8')).filter(
    (row) => row.tech_tree_all_nodes && row.linkedin_headquarters,
  );
  const cityIndex = new Map<string, City[]>();
  (cities as City[]).forEach((city) => {
    const key = `${city.country}|${normalize(city.name)}`;
    const current = cityIndex.get(key) ?? [];
    current.push(city);
    cityIndex.set(key, current);
  });
  const regionIndex = new Map(
    admin1Regions.map((region) => [region.code, region.name]),
  );

  const locations: CompanyLocation[] = [];
  const unresolvedCompanyIds: string[] = [];
  rows.forEach((row) => {
    const city = resolveCity(
      row.linkedin_headquarters,
      row.country_iso,
      cityIndex,
      regionIndex,
    );
    if (!city) {
      unresolvedCompanyIds.push(row.id);
      return;
    }
    locations.push({
      company_id: row.id,
      label: row.linkedin_headquarters,
      country_iso: row.country_iso,
      latitude: Number(city.lat),
      longitude: Number(city.lng),
      source_field: 'linkedin_headquarters',
      source_url: row.linkedin_url || null,
    });
  });

  locations.sort((left, right) =>
    left.company_id.localeCompare(right.company_id),
  );
  const output = {
    metadata: {
      source: 'data/tt-companies.csv linkedin_headquarters',
      gazetteer: 'GeoNames via cities.json (CC-BY-4.0)',
      eligible_company_count: rows.length,
      resolved_company_count: locations.length,
      unresolved_company_count: unresolvedCompanyIds.length,
      unresolved_company_ids: unresolvedCompanyIds.sort(),
    },
    locations,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    `Wrote ${locations.length} verified company locations to ${OUTPUT_PATH}; ${unresolvedCompanyIds.length} remain country-level only.`,
  );
}

main();
