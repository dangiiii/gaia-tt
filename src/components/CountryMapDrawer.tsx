'use client';

import { useMemo, useState } from 'react';
import { Building2, Factory, MapPin, Network, Search, X } from 'lucide-react';
import {
  CompanySummary,
  CompanyTechnologyMapping,
  GeographyLayer,
  TechTree,
} from '@/lib/types';
import {
  buildTechnologyDistribution,
  CompanyLocationGroup,
  CountryCompanyAggregate,
} from '@/lib/geography';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CountryMapDrawerProps {
  aggregate: CountryCompanyAggregate;
  layer: GeographyLayer;
  mappings: CompanyTechnologyMapping[];
  techTree: TechTree | null;
  verifiedLocations: CompanyLocationGroup[];
  onClose: () => void;
  onShowCompany: (company: CompanySummary) => void;
  onShowTechnology: (technologyId: string) => void;
}

export function CountryMapDrawer({
  aggregate,
  layer,
  mappings,
  techTree,
  verifiedLocations,
  onClose,
  onShowCompany,
  onShowTechnology,
}: CountryMapDrawerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredCompanies = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return aggregate.companies;
    return aggregate.companies.filter(
      (company) =>
        company.canonical_name.toLowerCase().includes(normalized) ||
        company.primary_approach?.toLowerCase().includes(normalized),
    );
  }, [aggregate.companies, searchTerm]);
  const technologies = useMemo(
    () =>
      buildTechnologyDistribution(aggregate.companies, mappings, techTree),
    [aggregate.companies, mappings, techTree],
  );
  const verifiedCompanyIds = useMemo(
    () =>
      new Set(
        verifiedLocations.flatMap((location) =>
          location.companies.map((company) => company.id),
        ),
      ),
    [verifiedLocations],
  );
  const countryLevelOnlyCount = aggregate.companies.filter(
    (company) => !verifiedCompanyIds.has(company.id),
  ).length;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur-sm">
      <header className="border-b border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-blue-700">
              {layer === 'headquarters' ? (
                <MapPin className="h-3.5 w-3.5" />
              ) : (
                <Factory className="h-3.5 w-3.5" />
              )}
              {layer === 'headquarters' ? 'Headquarters' : 'Manufacturing'}
            </div>
            <h2 className="mt-1 text-xl font-bold text-gray-900">
              {aggregate.countryName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{aggregate.countryIso}</Badge>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={onClose}
              aria-label="Close country drawer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {aggregate.companies.length}{' '}
          {aggregate.companies.length === 1 ? 'company' : 'companies'} ·{' '}
          {technologies.length} mapped technologies
        </p>
        {layer === 'headquarters' && (
          <p className="mt-1 text-xs text-gray-400">
            {verifiedCompanyIds.size} city-verified · {countryLevelOnlyCount}{' '}
            country-level only
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">Companies</h3>
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search this country"
              className="h-9 w-full rounded-md border border-gray-300 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <div className="mt-3 space-y-2">
            {filteredCompanies.map((company) => (
              <button
                key={company.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => onShowCompany(company)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {company.canonical_name}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {company.primary_approach ?? 'Approach not specified'}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Open
                </Badge>
              </button>
            ))}
            {filteredCompanies.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-500">
                No companies match this search.
              </p>
            )}
          </div>
        </section>

        {layer === 'headquarters' && verifiedLocations.length > 0 && (
          <section className="mt-6 border-t border-gray-200 pt-5">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                Verified city locations
              </h3>
            </div>
            <div className="space-y-2">
              {verifiedLocations.map((location) => (
                <div
                  key={location.key}
                  className="rounded-lg border border-orange-100 bg-orange-50/60 p-3"
                >
                  <p className="text-sm font-medium text-gray-900">
                    {location.label}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {location.companies
                      .map((company) => company.canonical_name)
                      .join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 border-t border-gray-200 pt-5">
          <div className="mb-3 flex items-center gap-2">
            <Network className="h-4 w-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Technology distribution
            </h3>
          </div>
          <div className="space-y-2">
            {technologies.map((technology) => (
              <button
                key={technology.technologyId}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => onShowTechnology(technology.technologyId)}
              >
                <span className="text-sm font-medium text-gray-900">
                  {technology.label}
                </span>
                <Badge variant="secondary" className="shrink-0">
                  {technology.companyCount}
                </Badge>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
