'use client';

import React from 'react';
import { VoteCounts } from '@/lib/votes';

interface VoteButtonsProps {
  counts?: VoteCounts;
  onVote: (vote: 'up' | 'down' | null) => void;
  size?: 'sm' | 'xs';
}

const THUMB =
  'M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777M2.331 10.727a11.969 11.969 0 00-.148 4.228M6.6 11.25h-.378a2.25 2.25 0 00-2.25 2.25v6a2.25 2.25 0 002.25 2.25h.378c.56 0 1.133-.031 1.703-.094';

function Thumb({ up, active, onClick, size }: { up: boolean; active: boolean; onClick: (e: React.MouseEvent) => void; size: string }) {
  return (
    <button
      onClick={onClick}
      className={`p-0.5 rounded hover:bg-gray-100 ${active ? (up ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}
    >
      <svg
        className={`${size} ${up ? '' : 'rotate-180'}`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={THUMB} />
      </svg>
    </button>
  );
}

export const VoteButtons: React.FC<VoteButtonsProps> = ({ counts, onVote, size = 'sm' }) => {
  const s = size === 'xs' ? 'h-3 w-3' : 'h-4 w-4';
  const t = size === 'xs' ? 'text-[10px]' : 'text-xs';
  const userVote = counts?.userVote ?? null;
  const toggle = (v: 'up' | 'down') => (e: React.MouseEvent) => {
    e.stopPropagation();
    onVote(userVote === v ? null : v);
  };
  return (
    <span className="inline-flex items-center gap-0.5">
      <Thumb up active={userVote === 'up'} onClick={toggle('up')} size={s} />
      <span className={`${t} text-gray-500`}>{counts?.up ?? 0}</span>
      <Thumb up={false} active={userVote === 'down'} onClick={toggle('down')} size={s} />
      <span className={`${t} text-gray-500`}>{counts?.down ?? 0}</span>
    </span>
  );
};

export default VoteButtons;
