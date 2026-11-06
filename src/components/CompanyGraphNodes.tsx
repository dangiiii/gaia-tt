'use client';

import { Focus, Info } from 'lucide-react';
import { Handle, NodeProps, Position } from '@xyflow/react';
import {
  CompanyGraphCompanyNodeData,
  CompanyGraphTechnologyNodeData,
} from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CompanyGraphCompanyNodeProps extends Omit<NodeProps, 'data'> {
  data: CompanyGraphCompanyNodeData;
  onShowDetails: (companyId: string) => void;
  onShowConnected?: (nodeId: string) => void;
}

interface CompanyGraphTechnologyNodeProps extends Omit<NodeProps, 'data'> {
  data: CompanyGraphTechnologyNodeData;
  onShowDetails: (technologyId: string) => void;
  onShowConnected?: (nodeId: string) => void;
}

function NodeButtons({
  nodeId,
  onShowDetails,
  onShowConnected,
}: {
  nodeId: string;
  onShowDetails: () => void;
  onShowConnected?: (nodeId: string) => void;
}) {
  return (
    <div className="absolute -right-2 -top-2 flex gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 w-7 bg-white p-0 shadow-sm"
        title="Show details"
        aria-label="Show details"
        onClick={(event) => {
          event.stopPropagation();
          onShowDetails();
        }}
      >
        <Info className="h-3.5 w-3.5" />
      </Button>
      {onShowConnected && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 w-7 bg-white p-0 shadow-sm"
          title="Show connected"
          aria-label="Show connected"
          onClick={(event) => {
            event.stopPropagation();
            onShowConnected(nodeId);
          }}
        >
          <Focus className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function CompanyGraphCompanyNode({
  id,
  data,
  onShowDetails,
  onShowConnected,
}: CompanyGraphCompanyNodeProps) {
  return (
    <div className="relative flex h-full w-full flex-col justify-center px-3">
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <NodeButtons
        nodeId={id}
        onShowDetails={() => onShowDetails(data.company.id)}
        onShowConnected={onShowConnected}
      />
      <span className="line-clamp-2 text-sm font-semibold text-amber-950">
        {data.label}
      </span>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-800">
        <Badge variant="secondary" className="h-5 bg-amber-100 px-1.5 text-[10px]">
          Company
        </Badge>
        {data.company.country_iso && <span>{data.company.country_iso}</span>}
      </div>
    </div>
  );
}

export function CompanyGraphTechnologyNode({
  id,
  data,
  onShowDetails,
  onShowConnected,
}: CompanyGraphTechnologyNodeProps) {
  return (
    <div className="relative flex h-full w-full flex-col justify-center px-3">
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <NodeButtons
        nodeId={id}
        onShowDetails={() => onShowDetails(data.technologyNode.id)}
        onShowConnected={onShowConnected}
      />
      <span className="line-clamp-3 text-sm font-medium text-gray-900">
        {data.label}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">
        {String(data.technologyNode.data.nodeLabel)}
      </span>
    </div>
  );
}
