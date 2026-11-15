'use client';

import { useMemo } from 'react';
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Factory,
  Globe2,
  Network,
  X,
} from 'lucide-react';
import {
  CompanySummary,
  CompanyTechnologyMapping,
  DataNode,
  TechTree,
} from '@/lib/types';
import { TopicKey } from '@/lib/topicConfig';
import { getCountryName } from '@/lib/geography';
import {
  groupEntitiesForReactor,
  LinkedEntityRef,
} from '@/lib/reactorEntities';
import { SmrNodeDetails } from './SmrNodeDetails';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ReactorMapDrawerProps {
  nodeId: string;
  label: string;
  topic: TopicKey;
  techTree: TechTree | null;
  companies: CompanySummary[];
  mappings: CompanyTechnologyMapping[];
  fromCountryName?: string;
  onClose: () => void;
  onBackToCountry?: () => void;
  onShowCompany: (company: CompanySummary) => void;
  onOpenInTechTree: (nodeId: string) => void;
}

function EntityRow({
  entity,
  onShowCompany,
}: {
  entity: LinkedEntityRef;
  onShowCompany: (company: CompanySummary) => void;
}) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">
          {entity.name}
        </p>
        <p className="truncate text-xs text-gray-500">
          {entity.orgId ?? (entity.company ? `id:${entity.company.id}` : entity.id)}
          {entity.roles.length > 0 ? ` · ${entity.roles.join(', ')}` : ''}
        </p>
        {entity.viaTechnologyLabel && (
          <p className="mt-0.5 truncate text-[11px] text-gray-400">
            via {entity.viaTechnologyLabel}
          </p>
        )}
      </div>
      {entity.company && (
        <Badge variant="secondary" className="shrink-0">
          Open
        </Badge>
      )}
    </>
  );

  if (!entity.company) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-200 p-3 text-left">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      onClick={() => onShowCompany(entity.company!)}
    >
      {content}
    </button>
  );
}

function leanReactorFacts(node: DataNode | undefined) {
  const smr = node?.data.smr;
  if (!smr || smr.kind !== 'reactor') return null;
  return smr;
}

export function ReactorMapDrawer({
  nodeId,
  label,
  topic,
  techTree,
  companies,
  mappings,
  fromCountryName,
  onClose,
  onBackToCountry,
  onShowCompany,
  onOpenInTechTree,
}: ReactorMapDrawerProps) {
  const node = useMemo(
    () => techTree?.nodes.find((entry) => entry.id === nodeId),
    [techTree, nodeId],
  );
  const facts = leanReactorFacts(node);
  const groups = useMemo(
    () => groupEntitiesForReactor(nodeId, companies, mappings, techTree),
    [nodeId, companies, mappings, techTree],
  );
  const linkedCount = groups.reduce(
    (sum, group) => sum + group.entities.length,
    0,
  );
  const countries = facts?.countries ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur-sm">
      <header className="border-b border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-blue-700">
              <Network className="h-3.5 w-3.5" />
              Reactor design
            </div>
            <h2 className="mt-1 truncate text-xl font-bold text-gray-900">
              {label}
            </h2>
            <p className="mt-1 font-mono text-[11px] text-gray-400">{nodeId}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 shrink-0 p-0"
            onClick={onClose}
            aria-label="Close reactor drawer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {facts?.status && (
            <Badge variant="secondary">{facts.status}</Badge>
          )}
          {facts?.coolant && (
            <Badge variant="outline">Coolant: {facts.coolant}</Badge>
          )}
          {facts?.neutron_spectrum && (
            <Badge variant="outline">{facts.neutron_spectrum}</Badge>
          )}
          {facts?.electric_mwe != null && (
            <Badge variant="outline">{facts.electric_mwe} MWe</Badge>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {onBackToCountry && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={onBackToCountry}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {fromCountryName ? `Back to ${fromCountryName}` : 'Back'}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => onOpenInTechTree(nodeId)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in tech tree
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {countries.length > 0 && (
          <section className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Countries</h3>
            </div>
            <p className="text-sm text-gray-600">
              {countries
                .map((iso) => getCountryName(iso) || iso)
                .join(' · ')}
            </p>
          </section>
        )}

        <section className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Linked organisations
            </h3>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {linkedCount}
            </Badge>
          </div>
          {groups.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 p-3 text-sm text-gray-500">
              No mapped developers or suppliers for this design yet.
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.role}>
                  <div className="mb-2 flex items-center gap-2">
                    <Factory className="h-3.5 w-3.5 text-gray-500" />
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {group.label}
                    </h4>
                    <span className="text-[10px] text-gray-400">
                      {group.entities.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.entities.map((entity) => (
                      <EntityRow
                        key={`${group.role}:${entity.id}`}
                        entity={entity}
                        onShowCompany={onShowCompany}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            Grouped from company ↔ design edges (`develops` / `supplies`) and
            one-hop enabling technologies. Site and programme nodes are shown
            when present in the catalogue payload below.
          </p>
        </section>

        <section className="border-t border-gray-200 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Catalogue details
          </h3>
          <SmrNodeDetails nodeId={nodeId} topic={topic} />
        </section>
      </div>
    </div>
  );
}
