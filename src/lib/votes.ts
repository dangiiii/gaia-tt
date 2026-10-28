'use client';

export interface VoteCounts {
  up: number;
  down: number;
  userVote: 'up' | 'down' | null;
}

// Voter identity is a server-issued httpOnly cookie; same-origin fetches send it
// automatically, so the client never handles a voter id.

export async function fetchVotes(
  topic: string,
  targetIds: string[],
): Promise<Record<string, VoteCounts>> {
  if (!targetIds.length) return {};
  try {
    const res = await fetch('/investment-tech-tree/api/kg/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, targets: targetIds }),
    });
    if (!res.ok) return {};
    return (await res.json()).votes ?? {};
  } catch {
    return {};
  }
}

export type VoteResult = { ok: true; counts: VoteCounts } | { ok: false; error: string };

export async function castVote(
  topic: string,
  targetId: string,
  vote: 'up' | 'down' | null,
): Promise<VoteResult> {
  try {
    const res = await fetch('/investment-tech-tree/api/kg/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, vote, topic }),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok
      ? { ok: true, counts: body as VoteCounts }
      : { ok: false, error: body.error ?? `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

/** Optimistic vote: applies locally, then reconciles with the server or rolls back. */
export async function optimisticVote(
  topic: string,
  targetId: string,
  vote: 'up' | 'down' | null,
  previous: VoteCounts | undefined,
  set: (counts: VoteCounts | undefined) => void,
): Promise<void> {
  set(applyVote(previous, vote));
  const res = await castVote(topic, targetId, vote);
  if (res.ok) {
    set(res.counts);
  } else {
    set(previous);
    alert(`Your vote could not be saved: ${res.error}`);
  }
}

/** Counts as they will be once `vote` is applied — for optimistic UI updates. */
export function applyVote(prev: VoteCounts | undefined, vote: 'up' | 'down' | null): VoteCounts {
  const c = { up: prev?.up ?? 0, down: prev?.down ?? 0, userVote: prev?.userVote ?? null };
  if (c.userVote) c[c.userVote] = Math.max(0, c[c.userVote] - 1);
  if (vote) c[vote] += 1;
  return { ...c, userVote: vote };
}
