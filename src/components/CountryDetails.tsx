'use client';

import { useMemo } from 'react';
import { Building2, Factory, MapPin, Network } from 'lucide-react';
import {
  CompanySummary,
  CompanyTechnologyMapping,
  ExplorerSelection,
  TechTree,
} from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildTechnologyDistribution } from '@/lib/geography';

interface CountryDetailsProps {
  selection: Extract<ExplorerSelection, { kind: 'country' }>;
  mappings: CompanyTechnologyMapping[];
  techTree: TechTree | null;
  onShowCompany: (company: CompanySummary) => void;
  onShowTechnology: (technologyId: string) => void;
}

export function CountryDetails({
  selection,
  mappings,
  techTree,
  onShowCompany,
  onShowTechnology,
}: CountryDetailsProps) {
  const technologyDistribution = useMemo(
    () =>
      buildTechnologyDistribution(selection.companies, mappings, techTree),
    [selection.companies, mappings, techTree],
  );

  return (
    <div className="h-full overflow-y-auto p-4">
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm text-blue-700">
                {selection.layer === 'headquarters' ? (
                  <MapPin className="h-4 w-4" />
                ) : (
                  <Factory className="h-4 w-4" />
                )}
                {selection.layer === 'headquarters'
                  ? 'Headquarters layer'
                  : 'Manufacturing layer'}
              </div>
              <CardTitle>{selection.countryName}</CardTitle>
            </div>
            <Badge variant="secondary">{selection.countryIso}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Building2 className="h-4 w-4" />
                Companies
              </h3>
              <span className="text-xs text-gray-500">
                {selection.companies.length}
              </span>
            </div>
            <div className="space-y-2">
              {selection.companies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {company.canonical_name}
                    </p>
                    {company.primary_approach && (
                      <p className="truncate text-xs text-gray-500">
                        {company.primary_approach}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => onShowCompany(company)}
                  >
                    View graph
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-gray-200 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Network className="h-4 w-4" />
                Mapped technologies
              </h3>
              <span className="text-xs text-gray-500">
                {technologyDistribution.length}
              </span>
            </div>
            {technologyDistribution.length === 0 ? (
              <p className="text-sm text-gray-500">
                No mapped technologies are available.
              </p>
            ) : (
              <div className="space-y-2">
                {technologyDistribution.map((technology) => (
                  <button
                    key={technology.technologyId}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => onShowTechnology(technology.technologyId)}
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {technology.label}
                    </span>
                    <Badge variant="secondary">
                      {technology.companyCount}{' '}
                      {technology.companyCount === 1 ? 'company' : 'companies'}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
