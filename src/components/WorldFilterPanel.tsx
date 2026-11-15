'use client';

import { Filter, X } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  countActiveWorldFilters,
  EMPTY_WORLD_FILTERS,
  PowerClassOption,
  ReactorTypeOption,
  toggleWorldFilterValue,
  WorldFilterCatalog,
  WorldViewFilters,
} from '@/lib/worldFilters';

interface WorldFilterPanelProps {
  catalog: WorldFilterCatalog;
  filters: WorldViewFilters;
  matchCount: number;
  totalCount: number;
  onChange: (filters: WorldViewFilters) => void;
}

function OptionList<T extends string | number>({
  options,
  selected,
  onToggle,
}: {
  options: Array<{ value: T; label: string; count: number }>;
  selected: T[];
  onToggle: (value: T) => void;
}) {
  if (options.length === 0) {
    return (
      <p className="px-0.5 py-1 text-xs text-gray-400">
        No values in the current dataset.
      </p>
    );
  }

  return (
    <div className="flex max-h-36 flex-col gap-1 overflow-y-auto pr-1">
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <label
            key={String(option.value)}
            className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
              isSelected
                ? 'bg-blue-50 text-blue-900'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={isSelected}
              onChange={() => onToggle(option.value)}
            />
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            <span className="shrink-0 text-[10px] text-gray-400">
              {option.count}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function WorldFilterPanel({
  catalog,
  filters,
  matchCount,
  totalCount,
  onChange,
}: WorldFilterPanelProps) {
  const activeCount = countActiveWorldFilters(filters);

  const patch = <K extends keyof WorldViewFilters>(
    key: K,
    values: WorldViewFilters[K],
  ) => {
    onChange({ ...filters, [key]: values });
  };

  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-gray-500" />
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Technology filters
          </p>
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </div>
        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-gray-500"
            onClick={() => onChange(EMPTY_WORLD_FILTERS)}
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <p className="mb-2 text-[11px] text-gray-500">
        Showing {matchCount} of {totalCount} companies
        {activeCount > 0 ? ' after filters' : ''}.
      </p>

      <Accordion type="multiple" className="w-full">
        <AccordionItem value="reactor" className="border-gray-100">
          <AccordionTrigger className="py-2 text-xs font-medium text-gray-800 hover:no-underline">
            <span className="flex items-center gap-2">
              Reactor type
              {filters.reactorTypes.length > 0 && (
                <span className="text-[10px] font-normal text-blue-600">
                  {filters.reactorTypes.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <OptionList
              options={
                catalog.reactorTypes.length > 0
                  ? catalog.reactorTypes
                  : (
                      [
                        'PWR',
                        'BWR',
                        'Molten salt',
                        'HTGR',
                        'Fast reactor',
                        'Microreactor',
                      ] as ReactorTypeOption[]
                    ).map((value) => ({ value, label: value, count: 0 }))
              }
              selected={filters.reactorTypes}
              onToggle={(value) =>
                patch(
                  'reactorTypes',
                  toggleWorldFilterValue(filters.reactorTypes, value),
                )
              }
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="coolant" className="border-gray-100">
          <AccordionTrigger className="py-2 text-xs font-medium text-gray-800 hover:no-underline">
            <span className="flex items-center gap-2">
              Coolant
              {filters.coolants.length > 0 && (
                <span className="text-[10px] font-normal text-blue-600">
                  {filters.coolants.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <OptionList
              options={catalog.coolants}
              selected={filters.coolants}
              onToggle={(value) =>
                patch(
                  'coolants',
                  toggleWorldFilterValue(filters.coolants, value),
                )
              }
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="spectrum" className="border-gray-100">
          <AccordionTrigger className="py-2 text-xs font-medium text-gray-800 hover:no-underline">
            <span className="flex items-center gap-2">
              Neutron spectrum
              {filters.spectra.length > 0 && (
                <span className="text-[10px] font-normal text-blue-600">
                  {filters.spectra.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <OptionList
              options={catalog.spectra}
              selected={filters.spectra}
              onToggle={(value) =>
                patch(
                  'spectra',
                  toggleWorldFilterValue(filters.spectra, value),
                )
              }
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="power" className="border-gray-100">
          <AccordionTrigger className="py-2 text-xs font-medium text-gray-800 hover:no-underline">
            <span className="flex items-center gap-2">
              Power class
              {filters.powerClasses.length > 0 && (
                <span className="text-[10px] font-normal text-blue-600">
                  {filters.powerClasses.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <OptionList
              options={
                catalog.powerClasses.length > 0
                  ? catalog.powerClasses
                  : (
                      [
                        'Micro (<20 MWe)',
                        'Small (20–300 MWe)',
                        'Medium (300–700 MWe)',
                        'Large (≥700 MWe)',
                      ] as PowerClassOption[]
                    ).map((value) => ({ value, label: value, count: 0 }))
              }
              selected={filters.powerClasses}
              onToggle={(value) =>
                patch(
                  'powerClasses',
                  toggleWorldFilterValue(filters.powerClasses, value),
                )
              }
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="country" className="border-gray-100">
          <AccordionTrigger className="py-2 text-xs font-medium text-gray-800 hover:no-underline">
            <span className="flex items-center gap-2">
              Country
              {filters.countries.length > 0 && (
                <span className="text-[10px] font-normal text-blue-600">
                  {filters.countries.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <OptionList
              options={catalog.countries}
              selected={filters.countries}
              onToggle={(value) =>
                patch(
                  'countries',
                  toggleWorldFilterValue(filters.countries, value),
                )
              }
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="status" className="border-b-0 border-gray-100">
          <AccordionTrigger className="py-2 text-xs font-medium text-gray-800 hover:no-underline">
            <span className="flex items-center gap-2">
              Development status
              {filters.statusLevels.length > 0 && (
                <span className="text-[10px] font-normal text-blue-600">
                  {filters.statusLevels.length}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-1">
            <OptionList
              options={catalog.statusLevels}
              selected={filters.statusLevels}
              onToggle={(value) =>
                patch(
                  'statusLevels',
                  toggleWorldFilterValue(filters.statusLevels, value),
                )
              }
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
