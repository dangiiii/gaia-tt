'use client';

import React from 'react';
import { KgPaperDossier } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface PaperDetailsProps {
  dossier: KgPaperDossier;
  onClose: () => void;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return null;
  return (
    <div className="space-y-1 pb-2 border-b last:border-b-0">
      <h4 className="font-semibold text-sm text-gray-700">{label}</h4>
      <div className="text-sm text-gray-800">{value}</div>
    </div>
  );
}

export const PaperDetails: React.FC<PaperDetailsProps> = ({ dossier, onClose }) => {
  const conf = dossier.conference;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <Card
        className="max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-2 text-xs">
                {dossier.paperId}
              </Badge>
              <CardTitle className="text-lg leading-snug">{dossier.title}</CardTitle>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow
            label="Authors"
            value={dossier.authors?.length ? dossier.authors.join(', ') : null}
          />
          <InfoRow
            label="Conference"
            value={
              conf?.name
                ? `${conf.name}${conf.year ? ` (${conf.year})` : ''}${conf.location ? ` — ${conf.location}` : ''}${conf.session ? ` · Session ${conf.session}` : ''}`
                : null
            }
          />
          <InfoRow
            label="Institute"
            value={
              dossier.institute?.name
                ? `${dossier.institute.name}${dossier.institute.city ? `, ${dossier.institute.city}` : ''}`
                : null
            }
          />
          <InfoRow
            label="Study"
            value={
              dossier.studyKind
                ? `${dossier.studyKind}${dossier.numPages ? ` · ${dossier.numPages} pp.` : ''}`
                : null
            }
          />

          {(dossier.experiments ?? []).map((exp, i) => (
            <Accordion key={i} type="single" collapsible className="border rounded-md px-3">
              <AccordionItem value={`exp-${i}`}>
                <AccordionTrigger className="text-sm font-medium">
                  {exp.name || `Experiment ${i + 1}`}
                  {exp.device ? ` — ${exp.device}` : ''}
                </AccordionTrigger>
                <AccordionContent className="space-y-3 text-sm">
                  {exp.heatingMethods?.filter((h) => h?.name).length ? (
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Heating methods</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {exp.heatingMethods.map((h, j) => (
                          <li key={j}>
                            <span className="font-medium">{h.name}</span>
                            {[h.frequency, h.power, h.pulseDuration]
                              .filter(Boolean)
                              .map((v) => ` (${v})`)
                              .join('')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {exp.findings?.filter(Boolean).length ? (
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Findings</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {exp.findings.filter(Boolean).map((f, j) => (
                          <li key={j}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {exp.measurements?.filter((m) => m?.parameter || m?.value).length ? (
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Measurements</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {exp.measurements.map((m, j) => (
                          <li key={j}>
                            {[m.parameter, [m.value, m.unit].filter(Boolean).join(' ')]
                              .filter(Boolean)
                              .join(': ')}
                            {m.diagnostic ? ` — ${m.diagnostic}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {exp.scalabilityClaims?.filter((c) => c?.statement).length ? (
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Scalability claims</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {exp.scalabilityClaims.map((c, j) => (
                          <li key={j}>
                            {c.statement}
                            {c.limit ? ` (limit: ${c.limit})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {exp.constraints?.filter(Boolean).length ? (
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Constraints</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {exp.constraints.filter(Boolean).map((c, j) => (
                          <li key={j}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {exp.instabilities?.filter((x) => x?.name).length ? (
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-1">Instabilities</h5>
                      <div className="flex flex-wrap gap-1">
                        {exp.instabilities.map((x, j) => (
                          <Badge key={j} variant={x.observed ? 'default' : 'secondary'} className="text-xs">
                            {x.name}
                            {x.observed ? ' (observed)' : ' (predicted)'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ))}

          {dossier.excerpts?.length ? (
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-1">Excerpts</h4>
              <div className="space-y-2">
                {dossier.excerpts.map((ex, i) => (
                  <blockquote
                    key={i}
                    className="text-xs text-gray-600 border-l-2 border-indigo-200 pl-3 italic"
                  >
                    {ex}
                  </blockquote>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaperDetails;
