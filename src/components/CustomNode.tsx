'use client';

import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeActions } from './NodeActions';
import { UiNode } from '@/lib/types';

interface CustomNodeProps extends NodeProps {
  data: UiNode['data'];
  onShowDetails: (nodeId: string) => void;
  onShowConnected: (nodeId: string) => void;
  onShowCompanies?: (nodeId: string) => void;
  isCompaniesExpanded?: (nodeId: string) => boolean;
  onShowLiterature?: (nodeId: string) => void;
  isLiteratureExpanded?: (nodeId: string) => boolean;
  literatureCount?: number;
}

export const CustomNode: React.FC<CustomNodeProps> = ({
  data,
  id,
  onShowDetails,
  onShowConnected,
  onShowCompanies,
  isCompaniesExpanded,
  onShowLiterature,
  isLiteratureExpanded,
  literatureCount,
}) => {
  // Determine color based on probability
  let statusColor = 'bg-transparent';
  let probabilityText = '';

  if (data.infact_analysis && data.infact_analysis.probability) {
    probabilityText = String(data.infact_analysis.probability);
    let probValue = parseFloat(probabilityText.replace(/[^0-9.]/g, ''));

    if (probValue > 0 && probValue <= 1 && !probabilityText.includes('%')) {
      probValue *= 100;
    }

    if (!isNaN(probValue)) {
      if (probValue < 20) statusColor = 'bg-red-600';
      else if (probValue < 40) statusColor = 'bg-red-400';
      else if (probValue < 60) statusColor = 'bg-yellow-400';
      else if (probValue < 80) statusColor = 'bg-green-400';
      else statusColor = 'bg-green-600';
    }
  }

  return (
    <div className="w-full h-full relative">
      {statusColor !== 'bg-transparent' && (
        <div
          className="absolute bottom-14 left-0 transform -translate-x-1.5 -translate-y-1.5 z-10 pointer-events-auto cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onShowDetails(id);
          }}
          title={`InFact Confidence: ${probabilityText} — click to view details`}
        >
          <div
            className={`w-4 h-4 rounded-full border-2 border-white shadow-sm ${statusColor}`}
          />
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="opacity-0"
      />

      <div className="w-full h-full flex items-center justify-center text-center px-1 text-sm font-medium overflow-hidden">
        <span className="line-clamp-3 break-words" title={data.label}>
          {data.label}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="opacity-0"
      />

      {/* Existing Buttons */}
      <div className="absolute bottom-14 right-0 transform translate-x-2 -translate-y-2 z-10 pointer-events-auto">
        <NodeActions
          nodeId={id}
          onShowDetails={onShowDetails}
          onShowConnected={onShowConnected}
          onShowCompanies={onShowCompanies}
          companiesExpanded={isCompaniesExpanded?.(id)}
          onShowLiterature={onShowLiterature}
          literatureExpanded={isLiteratureExpanded?.(id)}
          literatureCount={literatureCount}
        />
      </div>
    </div>
  );
};