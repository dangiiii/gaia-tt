'use client';

import { LABEL_COLORS, NODE_LABELS } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const Legend = () => {
  return (
    <Card
      className="absolute top-[160px] left-4"
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Legend</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {NODE_LABELS.map((label) => (
          <div key={label} className="flex items-center space-x-2">
            <span
              className={`w-4 h-4 rounded bg-${LABEL_COLORS[label]}`}
            ></span>
            <span className="text-sm">{label}</span>
          </div>
        ))}
        <div className="flex items-center space-x-2 pt-1 border-t border-gray-200 mt-1">
          <span className="w-4 h-4 rounded border-2" style={{ borderColor: '#6366f1' }}></span>
          <span className="text-sm">Paper</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-4 h-4 rounded border" style={{ borderColor: '#14b8a6' }}></span>
          <span className="text-sm">Device</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-4 h-4 rounded border" style={{ borderColor: '#f59e0b' }}></span>
          <span className="text-sm">Finding</span>
        </div>
      </CardContent>
    </Card>
  );
};