'use client';

import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { LiteratureNodeData } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface LiteratureNodeProps extends Omit<NodeProps, 'data'> {
  data: LiteratureNodeData;
  onShowPaper: (entity: LiteratureNodeData['entity']) => void;
}

const KIND_ICONS: Record<string, string> = {
  paper: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  device: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
  finding: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
};

export const LiteratureNode: React.FC<LiteratureNodeProps> = ({
  data,
  onShowPaper,
}) => {
  const canOpen = data.entity.kind === 'paper';
  return (
    <div className="w-full h-full relative">
      <Handle type="target" position={Position.Left} className="opacity-0" />

      <div className="w-full h-full flex items-center justify-center text-center px-1 text-xs font-medium overflow-hidden gap-1">
        <svg
          className="h-3 w-3 shrink-0 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={KIND_ICONS[data.entity.kind] ?? KIND_ICONS.paper}
          />
        </svg>
        <span className="line-clamp-3 break-words" title={data.label}>
          {data.label}
        </span>
      </div>

      <Handle type="source" position={Position.Right} className="opacity-0" />

      {canOpen && (
        <div className="absolute bottom-14 right-0 transform translate-x-2 -translate-y-2 z-10 pointer-events-auto">
          <div className="flex gap-1 opacity-100">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-white border border-gray-200 shadow-sm hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation();
                onShowPaper(data.entity);
              }}
              title="Show Paper Details"
            >
              <svg className="h-3 w-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
